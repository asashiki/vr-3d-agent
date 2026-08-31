(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const state = { catalog:null, store:null, tools:null, loop:null, selected:null, events:[], busy:false };
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
  function addEvent(event) {
    state.events.unshift(event); state.events=state.events.slice(0,60);
    const timeline=$('#timeline');
    timeline.innerHTML=state.events.map((item)=>`<li class="${item.result?.ok===false?'event-error':''}"><span>${escapeHtml(item.tool||item.phase)}</span><time>${new Date(item.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time></li>`).join('');
  }
  function speak(text, emotion) {
    $('#mira-message').textContent=text; $('#mira-state').textContent=emotion==='happy'?'开心':'已完成';
    const utterance = 'speechSynthesis' in window ? new SpeechSynthesisUtterance(text) : null;
    if(utterance){utterance.lang='zh-CN';utterance.rate=1.05;window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);}
  }
  function playAction(action) {
    $('#mira-state').textContent=action;
    const actor=$('#mira-avatar')?.components?.['vrm-actor']; if(actor) actor.acionar(action);
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
    try{const result=await state.loop.run(text.trim());if(!result.ok) speak(`这次没有安全地完成：${result.code}。场景保持原样。`,'sad');}
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
    $('#enter-btn').addEventListener('click',async()=>{document.body.classList.add('entered');const scene=$('a-scene');try{if(scene?.is?.('vr-mode'))return;if(scene?.enterAR)await scene.enterAR();}catch{$('#xr-note').textContent='当前浏览器使用桌面 3D 模式；Quest Browser 可进入 MR。';}});
    $('#desktop-btn').addEventListener('click',()=>document.body.classList.add('entered'));
    $('#mic-btn').addEventListener('click',startVoice);
    window.addEventListener('pocket-select',(event)=>{state.selected=event.detail.instanceId;renderScene(state.store.scene);});
    window.addEventListener('pocket-manual-transform',(event)=>{const d=event.detail;state.store.mutate((scene)=>{const object=scene.objects.find((item)=>item.instanceId===d.instanceId);if(object)Object.assign(object,{position:d.position,rotation:d.rotation,scale:d.scale});},{tool:'manual_transform'});addEvent({at:new Date().toISOString(),tool:'manual_transform',result:{ok:true}});});
    window.addEventListener('pocket-tray-transform',(event)=>state.store.mutate((scene)=>Object.assign(scene.tray,event.detail),{tool:'tray_transform'}));
  }
  function startVoice() {
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SpeechRecognition){speak('这个浏览器没有语音识别，文字输入仍然可用。','neutral');return;}
    const recognition=new SpeechRecognition();recognition.lang='zh-CN';recognition.interimResults=false;$('#mic-btn').classList.add('listening');
    recognition.onresult=(event)=>{$('#prompt').value=event.results[0][0].transcript;runPrompt($('#prompt').value);$('#prompt').value='';};
    recognition.onerror=()=>speak('没有收到语音，直接打字也可以。','neutral');recognition.onend=()=>$('#mic-btn').classList.remove('listening');recognition.start();
  }
  async function init() {
    try {
      state.catalog=await PocketWorld.AssetCatalog.load();state.store=new PocketWorld.SceneStore();
      state.tools=new PocketWorld.SceneToolRegistry({catalog:state.catalog,store:state.store,onEvent:addEvent,onSpeak:speak,onAction:playAction});
      state.loop=new PocketWorld.AgentLoop({planner,tools:state.tools,maxCommands:14,maxRepairs:2,onPhase:addEvent});
      state.store.subscribe(renderScene);bindUi();renderCatalog();renderScene(state.store.scene);
      try{const response=await fetch('/api/health');const health=await response.json();setMode(health.mode);}catch{setMode('replay');}
      try{state.store.load();}catch{/* invalid local save must not block startup */}
    } catch(error) { $('#boot-error').hidden=false;$('#boot-error').textContent=`启动失败：${error.message}`; }
  }
  document.addEventListener('DOMContentLoaded',init);
})();
