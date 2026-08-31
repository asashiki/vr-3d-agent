/**
 * md.js — a tiny, SAFE Markdown -> HTML renderer (no dependencies).
 *
 * Everything is HTML-escaped FIRST, then a limited set of Markdown constructs is
 * turned into tags. The agent's output is semi-trusted, so we never emit raw HTML
 * or scripts from it, and links are restricted to http(s)/mailto.
 *
 * Supports: headings, bold/italic/inline-code, code fences, links, unordered &
 * ordered lists, GitHub-style tables, blockquotes, horizontal rules, paragraphs.
 *
 * Pure string -> string, so it runs in the browser (window.mdToHtml) and in Node
 * (module.exports) for tests.
 */
(function () {
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // inline formatting — input is ALREADY escaped
  function inline(s) {
    s = s.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^_])_([^_\s][^_]*)_/g, '$1<em>$2</em>');
    // links: [text](url) — only safe schemes
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
      (m, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
    return s;
  }

  function mdToHtml(src) {
    const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    let html = '';
    let inCode = false, codeBuf = [];
    let listType = null, listBuf = [];

    function flushList() {
      if (!listType) return;
      html += `<${listType}>` + listBuf.map((li) => `<li>${inline(esc(li))}</li>`).join('') + `</${listType}>`;
      listType = null; listBuf = [];
    }

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];

      if (/^```/.test(ln)) {
        if (inCode) { html += `<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`; inCode = false; codeBuf = []; }
        else { flushList(); inCode = true; }
        continue;
      }
      if (inCode) { codeBuf.push(ln); continue; }

      // GitHub table: header row + separator row of dashes
      if (/^\s*\|(.+)\|\s*$/.test(ln) && i + 1 < lines.length
        && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
        flushList();
        const parseRow = (r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
        const head = parseRow(ln);
        i++; // skip separator
        const rows = [];
        while (i + 1 < lines.length && /^\s*\|(.+)\|\s*$/.test(lines[i + 1])) { i++; rows.push(parseRow(lines[i])); }
        html += '<table><thead><tr>' + head.map((h) => `<th>${inline(esc(h))}</th>`).join('') + '</tr></thead><tbody>'
          + rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(esc(c))}</td>`).join('') + '</tr>').join('')
          + '</tbody></table>';
        continue;
      }

      const h = ln.match(/^(#{1,6})\s+(.*)$/);
      if (h) { flushList(); const lvl = h[1].length; html += `<h${lvl}>${inline(esc(h[2]))}</h${lvl}>`; continue; }

      if (/^\s*([-*_])\1\1+\s*$/.test(ln)) { flushList(); html += '<hr>'; continue; }

      const q = ln.match(/^>\s?(.*)$/);
      if (q) { flushList(); html += `<blockquote>${inline(esc(q[1]))}</blockquote>`; continue; }

      const ul = ln.match(/^\s*[-*+]\s+(.*)$/);
      const ol = ln.match(/^\s*\d+\.\s+(.*)$/);
      if (ul) { if (listType && listType !== 'ul') flushList(); listType = 'ul'; listBuf.push(ul[1]); continue; }
      if (ol) { if (listType && listType !== 'ol') flushList(); listType = 'ol'; listBuf.push(ol[1]); continue; }

      if (/^\s*$/.test(ln)) { flushList(); continue; }

      flushList();
      html += `<p>${inline(esc(ln))}</p>`;
    }

    if (inCode) html += `<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`;
    flushList();
    return html;
  }

  if (typeof window !== 'undefined') window.mdToHtml = mdToHtml;
  if (typeof module !== 'undefined') module.exports = mdToHtml;
})();
