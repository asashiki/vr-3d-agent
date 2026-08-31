(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const state = { catalog:null, store:null, tools:null, loop:null, selected:null, events:[], busy:false, health:null, recorder:null, recognition:null, mediaStream:null, audio:null, avatarFallback:false, voiceHeld:false };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const uniqueId = (assetId) => `${assetId.replace(/_\d+$/,'')}-${Date.now().toString(36).slice(-5)}`;

  async function planner(input) {
    const response = await fetch('/api/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
    if(!response.ok) throw new Error(`planner ${response.status}`);
    const data=await response.json();
    setMode(data.source || 'replay');
    return data.plan;
  }
  function setMode(mode) { $('#mode-pill').textContent = mode.includes('live') ? 'LIVE + REPLAY' : 'REPLAY READY'; }
  function renderEvents(){const timeline=$('#timeline');if(!timeline)return;timeline.innerHTML=state.events.map((item)=>`<li class="${item.result?.ok===false?'event-error':''}"><span>${escapeHtml(item.tool||item.phase)}</span><time>${new Date(item.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time></li>`).join('');}
  function addEvent(event) {
    state.events.unshift(event); state.events=state.events.slice(0,60);
    try{localStorage.setItem('pocket-world.events.v1',JSON.stringify(state.events));}catch{/* event persistence is non-critical */}renderEvents();
  }
  async function speak(text, emotion) {
    $('#mira-message').textContent=text; $('#mira-state').textContent=emotion==='happy'?'开心':'已完成';
    const actor=$('#mira-avatar')?.components?.['vrm-actor'];
    if(actor)actor.setEmocao(emotion==='neutral'?null:emotion);
    if(state.health?.services?.tts){
      try{
        const response=await fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})});
        if(!response.ok)throw new Error(`tts ${response.status}`);
        const data=await response.json();const bytes=Uint8Array.from(atob(data.audioBase64),(char)=>char.charCodeAt(0));
        const url=URL.createObjectURL(new Blob([bytes],{type:data.mimeType||'audio/mpeg'}));
        if(state.audio){state.audio.pause();state.audio=null;}
        const audio=new Audio(url);state.audio=audio;if(actor)actor.speak(audio,data.alignment||null);
        audio.addEventListener('ended',()=>{URL.revokeObjectURL(url);if(state.audio===audio)state.audio=null;},{once:true});
        await audio.play();return;
      }catch(error){addEvent({at:new Date().toISOString(),tool:'tts_fallback',result:{ok:false,code:error.message}});}
    }
    const utterance = 'speechSynthesis' in window ? new SpeechSynthesisUtterance(text) : null;
    if(utterance){utterance.lang='zh-CN';utterance.rate=1.05;if(actor)actor.setSpeaking(true);utterance.onend=()=>actor?.setSpeaking(false);utterance.onerror=()=>actor?.setSpeaking(false);window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);}
  }
  function playAction(action) {
    $('#mira-state').textContent=action;
    const tags={Relax:'relax',Thinking:'think',Surprised:'surprised',Clapping:'clap',LookAround:'lookaround',Goodbye:'bye'};
    const actor=$('#mira-avatar')?.components?.['vrm-actor']; if(actor) actor.acionar(tags[action]||action);
  }
  function renderScene(scene) {
    const tray=$('#world-objects'); if(!tray||!state.catalog) return;
    const current=new Map(Array.from(tray.children).map((el)=>[el.dataset.instanceId,el]));
    for(const object of scene.objects){
      const asset=state.catalog.get(object.assetId); if(!asset) continue;
      let entity=current.get(object.instanceId);
      if(!entity){entity=document.createElement('a-entity');entity.classList.add('scene-object');entity.dataset.instanceId=object.instanceId;entity.setAttribute('gltf-model',`url(${asset.file})`);tray.appendChild(entity);}
      current.delete(object.instanceId);
      entity.setAttribute('position',object.position.join(' '));entity.setAttribute('rotation',object.rotation.join(' '));entity.setAttribute('scale',object.scale.join(' '));
      entity.classList.toggle('selected',object.instanceId===state.selected);
      if(object.color) entity.addEventListener('model-loaded',()=>entity.object3D.traverse((node)=>{if(node.material){node.material=node.material.clone();node.material.color.set(object.color);}}),{once:true});
    }
    for(const entity of current.values()) entity.remove();
    $('#object-count').textContent=`${scene.objects.length} 个物件`;
    renderInspector(scene);
  }
  function renderInspector(scene) {
    const object=scene.objects.find((item)=>item.instanceId===state.selected);
    $('#inspector-empty').hidden=!!object; $('#inspector-form').hidden=!object;
    if(!object) return;
    $('#inspector-name').textContent=state.catalog.get(object.assetId)?.name||object.assetId;
    $('#inspector-id').textContent=object.instanceId;
    ['position','rotation','scale'].forEach((key)=>{object[key].forEach((value,index)=>{$(`#${key}-${index}`).value=Number(value).toFixed(2);});});
  }
  function renderCatalog(category='all') {
    const assets=category==='all'?state.catalog.assets:state.catalog.list({category});
    $('#asset-grid').innerHTML=assets.map((asset)=>`<button class="asset-card" data-asset="${asset.id}"><span class="asset-dot" style="--asset:${asset.color}"></span><strong>${escapeHtml(asset.name)}</strong><small>${escapeHtml(asset.category)}</small></button>`).join('');
    document.querySelectorAll('.asset-card').forEach((button)=>button.addEventListener('click',()=>{
      const asset=state.catalog.get(button.dataset.asset); const offset=((state.store.scene.objects.length%7)-3)*.18;
      state.tools.execute({tool:'place_asset',assetId:asset.id,instanceId:uniqueId(asset.id),position:[offset,.04,.25],scale:asset.defaultScale});
    }));
  }
  async function runPrompt(text) {
    if(state.busy||!text.trim()) return; state.busy=true; $('#send-btn').disabled=true; $('#mira-state').textContent='思考中';
    try{const result=await state.loop.run(text.trim());if(!result.ok)speak(`这次没有安全地完成：${result.code}。场景保持原样。`,'sad');else addEvent({at:new Date().toISOString(),tool:'action_summary',input:{request:text.trim()},result:{ok:true,commands:result.plan.commands.length,objects:state.store.scene.objects.length}});}
    catch(error){speak(`连接暂时不可用：${error.message}。你仍可以手动搭建。`,'sad');}
    finally{state.busy=false;$('#send-btn').disabled=false;}
  }
  function bindUi() {
    $('#composer').addEventListener('submit',(event)=>{event.preventDefault();const input=$('#prompt');const text=input.value;input.value='';runPrompt(text);});
    $('#demo-btn').addEventListener('click',()=>runPrompt('在我面前搭一个治愈系小花园，有一棵树、一张长椅、两盏灯和一些花。'));
    $('#undo-btn').addEventListener('click',()=>state.tools.execute({tool:'undo'}));
    $('#save-btn').addEventListener('click',()=>runPrompt('保持现在的位置，保存这个场景。'));
    $('#load-btn').addEventListener('click',()=>state.tools.execute({tool:'load_scene'}));
    $('#tray-reset-btn').addEventListener('click',()=>window.dispatchEvent(new Event('pocket-tray-reset')));
    $('#clear-btn').addEventListener('click',()=>state.tools.execute({tool:'clear_scene'}));
    document.querySelectorAll('[data-category]').forEach((button)=>button.addEventListener('click',()=>{document.querySelectorAll('[data-category]').forEach((b)=>b.classList.remove('active'));button.classList.add('active');renderCatalog(button.dataset.category);}));
    $('#delete-object').addEventListener('click',()=>{if(state.selected)state.tools.execute({tool:'remove_asset',instanceId:state.selected});state.selected=null;});
    $('#apply-transform').addEventListener('click',()=>{if(!state.selected)return;for(const key of ['position','rotation','scale']){const values=[0,1,2].map((index)=>Number($(`#${key}-${index}`).value));state.tools.execute({tool:key==='position'?'move_asset':key==='rotation'?'rotate_asset':'scale_asset',instanceId:state.selected,[key]:values});}});
    $('#enter-btn').addEventListener('click',async()=>{document.body.classList.add('entered');const scene=$('a-scene');try{if(scene?.is?.('vr-mode'))return;if(scene?.enterAR)await scene.enterAR();else if(scene?.enterVR)await scene.enterVR(true);else throw new Error('WebXR entry unavailable');}catch{$('#xr-note').textContent='当前浏览器使用桌面 3D 模式；Quest Browser 可进入 MR。';}});
    $('#desktop-btn').addEventListener('click',()=>document.body.classList.add('entered'));
    const mic=$('#mic-btn');mic.addEventListener('pointerdown',(event)=>{event.preventDefault();startVoice();});window.addEventListener('pointerup',stopVoice);
    ['#lhand','#rhand'].forEach((selector)=>{const hand=$(selector);if(!hand)return;['triggerdown','abuttondown','xbuttondown'].forEach((name)=>hand.addEventListener(name,startVoice));['triggerup','abuttonup','xbuttonup'].forEach((name)=>hand.addEventListener(name,stopVoice));});
    const avatar=$('#mira-avatar');avatar.addEventListener('model-error',()=>{if(state.avatarFallback)return;state.avatarFallback=true;$('#mira-state').textContent='切换备用模型';avatar.removeAttribute('vrm-model');setTimeout(()=>avatar.setAttribute('vrm-model','src:assets/avatars/AvatarSample_A.vrm'),0);});
    window.addEventListener('pocket-select',(event)=>{state.selected=event.detail.instanceId;renderScene(state.store.scene);});
    window.addEventListener('pocket-manual-transform',(event)=>{const d=event.detail;state.store.mutate((scene)=>{const object=scene.objects.find((item)=>item.instanceId===d.instanceId);if(object)Object.assign(object,{position:d.position,rotation:d.rotation,scale:d.scale});},{tool:'manual_transform'});addEvent({at:new Date().toISOString(),tool:'manual_transform',result:{ok:true}});});
    window.addEventListener('pocket-tray-transform',(event)=>state.store.mutate((scene)=>Object.assign(scene.tray,event.detail),{tool:'tray_transform'}));
  }
  async function startVoice() {
    state.voiceHeld=true;
    if(state.recorder?.state==='recording'||state.recognition)return;
    if(state.health?.services?.stt&&navigator.mediaDevices?.getUserMedia&&window.MediaRecorder){
      try{
        state.mediaStream=state.mediaStream||await navigator.mediaDevices.getUserMedia({audio:true});
        const preferred=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find((type)=>MediaRecorder.isTypeSupported(type));
        const chunks=[];const recorder=new MediaRecorder(state.mediaStream,preferred?{mimeType:preferred}:undefined);state.recorder=recorder;
        recorder.ondataavailable=(event)=>{if(event.data.size)chunks.push(event.data);};
        recorder.onstop=()=>{const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});state.recorder=null;$('#mic-btn').classList.remove('listening');transcribe(blob);};
        recorder.start();$('#mic-btn').classList.add('listening');$('#mira-state').textContent='正在听';if(!state.voiceHeld)recorder.stop();return;
      }catch(error){addEvent({at:new Date().toISOString(),tool:'stt_fallback',result:{ok:false,code:error.name||error.message}});}
    }
    startBrowserRecognition();
  }
  function stopVoice() {
    state.voiceHeld=false;
    if(state.recorder?.state==='recording')state.recorder.stop();
    if(state.recognition){try{state.recognition.stop();}catch{/* already stopping */}}
  }
  async function transcribe(blob){
    try{const response=await fetch(`/api/stt?file=speech.${blob.type.includes('mp4')?'m4a':'webm'}`,{method:'POST',headers:{'content-type':blob.type||'audio/webm'},body:blob});if(!response.ok)throw new Error(`stt ${response.status}`);const data=await response.json();if(data.text)runPrompt(data.text);}
    catch(error){speak(`语音识别失败：${error.message}。文字输入仍然可用。`,'sad');}
  }
  function startBrowserRecognition() {
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SpeechRecognition){speak('这个浏览器没有语音识别，文字输入仍然可用。','neutral');return;}
    const recognition=new SpeechRecognition();state.recognition=recognition;recognition.lang='zh-CN';recognition.interimResults=false;$('#mic-btn').classList.add('listening');
    recognition.onresult=(event)=>{$('#prompt').value=event.results[0][0].transcript;runPrompt($('#prompt').value);$('#prompt').value='';};
    recognition.onerror=()=>speak('没有收到语音，直接打字也可以。','neutral');recognition.onend=()=>{state.recognition=null;$('#mic-btn').classList.remove('listening');};recognition.start();if(!state.voiceHeld)recognition.stop();
  }
  async function init() {
    try {
      state.catalog=await PocketWorld.AssetCatalog.load();state.store=new PocketWorld.SceneStore();
      state.tools=new PocketWorld.SceneToolRegistry({catalog:state.catalog,store:state.store,onEvent:addEvent,onSpeak:speak,onAction:playAction});
      state.loop=new PocketWorld.AgentLoop({planner,tools:state.tools,maxCommands:14,maxRepairs:2,onPhase:addEvent});
      state.store.subscribe(renderScene);bindUi();try{const savedEvents=JSON.parse(localStorage.getItem('pocket-world.events.v1')||'[]');if(Array.isArray(savedEvents))state.events=savedEvents.slice(0,60);}catch{/* ignore invalid event cache */}renderEvents();renderCatalog();renderScene(state.store.scene);
      try{const response=await fetch('/api/health');state.health=await response.json();setMode(state.health.mode);}catch{state.health={services:{llm:false,stt:false,tts:false}};setMode('replay');}
      try{state.store.load();}catch{/* invalid local save must not block startup */}
    } catch(error) { $('#boot-error').hidden=false;$('#boot-error').textContent=`启动失败：${error.message}`; }
  }
  document.addEventListener('DOMContentLoaded',init);
})();
