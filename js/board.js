/**
 * board.js — "The Board": a floating panel the agent can fill with markdown.
 *
 * The agent appends a block to its reply:
 *   <<<incarna:panel
 *   # Title
 *   ...markdown...
 *   >>>
 * voice-chat extracts it (out of the spoken text) and calls window.qmaBoard.show(md).
 * The Board is a shared, in-place visualization area: draggable, expandable,
 * closable, and it remembers its position. Everything stays in the project layer.
 */
(function () {
  const LS_POS = 'incarna:board:pos';
  let el, body, titleEl, lastMd = '';

  function build() {
    el = document.createElement('div');
    el.id = 'board';
    el.className = 'hidden';
    el.innerHTML =
      '<div id="board-head">' +
        '<span id="board-title">📋 Board</span>' +
        '<span class="board-actions">' +
          '<button id="board-expand" type="button" title="Expand">⤢</button>' +
          '<button id="board-close" type="button" title="Close">✕</button>' +
        '</span>' +
      '</div>' +
      '<div id="board-body"></div>';
    document.body.appendChild(el);
    body = el.querySelector('#board-body');
    titleEl = el.querySelector('#board-title');
    el.querySelector('#board-close').addEventListener('click', () => el.classList.add('hidden'));
    el.querySelector('#board-expand').addEventListener('click', () => el.classList.toggle('expanded'));
    makeDraggable(el, el.querySelector('#board-head'));
    restorePos();
  }

  function restorePos() {
    try {
      const p = JSON.parse(localStorage.getItem(LS_POS) || 'null');
      if (p && typeof p.left === 'number') { el.style.left = p.left + 'px'; el.style.top = p.top + 'px'; el.style.right = 'auto'; }
    } catch { /* default position from CSS */ }
  }
  function savePos(left, top) {
    try { localStorage.setItem(LS_POS, JSON.stringify({ left, top })); } catch { /* private mode */ }
  }

  function makeDraggable(box, handle) {
    let dragging = false, dx = 0, dy = 0;
    handle.style.cursor = 'move';
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true;
      const r = box.getBoundingClientRect();
      dx = e.clientX - r.left; dy = e.clientY - r.top;
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const maxL = window.innerWidth - 60, maxT = window.innerHeight - 40;
      const left = Math.min(Math.max(0, e.clientX - dx), maxL);
      const top = Math.min(Math.max(0, e.clientY - dy), maxT);
      box.style.left = left + 'px'; box.style.top = top + 'px'; box.style.right = 'auto';
    });
    const end = (e) => { if (dragging) { dragging = false; const r = box.getBoundingClientRect(); savePos(r.left, r.top); } };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  window.qmaBoard = {
    show: function (md, opts) {
      if (!el) build();
      lastMd = String(md || '');
      body.innerHTML = window.mdToHtml ? window.mdToHtml(lastMd) : lastMd;
      const m = lastMd.match(/^#\s+(.+)$/m);
      titleEl.textContent = '📋 ' + (m ? m[1].trim() : 'Board');
      if (opts && opts.accent) el.style.setProperty('--accent', opts.accent);
      el.classList.remove('hidden');
      body.scrollTop = 0;
    },
    hide: function () { if (el) el.classList.add('hidden'); },
    toggle: function () {
      if (!el) build();
      if (!lastMd) return; // nothing to show yet
      el.classList.toggle('hidden');
    },
    has: function () { return !!lastMd; },
  };
})();
