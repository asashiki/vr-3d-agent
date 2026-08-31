/**
 * studio.js — Incarna Studio: the single place to configure & test.
 *   Roster  — bind an OpenClaw agent to an avatar + voice + seat (saves agents.local.json)
 *   Avatars — preview/upload VRM avatars, test emotions & every VRMA
 *   Actions — curate/test the body-action catalog
 */
(function () {
  const K = new URL(location.href).searchParams.get('k') || '';
  const withK = (u) => (K ? u + (u.includes('?') ? '&' : '?') + 'k=' + encodeURIComponent(K) : u);
  const $ = (s) => document.querySelector(s);
  const msg = (t) => { $('#msg').textContent = t || ''; };
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function actor() { const el = $('#stage-avatar'); return (el && el.components && el.components['vrm-actor']) || null; }
  function setStage(src) { if (src) $('#stage-avatar').setAttribute('vrm-model', 'src: ' + src); }
  function fileToB64(f) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(f); }); }

  // ---- state ----
  let config = { office: { seats: {} }, agents: [], writable: false, source: '' };
  let roster = [];         // working copy of agents
  let actions = [];        // action catalog
  let assets = { avatars: [], vrmas: [] };
  let brains = [];         // live OpenClaw agent ids
  let voices = [];         // ElevenLabs voices
  let editingIndex = null;

  // ================= boot =================
  async function boot() {
    const get = async (u, d) => { try { return await (await fetch(withK(u))).json(); } catch { return d; } };
    config = await get('/api/config', config);
    roster = JSON.parse(JSON.stringify(config.agents || []));
    actions = (await get('/api/actions', { actions: [] })).actions || [];
    assets = await get('/api/assets', assets);
    brains = (await get('/api/openclaw-agents', { agents: [] })).agents || [];
    voices = (await get('/api/voices', { voices: [] })).voices || [];

    const first = roster[0] && roster[0].avatar;
    setStage(first || (assets.avatars[0] && assets.avatars[0].path) || 'assets/avatars/vrm_girl.vrm');

    initTabs();
    renderRoster();
    initForm();
    initAvatarsTab();
    initActionsTab();
    if (!config.writable) {
      msg('⚠️ read-only — start the server with ALLOW_DEV_WRITES=true to save');
      $('#save-office').disabled = true; $('#save-actions').disabled = true;
    }
  }

  function initTabs() {
    document.querySelectorAll('#tabs button').forEach((b) => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#tabs button').forEach((x) => x.classList.remove('on'));
        document.querySelectorAll('.tab').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        $('#tab-' + b.dataset.tab).classList.add('on');
      });
    });
  }

  // ================= ROSTER =================
  function voiceName(id) { const v = voices.find((x) => x.voice_id === id); return v ? v.name : (id ? id.slice(0, 8) + '…' : '—'); }

  function renderRoster() {
    const box = $('#roster-list');
    if (!roster.length) { box.innerHTML = '<div class="hint">No agents yet. Add one below.</div>'; return; }
    box.innerHTML = '';
    roster.forEach((a, i) => {
      const card = document.createElement('div');
      card.className = 'rcard';
      card.innerHTML =
        `<div class="em">${esc(a.emoji || '🤖')}</div>` +
        `<div><div class="nm">${esc(a.name || a.id)}</div>` +
        `<div class="meta">🧠 ${esc(a.brain)} · 🗣️ ${esc(voiceName(a.voice))} · 🪑 ${esc(a.seat || 'center')}<br>` +
        `${esc((a.avatar || '').split('/').pop())}</div></div>` +
        `<div class="acts"><button class="b ghost edit">edit</button><button class="b danger rm">✕</button></div>`;
      card.querySelector('.edit').onclick = () => editAgent(i);
      card.querySelector('.rm').onclick = () => { roster.splice(i, 1); renderRoster(); if (editingIndex === i) clearForm(); };
      box.appendChild(card);
    });
  }

  function fillSelect(sel, items, value) {
    // items: [{v,label}]; ensure `value` is present even if not in list
    const has = items.some((it) => it.v === value);
    if (value && !has) items = [{ v: value, label: value + ' (current)' }].concat(items);
    sel.innerHTML = items.map((it) => `<option value="${esc(it.v)}"${it.v === value ? ' selected' : ''}>${esc(it.label)}</option>`).join('');
  }

  function initForm() {
    // static option sources
    const brainItems = () => brains.map((b) => ({ v: b, label: b }));
    const avatarItems = () => assets.avatars.map((a) => ({ v: a.path, label: a.name }));
    const voiceItems = () => voices.map((v) => ({ v: v.voice_id, label: `${v.name}${v.category ? ' · ' + v.category : ''}` }));
    const seatItems = () => Object.keys(config.office.seats || { center: 1 }).map((s) => ({ v: s, label: s }));

    fillSelect($('#f-brain'), brainItems(), '');
    fillSelect($('#f-avatar'), avatarItems(), '');
    fillSelect($('#f-voice'), voiceItems(), '');
    fillSelect($('#f-seat'), seatItems(), 'center');

    // auto-fill id/name from the chosen brain (only when empty)
    $('#f-brain').addEventListener('change', () => {
      const b = $('#f-brain').value;
      if (!$('#f-id').value) $('#f-id').value = b;
      if (!$('#f-name').value) $('#f-name').value = b.charAt(0).toUpperCase() + b.slice(1);
    });

    $('#f-avatar-prev').onclick = () => setStage($('#f-avatar').value);
    $('#f-avatar-up').onclick = async () => {
      const p = await upload('avatar', $('#f-avatar-file'));
      if (p) { fillSelect($('#f-avatar'), avatarItems(), p); setStage(p); }
    };
    $('#f-voice-prev').onclick = () => previewVoice($('#f-voice').value);
    $('#f-add').onclick = addOrUpdate;
    $('#f-clear').onclick = clearForm;
    $('#save-office').onclick = saveOffice;
  }

  function readForm() {
    return {
      id: $('#f-id').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
      name: $('#f-name').value.trim(),
      emoji: $('#f-emoji').value.trim() || '🤖',
      brain: $('#f-brain').value,
      avatar: $('#f-avatar').value,
      voice: $('#f-voice').value,
      seat: $('#f-seat').value,
      tone: $('#f-tone').value.trim(),
      desc: $('#f-desc').value.trim(),
    };
  }

  function addOrUpdate() {
    // merge over the existing entry when editing, so advanced fields (phrases, scale) survive
    const base = editingIndex !== null ? roster[editingIndex] : {};
    const a = Object.assign({}, base, readForm());
    if (!a.id) { msg('give the agent an id'); return; }
    if (!a.brain) { msg('pick an OpenClaw agent'); return; }
    if (!a.avatar) { msg('pick an avatar'); return; }
    const dupe = roster.findIndex((x) => x.id === a.id);
    if (editingIndex === null && dupe >= 0) { msg(`id "${a.id}" already exists`); return; }
    if (editingIndex !== null) roster[editingIndex] = a; else roster.push(a);
    renderRoster(); clearForm();
    msg('added — remember to 💾 Save office');
  }

  function editAgent(i) {
    const a = roster[i];
    editingIndex = i;
    fillSelect($('#f-brain'), brains.map((b) => ({ v: b, label: b })), a.brain);
    $('#f-id').value = a.id; $('#f-name').value = a.name || ''; $('#f-emoji').value = a.emoji || '🤖';
    fillSelect($('#f-avatar'), assets.avatars.map((x) => ({ v: x.path, label: x.name })), a.avatar);
    fillSelect($('#f-voice'), voices.map((v) => ({ v: v.voice_id, label: `${v.name}${v.category ? ' · ' + v.category : ''}` })), a.voice);
    fillSelect($('#f-seat'), Object.keys(config.office.seats || { center: 1 }).map((s) => ({ v: s, label: s })), a.seat || 'center');
    $('#f-tone').value = a.tone || ''; $('#f-desc').value = a.desc || '';
    setStage(a.avatar);
    $('#form-title').textContent = 'Edit agent'; $('#f-add').textContent = 'update';
    $('#panel').scrollTop = $('#panel').scrollHeight;
  }

  function clearForm() {
    editingIndex = null;
    ['f-id', 'f-name', 'f-emoji', 'f-tone', 'f-desc'].forEach((id) => { $('#' + id).value = ''; });
    $('#form-title').textContent = 'Add agent'; $('#f-add').textContent = '+ add to office';
  }

  async function saveOffice() {
    if (!roster.length) { msg('add at least one agent'); return; }
    msg('saving office…');
    try {
      const r = await fetch(withK('/api/config'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ office: config.office, agents: roster }) });
      const d = await r.json();
      if (d.ok) { msg(`✅ saved ${d.agents} agents to agents.local.json`); config.agents = JSON.parse(JSON.stringify(roster)); }
      else msg('⚠️ ' + (d.error || 'failed'));
    } catch (e) { msg('⚠️ ' + e.message); }
  }

  async function previewVoice(voiceId) {
    if (!voiceId) return;
    msg('playing voice preview…');
    try {
      const r = await fetch(withK('/api/tts'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Olá! Eu sou seu agente aqui no Incarna.', voiceId }) });
      const d = await r.json();
      if (d.audioBase64) { new Audio('data:audio/mpeg;base64,' + d.audioBase64).play(); msg(''); }
      else msg('⚠️ ' + (d.detail || 'no voice (check ElevenLabs key)'));
    } catch (e) { msg('⚠️ ' + e.message); }
  }

  // ================= AVATARS tab =================
  function initAvatarsTab() {
    const avatarItems = () => assets.avatars.map((a) => ({ v: a.path, label: a.name }));
    fillSelect($('#a-sel'), avatarItems(), (roster[0] && roster[0].avatar) || '');
    $('#a-load').onclick = () => setStage($('#a-sel').value);
    $('#a-up').onclick = async () => { const p = await upload('avatar', $('#a-file')); if (p) { fillSelect($('#a-sel'), avatarItems(), p); setStage(p); } };

    const emos = $('#emos'); emos.innerHTML = '';
    ['happy', 'angry', 'sad', 'surprised', 'relaxed'].forEach((e) => {
      const b = document.createElement('button'); b.textContent = e;
      b.onclick = () => { const a = actor(); if (a) a.setEmocao(e); }; emos.appendChild(b);
    });
    $('#idle').onclick = () => { const a = actor(); if (a) a.idle(); };
    $('#neutral').onclick = () => { const a = actor(); if (a) a.setEmocao(null); };

    renderVrmas();
    $('#vrma-up').onclick = async () => { const p = await upload('vrma', $('#vrma-file')); if (p) renderVrmas(); };
  }

  function renderVrmas() {
    const used = new Set(actions.filter((a) => a.vrma).map((a) => a.vrma));
    const box = $('#vrmas'); box.innerHTML = '';
    if (!assets.vrmas.length) { box.innerHTML = '<div class="hint">No .vrma files found.</div>'; return; }
    assets.vrmas.forEach((v) => {
      const tag = actions.find((a) => a.vrma === v.name);
      const row = document.createElement('div'); row.className = 'vrow';
      row.innerHTML = `<span>${esc(v.name)}</span><span class="map ${used.has(v.name) ? 'used' : ''}">${tag ? '→ [' + esc(tag.tag) + ']' : 'unmapped'}</span><button class="b cyan" style="padding:5px 9px">▶</button>`;
      row.querySelector('button').onclick = async () => { const a = actor(); if (a) { const res = await a.acionar(v.name); if (res && !res.ok) msg(v.name + ': ' + res.reason); } };
      box.appendChild(row);
    });
  }

  // ================= ACTIONS tab =================
  function initActionsTab() {
    fillSelect($('#na-vrma'), assets.vrmas.map((v) => ({ v: v.name, label: v.name })), '');
    $('#na-vrma').insertAdjacentHTML('afterbegin', '<option value="">(face only)</option>');
    renderRows();
    $('#na-add').onclick = () => {
      const tag = $('#na-tag').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!tag) { msg('give the action a tag'); return; }
      if (actions.some((a) => a.tag === tag)) { msg(`tag "${tag}" already exists`); return; }
      const entry = { tag, status: 'untested' };
      const vrma = $('#na-vrma').value; if (vrma) entry.vrma = vrma;
      const face = $('#na-face').value; if (face) entry.face = face;
      actions.push(entry); $('#na-tag').value = '';
      renderRows(); renderVrmas(); msg(`added "${tag}" — test it, then Save`);
    };
    $('#save-actions').onclick = async () => {
      msg('saving…');
      try {
        const r = await fetch(withK('/api/actions'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actions }) });
        const d = await r.json(); msg(d.ok ? '✅ saved to actions.json' : ('⚠️ ' + (d.error || 'failed')));
      } catch (e) { msg('⚠️ ' + e.message); }
    };
  }

  function renderRows() {
    const rows = $('#rows'); rows.innerHTML = '';
    actions.forEach((act, i) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML =
        `<button class="play">▶ ${esc(act.tag)}</button>` +
        `<div><div class="tag">${esc(act.tag)}</div><div class="desc">${esc(act.desc || act.vrma || 'face only')}</div>` +
        `<input class="note" placeholder="note…" value="${esc(act.note || '')}"></div>` +
        `<select><option value="ok">ok</option><option value="untested">untested</option><option value="broken">broken</option></select>`;
      const sel = row.querySelector('select'); sel.value = act.status || 'untested';
      sel.onchange = () => { actions[i].status = sel.value; };
      row.querySelector('.note').oninput = (e) => { actions[i].note = e.target.value; };
      row.querySelector('.play').onclick = async () => {
        const a = actor(); if (!a) { row.className = 'row fail'; return; }
        const res = await a.acionar(act.tag);
        row.className = 'row ' + (res && res.ok ? 'pass' : 'fail');
        if (res && !res.ok) msg(`${act.tag}: ${res.reason}`);
      };
      rows.appendChild(row);
    });
  }

  // ================= shared upload =================
  async function upload(kind, input) {
    const file = input.files && input.files[0];
    if (!file) { msg('pick a file first'); return null; }
    msg('uploading ' + file.name + '…');
    try {
      const dataBase64 = await fileToB64(file);
      const r = await fetch(withK('/api/upload'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name: file.name, dataBase64 }) });
      const d = await r.json();
      if (!d.ok) { msg('⚠️ ' + (d.error || 'upload failed')); return null; }
      assets = await (await fetch(withK('/api/assets'))).json();
      msg('✅ uploaded ' + d.path);
      return kind === 'avatar' ? d.path : d.name;
    } catch (e) { msg('⚠️ ' + e.message); return null; }
  }

  boot();
})();
