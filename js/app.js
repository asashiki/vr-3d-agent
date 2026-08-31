(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const state = {
    catalog: null, store: null, tools: null, loop: null, selected: null, events: [], busy: false,
    health: null, recorder: null, recognition: null, mediaStream: null, audio: null,
    avatarFallback: false, voiceHeld: false
  };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const uniqueId = (assetId) => `${assetId.replace(/_\d+$/, '')}-${Date.now().toString(36).slice(-5)}`;

  function setXrStatus(text) {
    const status = $('#xr-status');
    if (status) status.setAttribute('value', String(text || '').slice(0, 100));
  }
  function setUiState(label, message) {
    if ($('#mira-state')) $('#mira-state').textContent = label;
    if (message && $('#mira-message')) $('#mira-message').textContent = message;
    setXrStatus(message || label);
  }
  async function planner(input) {
    const response = await fetch('/api/plan', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(input) });
    if (!response.ok) throw new Error(`planner ${response.status}`);
    const data = await response.json();
    setMode(data.source || 'replay');
    return data.plan;
  }
  function setMode(mode) { $('#mode-pill').textContent = mode.includes('live') ? 'LIVE + REPLAY' : 'REPLAY READY'; }
  function renderEvents() {
    const timeline = $('#timeline');
    if (!timeline) return;
    timeline.innerHTML = state.events.map((item) => `<li class="${item.result?.ok === false ? 'event-error' : ''}"><span>${escapeHtml(item.tool || item.phase)}</span><time>${new Date(item.at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</time></li>`).join('');
  }
  function addEvent(event) {
    state.events.unshift(event);
    state.events = state.events.slice(0, 60);
    try { localStorage.setItem('pocket-world.events.v1', JSON.stringify(state.events)); } catch { /* non-critical */ }
    renderEvents();
  }

  async function speak(text, emotion) {
    setUiState(emotion === 'happy' ? '开心' : '已完成', text);
    const actor = $('#mira-avatar')?.components?.['vrm-actor'];
    if (actor) actor.setEmocao(emotion === 'neutral' ? null : emotion);
    if (state.health?.services?.tts) {
      try {
        const response = await fetch('/api/tts', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ text }) });
        if (!response.ok) throw new Error(`tts ${response.status}`);
        const data = await response.json();
        const bytes = Uint8Array.from(atob(data.audioBase64), (char) => char.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type:data.mimeType || 'audio/mpeg' }));
        if (state.audio) state.audio.pause();
        const audio = new Audio(url);
        state.audio = audio;
        if (actor) actor.speak(audio, data.alignment || null);
        audio.addEventListener('ended', () => {
          URL.revokeObjectURL(url);
          if (state.audio === audio) state.audio = null;
        }, { once:true });
        await audio.play();
        return;
      } catch (error) {
        addEvent({ at:new Date().toISOString(), tool:'tts_fallback', result:{ ok:false, code:error.message } });
      }
    }
    const utterance = 'speechSynthesis' in window ? new SpeechSynthesisUtterance(text) : null;
    if (utterance) {
      utterance.lang = 'zh-CN'; utterance.rate = 1.05;
      if (actor) actor.setSpeaking(true);
      utterance.onend = () => actor?.setSpeaking(false);
      utterance.onerror = () => actor?.setSpeaking(false);
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
    }
  }
  function playAction(action) {
    setUiState(action);
    if (action === 'StepForward' || action === 'StepBack') {
      window.dispatchEvent(new CustomEvent('pocket-avatar-step', { detail:{ distance:action === 'StepForward' ? 0.3 : -0.3 } }));
      return;
    }
    const tags = { Relax:'relax', Thinking:'think', Surprised:'surprised', Clapping:'clap', LookAround:'lookaround', Goodbye:'bye', Jump:'jump' };
    const actor = $('#mira-avatar')?.components?.['vrm-actor'];
    if (actor) actor.acionar(tags[action] || action);
  }

  function applySpatialState(scene) {
    const tray = $('#world-tray');
    const trayComponent = tray?.components?.['world-tray'];
    if (tray && scene.tray) {
      tray.object3D.position.fromArray(scene.tray.position || [-0.72, 0.5, -1.9]);
      tray.object3D.rotation.set(0, THREE.MathUtils.degToRad(scene.tray.rotation?.[1] || 0), 0);
      if (trayComponent) {
        trayComponent.setScale(scene.tray.scale ?? 0.72, false);
        trayComponent.setVisible(scene.tray.visible === true, false);
      } else {
        tray.object3D.scale.setScalar(scene.tray.scale ?? 0.72);
        tray.setAttribute('visible', scene.tray.visible === true);
      }
      $('#tray-toggle-btn').textContent = scene.tray.visible ? '隐藏托盘' : '显示托盘';
    }
    const avatar = $('#mira-avatar');
    if (avatar && scene.avatar) {
      avatar.object3D.position.fromArray(scene.avatar.position || [0.55, 0, -1.6]);
      avatar.object3D.position.y = 0;
      avatar.object3D.scale.setScalar(scene.avatar.scale ?? 0.72);
      avatar.setAttribute('visible', scene.avatar.visible !== false);
    }
  }
  function renderScene(scene) {
    const container = $('#world-objects');
    if (!container || !state.catalog) return;
    applySpatialState(scene);
    const current = new Map(Array.from(container.children).map((el) => [el.dataset.instanceId, el]));
    for (const object of scene.objects) {
      const asset = state.catalog.get(object.assetId);
      if (!asset) continue;
      let entity = current.get(object.instanceId);
      if (!entity) {
        entity = document.createElement('a-entity');
        entity.classList.add('scene-object', 'xr-grabbable', 'xr-raycastable');
        entity.dataset.instanceId = object.instanceId;
        entity.dataset.xrRole = 'object';
        entity.setAttribute('gltf-model', `url(${asset.file})`);
        container.appendChild(entity);
      }
      current.delete(object.instanceId);
      entity.setAttribute('position', object.position.join(' '));
      entity.setAttribute('rotation', object.rotation.join(' '));
      entity.setAttribute('scale', object.scale.join(' '));
      entity.classList.toggle('selected', object.instanceId === state.selected);
      if (object.color && entity.dataset.appliedColor !== object.color) {
        entity.dataset.appliedColor = object.color;
        entity.addEventListener('model-loaded', () => entity.object3D.traverse((node) => {
          if (node.material) { node.material = node.material.clone(); node.material.color.set(object.color); }
        }), { once:true });
      }
    }
    for (const entity of current.values()) entity.remove();
    $('#object-count').textContent = `${scene.objects.length} 个物件`;
    renderInspector(scene);
  }
  function renderInspector(scene) {
    const object = scene.objects.find((item) => item.instanceId === state.selected);
    $('#inspector-empty').hidden = !!object; $('#inspector-form').hidden = !object;
    if (!object) return;
    $('#inspector-name').textContent = state.catalog.get(object.assetId)?.name || object.assetId;
    $('#inspector-id').textContent = object.instanceId;
    ['position', 'rotation', 'scale'].forEach((key) => object[key].forEach((value, index) => { $(`#${key}-${index}`).value = Number(value).toFixed(2); }));
  }
  function renderCatalog(category = 'all') {
    const assets = category === 'all' ? state.catalog.assets : state.catalog.list({ category });
    $('#asset-grid').innerHTML = assets.map((asset) => `<button class="asset-card" data-asset="${asset.id}"><span class="asset-dot" style="--asset:${asset.color}"></span><strong>${escapeHtml(asset.name)}</strong><small>${escapeHtml(asset.category)}</small></button>`).join('');
    document.querySelectorAll('.asset-card').forEach((button) => button.addEventListener('click', () => {
      const asset = state.catalog.get(button.dataset.asset);
      const offset = ((state.store.scene.objects.length % 7) - 3) * 0.18;
      state.tools.execute({ tool:'place_asset', assetId:asset.id, instanceId:uniqueId(asset.id), position:[offset, 0.04, 0.25], scale:asset.defaultScale });
    }));
  }
  function handleLocalSpatialIntent(text) {
    if (/隐藏.*(托盘|场景)|(托盘|场景).*(关掉|取消|不要)/i.test(text)) {
      if (state.store.scene.tray.visible) toggleTray();
      speak('好，我把世界托盘收起来了。', 'neutral');
      return true;
    }
    if (/显示.*(托盘|场景)|(托盘|场景).*(打开|出来)/i.test(text)) {
      if (!state.store.scene.tray.visible) toggleTray();
      speak('好，世界托盘已经显示。', 'neutral');
      return true;
    }
    if (/角色归位|回到我面前|站到我面前/i.test(text)) {
      resetAvatarInFront();
      speak('好，我回到你面前了。', 'happy');
      return true;
    }
    return false;
  }
  async function runPrompt(text) {
    if (state.busy || !text.trim()) return;
    if (handleLocalSpatialIntent(text.trim())) return;
    state.busy = true; $('#send-btn').disabled = true; setUiState('思考中', `听到：${text.trim()}`);
    try {
      const result = await state.loop.run(text.trim());
      if (!result.ok) speak(`这次没有安全地完成：${result.code}。场景保持原样。`, 'sad');
      else addEvent({ at:new Date().toISOString(), tool:'action_summary', input:{ request:text.trim() }, result:{ ok:true, commands:result.plan.commands.length, objects:state.store.scene.objects.length } });
    } catch (error) {
      speak(`连接暂时不可用：${error.message}。`, 'sad');
    } finally {
      state.busy = false; $('#send-btn').disabled = false;
    }
  }

  function toggleTray() {
    state.store.mutate((scene) => { scene.tray.visible = !scene.tray.visible; }, { tool:'tray_visibility' });
    setXrStatus(state.store.scene.tray.visible ? '托盘已显示：射线指向托盘后按住 Grip 移动' : '托盘已隐藏；Mira 仍可以单独演示');
  }
  function resetAvatarInFront() {
    const camera = $('a-scene')?.camera;
    const position = new THREE.Vector3(0.55, 0, -1.6);
    if (camera) {
      const cameraPosition = new THREE.Vector3(); const direction = new THREE.Vector3();
      camera.getWorldPosition(cameraPosition); camera.getWorldDirection(direction); direction.y = 0;
      if (direction.lengthSq() > 0.001) position.copy(cameraPosition).addScaledVector(direction.normalize(), 1.6);
      position.y = 0;
    }
    state.store.mutate((scene) => { scene.avatar.position = [position.x, 0, position.z]; scene.avatar.visible = true; }, { tool:'avatar_reset' });
    setXrStatus('Mira 已归位到你面前 1.6 米');
  }
  async function ensureMediaStream() {
    if (state.mediaStream?.active) return state.mediaStream;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('MEDIA_CAPTURE_UNAVAILABLE');
    state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } });
    return state.mediaStream;
  }
  async function enterMR() {
    document.body.classList.add('entered');
    if (state.health?.services?.stt) ensureMediaStream().catch((error) => addEvent({ at:new Date().toISOString(), tool:'mic_permission', result:{ ok:false, code:error.name || error.message } }));
    const scene = $('a-scene');
    try {
      if (!scene?.is?.('vr-mode')) {
        if (scene?.enterAR) await scene.enterAR();
        else if (scene?.enterVR) await scene.enterVR(true);
        else throw new Error('WebXR entry unavailable');
      }
      $('#xr-hud').setAttribute('visible', true);
      setXrStatus('Grip抓取·摇杆调距离  A/X按住说话  B托盘  Y角色归位');
    } catch (error) {
      $('#xr-note').textContent = `无法进入 MR：${error.message}`;
    }
  }
  function bindUi() {
    $('#composer').addEventListener('submit', (event) => { event.preventDefault(); const input = $('#prompt'); const text = input.value; input.value = ''; runPrompt(text); });
    $('#demo-btn').addEventListener('click', () => runPrompt('在我面前搭一个治愈系小花园，有一棵树、一张长椅、两盏灯和一些花。'));
    $('#undo-btn').addEventListener('click', () => state.tools.execute({ tool:'undo' }));
    $('#save-btn').addEventListener('click', () => runPrompt('保持现在的位置，保存这个场景。'));
    $('#load-btn').addEventListener('click', () => state.tools.execute({ tool:'load_scene' }));
    $('#tray-reset-btn').addEventListener('click', () => window.dispatchEvent(new Event('pocket-tray-reset')));
    $('#tray-toggle-btn').addEventListener('click', toggleTray);
    $('#avatar-reset-btn').addEventListener('click', resetAvatarInFront);
    $('#clear-btn').addEventListener('click', () => state.tools.execute({ tool:'clear_scene' }));
    document.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => {
      document.querySelectorAll('[data-category]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active'); renderCatalog(button.dataset.category);
    }));
    $('#delete-object').addEventListener('click', () => { if (state.selected) state.tools.execute({ tool:'remove_asset', instanceId:state.selected }); state.selected = null; });
    $('#apply-transform').addEventListener('click', () => {
      if (!state.selected) return;
      for (const key of ['position', 'rotation', 'scale']) {
        const values = [0, 1, 2].map((index) => Number($(`#${key}-${index}`).value));
        state.tools.execute({ tool:key === 'position' ? 'move_asset' : key === 'rotation' ? 'rotate_asset' : 'scale_asset', instanceId:state.selected, [key]:values });
      }
    });
    $('#enter-btn').addEventListener('click', enterMR);
    $('#desktop-btn').addEventListener('click', () => document.body.classList.add('entered'));
    const mic = $('#mic-btn');
    mic.addEventListener('pointerdown', (event) => { event.preventDefault(); startVoice(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((name) => mic.addEventListener(name, stopVoice));

    const left = $('#lcontroller'); const right = $('#rcontroller');
    right?.addEventListener('abuttondown', startVoice); right?.addEventListener('abuttonup', stopVoice);
    left?.addEventListener('xbuttondown', startVoice); left?.addEventListener('xbuttonup', stopVoice);
    right?.addEventListener('bbuttondown', toggleTray); left?.addEventListener('ybuttondown', resetAvatarInFront);

    const avatar = $('#mira-avatar');
    avatar.addEventListener('model-error', () => {
      if (state.avatarFallback) return;
      state.avatarFallback = true; setUiState('切换备用模型'); avatar.removeAttribute('vrm-model');
      setTimeout(() => avatar.setAttribute('vrm-model', 'src:assets/avatars/AvatarSample_A.vrm'), 0);
    });
    window.addEventListener('pocket-select', (event) => { state.selected = event.detail.instanceId; renderScene(state.store.scene); });
    window.addEventListener('pocket-manual-transform', (event) => {
      const detail = event.detail;
      state.store.mutate((scene) => {
        const object = scene.objects.find((item) => item.instanceId === detail.instanceId);
        if (object) Object.assign(object, { position:detail.position, rotation:detail.rotation, scale:detail.scale });
      }, { tool:'manual_transform' });
      addEvent({ at:new Date().toISOString(), tool:'manual_transform', result:{ ok:true } });
    });
    window.addEventListener('pocket-tray-transform', (event) => state.store.mutate((scene) => Object.assign(scene.tray, event.detail), { tool:'tray_transform' }));
    window.addEventListener('pocket-avatar-transform', (event) => state.store.mutate((scene) => Object.assign(scene.avatar, event.detail), { tool:'avatar_transform' }));
    window.addEventListener('pocket-xr-feedback', (event) => setXrStatus(event.detail?.text));
    $('a-scene').addEventListener('exit-vr', () => $('#xr-hud').setAttribute('visible', false));
  }

  async function startVoice() {
    state.voiceHeld = true;
    if (state.recorder?.state === 'recording' || state.recognition || state.busy) return;
    if (state.health?.services?.stt && window.MediaRecorder) {
      try {
        const stream = await ensureMediaStream();
        const supported = typeof MediaRecorder.isTypeSupported === 'function';
        const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => !supported || MediaRecorder.isTypeSupported(type));
        const chunks = [];
        const recorder = new MediaRecorder(stream, preferred ? { mimeType:preferred } : undefined);
        state.recorder = recorder;
        recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type:recorder.mimeType || 'audio/webm' });
          state.recorder = null; $('#mic-btn').classList.remove('listening');
          if (blob.size < 600) setXrStatus('录音太短，请按住 A/X 说完再松开');
          else transcribe(blob);
        };
        recorder.start(); $('#mic-btn').classList.add('listening'); setUiState('正在听', '正在听……松开 A/X 后发送');
        if (!state.voiceHeld) recorder.stop();
        return;
      } catch (error) {
        addEvent({ at:new Date().toISOString(), tool:'stt_capture', result:{ ok:false, code:error.name || error.message } });
        setXrStatus(`麦克风启动失败：${error.name || error.message}`);
      }
    }
    startBrowserRecognition();
  }
  function stopVoice() {
    state.voiceHeld = false;
    if (state.recorder?.state === 'recording') state.recorder.stop();
    if (state.recognition) try { state.recognition.stop(); } catch { /* already stopping */ }
  }
  async function transcribe(blob) {
    setUiState('识别中', '正在转写语音……');
    try {
      const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
      const response = await fetch(`/api/stt?file=speech.${extension}`, { method:'POST', headers:{ 'content-type':blob.type || 'audio/webm' }, body:blob });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `STT_HTTP_${response.status}`);
      const text = String(data.text || '').trim();
      if (!text) throw new Error('STT_EMPTY_RESULT');
      setXrStatus(`你说：${text}`);
      runPrompt(text);
    } catch (error) {
      speak(`语音识别失败：${error.message}。请检查 STT 配置。`, 'sad');
    }
  }
  function startBrowserRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speak('这台 Quest 不支持浏览器语音识别，服务端 STT 也未连接。请在 .env 配置 STT_API_KEY 或 OPENAI_API_KEY 后重启。', 'sad');
      return;
    }
    const recognition = new SpeechRecognition();
    state.recognition = recognition; recognition.lang = 'zh-CN'; recognition.interimResults = false;
    $('#mic-btn').classList.add('listening'); setUiState('正在听', '正在听……');
    recognition.onresult = (event) => runPrompt(event.results[0][0].transcript);
    recognition.onerror = () => speak('没有收到语音，请再试一次。', 'neutral');
    recognition.onend = () => { state.recognition = null; $('#mic-btn').classList.remove('listening'); };
    recognition.start(); if (!state.voiceHeld) recognition.stop();
  }

  async function init() {
    try {
      state.catalog = await PocketWorld.AssetCatalog.load();
      state.store = new PocketWorld.SceneStore();
      state.tools = new PocketWorld.SceneToolRegistry({ catalog:state.catalog, store:state.store, onEvent:addEvent, onSpeak:speak, onAction:playAction });
      state.loop = new PocketWorld.AgentLoop({ planner, tools:state.tools, maxCommands:14, maxRepairs:2, onPhase:addEvent });
      state.store.subscribe(renderScene);
      bindUi();
      try { const saved = JSON.parse(localStorage.getItem('pocket-world.events.v1') || '[]'); if (Array.isArray(saved)) state.events = saved.slice(0, 60); } catch { /* invalid cache */ }
      renderEvents(); renderCatalog(); renderScene(state.store.scene);
      try {
        const response = await fetch('/api/health'); state.health = await response.json(); setMode(state.health.mode);
        if (!state.health.services?.stt) setXrStatus('A/X语音需要 STT 密钥；Grip 已可移动 Mira');
      } catch {
        state.health = { services:{ llm:false, stt:false, tts:false } }; setMode('replay');
      }
      try { state.store.load(); } catch { /* invalid local save must not block startup */ }
    } catch (error) {
      $('#boot-error').hidden = false; $('#boot-error').textContent = `启动失败：${error.message}`;
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
