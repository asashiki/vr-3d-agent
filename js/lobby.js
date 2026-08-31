/**
 * lobby — the "Your office" home hub. Shows the agents you configured, a live
 * "incarnate" swap per avatar, an "add agent" shortcut to the Studio, and a
 * single Enter (immersion) button. After entering, you pick who to talk to by
 * looking at them.
 */
(function () {
  const K = new URL(location.href).searchParams.get('k') || '';
  const withK = (url) => (K ? url + (url.includes('?') ? '&' : '?') + 'k=' + encodeURIComponent(K) : url);

  const lobby = document.getElementById('lobby');
  const roster = document.getElementById('roster');
  const enterBtn = document.getElementById('enter-btn');
  const note = document.getElementById('lobby-note');
  const studioLink = document.getElementById('studio-link');
  if (studioLink) studioLink.href = withK('studio.html');

  window.qmaOpenLobby = () => lobby.classList.remove('hidden');

  (async function () {
    let agents = [];
    try {
      const office = await (await fetch(withK('/api/office'))).json();
      agents = office.agents || [];
    } catch (e) {
      roster.textContent = 'Failed to load agents: ' + e.message;
      return;
    }

    // empty state: guide the first-time user into the Studio
    if (!agents.length) {
      roster.innerHTML =
        '<div class="empty-hub">' +
          '<div class="empty-emoji">🎭</div>' +
          '<p>No agents in your office yet.</p>' +
          `<a class="lobby-secondary" href="${withK('studio.html')}">🛠️ Set up your first agent</a>` +
        '</div>';
      enterBtn.disabled = true;
      note.textContent = 'Bind an OpenClaw agent to an avatar in the Studio, then come back.';
      return;
    }

    let brains = [];
    try { brains = (await (await fetch(withK('/api/openclaw-agents'))).json()).agents || []; } catch (e) { /* offline */ }

    roster.innerHTML = '';
    for (const a of agents) {
      const card = document.createElement('div');
      card.className = 'roster-card';
      const chosen = localStorage.getItem('incarna:brain:' + a.id) || a.brain || '';
      const opts = [...new Set([a.brain, ...brains].filter(Boolean))];
      const options = opts.map((b) => `<option value="${b}"${b === chosen ? ' selected' : ''}>${b}</option>`).join('');
      card.innerHTML =
        `<span class="roster-emoji">${a.emoji || '🤖'}</span>` +
        `<span class="roster-name">${a.name}</span>` +
        `<span class="roster-desc">${a.desc || ''}</span>` +
        `<span class="roster-meta">🪑 ${a.seat || 'center'}</span>` +
        (opts.length ? `<label class="brain-pick">incarnar<select data-avatar="${a.id}">${options}</select></label>` : '');
      roster.appendChild(card);
    }
    // "add agent" card -> Studio
    const add = document.createElement('a');
    add.className = 'roster-card add';
    add.href = withK('studio.html');
    add.innerHTML = '<span class="add-plus">＋</span><span class="roster-desc">Add agent</span>';
    roster.appendChild(add);

    roster.querySelectorAll('select[data-avatar]').forEach((sel) => {
      sel.addEventListener('change', () => localStorage.setItem('incarna:brain:' + sel.dataset.avatar, sel.value));
    });
    note.textContent = agents.length > 1
      ? 'Look at an avatar to talk to them. Hold the mic (or grip) to speak.'
      : 'Hold the mic button (or a controller trigger) to speak.';
  })();

  enterBtn.addEventListener('click', async () => {
    lobby.classList.add('hidden');
    if (window.qmaStart) await window.qmaStart();
    const scene = document.querySelector('a-scene');
    if (scene && scene.enterVR) { scene.enterVR(true).catch(() => {}); }
  });
})();
