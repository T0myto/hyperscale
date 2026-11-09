'use strict';
/* =========================================================
   Hyperscale — rendu des notes de cours (Markdown Obsidian) :
   titres, listes, tableaux, code, encadrés (callouts), images et schémas Mermaid
   ========================================================= */
const MD_CALLOUT = {
  retenir: ['⭐', 'À retenir', 'gold'], tip: ['💡', 'Astuce', 'green'], success: ['✅', 'Réponse', 'green'], info: ['ℹ️', 'Info', 'blue'],
  note: ['📝', 'Note', 'blue'], abstract: ['📋', 'Résumé', 'blue'], question: ['❓', 'Question', 'blue'], warning: ['⚠️', 'Attention', 'orange'],
  danger: ['⛔', 'Danger', 'red'], example: ['🧩', 'Exemple', 'violet'], tp: ['🧪', 'TP', 'violet'], capture: ['🖼️', 'Capture', 'grey'],
  correction: ['✏️', 'Correction', 'orange'], lab: ['🧪', 'Lab', 'violet'], memo: ['📋', 'Mémo', 'blue'],
};
function mdInline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s);
  s = s.replace(/!\[\[([^\]|\\]+?)(?:\\?\|(\d+))?\]\]/g, (m, f, w) => `<img src="cours/img/${encodeURIComponent(f.trim())}" alt="" loading="lazy"${w ? ` style="width:${w}px"` : ''}>`);
  s = s.replace(/\[\[([^\]|#\\]+)(?:#[^\]|\\]*)?(?:\\?\|([^\]]+))?\]\]/g, (m, t, a) => `<span class="wl" title="Note du vault : ${t.trim()}">${(a || t).trim()}</span>`);
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<i>$2</i>').replace(/==(.+?)==/g, '<mark>$1</mark>');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${esc(codes[+i])}</code>`);
}
const MD_LIST = /^\s*([-*+]|\d+[.)])\s+/;
function mdList(lines) {
  const items = [];
  for (const l of lines) {
    const m = l.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (m) items.push({ ind: m[1].replace(/\t/g, '    ').length, ord: /\d/.test(m[2]), text: m[3] });
    else if (items.length) items[items.length - 1].text += ' ' + l.trim();
  }
  let html = '';
  const stack = [];
  for (const it of items) {
    while (stack.length > 1 && it.ind < stack[stack.length - 1].ind) html += `</li></${stack.pop().tag}>`;
    if (!stack.length || it.ind > stack[stack.length - 1].ind) { const tag = it.ord ? 'ol' : 'ul'; stack.push({ ind: it.ind, tag }); html += `<${tag}>`; }
    else html += '</li>';
    let t = it.text, box = '';
    const tm = t.match(/^\[([ xX])\]\s+(.*)$/); if (tm) { box = tm[1] === ' ' ? '☐ ' : '☑ '; t = tm[2]; }
    html += `<li>${box}${mdInline(t)}`;
  }
  while (stack.length) html += `</li></${stack.pop().tag}>`;
  return html;
}
function mdQuote(lines) {
  const m = lines[0].match(/^\[!([\w-]+)\]([-+]?)\s*(.*)$/);
  const body = mdRender(lines.slice(m ? 1 : 0).join('\n'));
  if (!m) return `<blockquote>${body}</blockquote>`;
  const C = MD_CALLOUT[m[1].toLowerCase()] || ['📌', '', 'blue'];
  const head = `<span class="coi">${C[0]}</span> ${m[3] ? mdInline(m[3]) : C[1]}`;
  return m[2] === '-' ? `<details class="co co-${C[2]}"><summary>${head}</summary>${body}</details>` : `<div class="co co-${C[2]}"><div class="cot">${head}</div>${body}</div>`;
}
// Cellules d'un tableau : « \| » est un trait vertical échappé, pas un séparateur
const mdCells = r => r.trim().replace(/^\|/, '').replace(/\|\s*$/, '').replace(/\\\|/g, '\u0001').split('|').map(c => c.replace(/\u0001/g, '|').trim());
function mdRender(src) {
  const L = src.replace(/\r/g, '').split('\n'), out = [];
  let i = 0;
  const blockStart = l => /^(```|#{1,6}\s|\s*>|\s*\|)/.test(l) || MD_LIST.test(l) || /^(-{3,}|\*{3,})\s*$/.test(l);
  while (i < L.length) {
    const l = L[i];
    let m;
    if (!l.trim()) { i++; continue; }
    if ((m = l.match(/^\s*```\s*([\w-]*)/))) {
      const buf = []; i++;
      while (i < L.length && !/^\s*```/.test(L[i])) buf.push(L[i++]);
      i++;
      out.push(m[1] === 'mermaid' ? `<div class="mmd">${esc(buf.join('\n'))}</div>` : `<pre class="cb">${esc(buf.join('\n'))}</pre>`);
      continue;
    }
    if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { const n = Math.min(6, m[1].length + 2); out.push(`<h${n}>${mdInline(m[2])}</h${n}>`); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (/^\s*>/.test(l)) {
      const buf = [];
      while (i < L.length && /^\s*>/.test(L[i])) buf.push(L[i++].replace(/^\s*> ?/, ''));
      out.push(mdQuote(buf));
      continue;
    }
    if (/^\s*\|/.test(l) && /^\s*\|?\s*:?-{2,}/.test(L[i + 1] || '')) {
      const head = mdCells(l); i += 2;
      const rows = [];
      while (i < L.length && /^\s*\|/.test(L[i])) rows.push(mdCells(L[i++]));
      out.push(`<div class="tw"><table><thead><tr>${head.map(c => `<th>${mdInline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${mdInline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (MD_LIST.test(l)) {
      const buf = [];
      while (i < L.length && (MD_LIST.test(L[i]) || (/^\s{2,}\S/.test(L[i]) && !/^\s*(```|>|\|)/.test(L[i])))) buf.push(L[i++]);
      out.push(mdList(buf));
      continue;
    }
    const buf = [];
    do buf.push(L[i++]); while (i < L.length && L[i].trim() && !blockStart(L[i]));
    out.push(`<p>${buf.map(mdInline).join('<br>')}</p>`);
  }
  return out.join('\n');
}
// Schémas Mermaid : la bibliothèque se charge à la première fiche qui en contient un.
// Hors ligne, le schéma reste affiché sous forme de texte.
let mermaidLoad = null;
function mdDiagrams(root) {
  const nodes = [...root.querySelectorAll('.mmd:not([data-processed])')];
  if (!nodes.length) return;
  if (!mermaidLoad) mermaidLoad = new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';
    s.onload = () => { window.mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict', fontFamily: 'Nunito, sans-serif' }); ok(); };
    s.onerror = ko;
    document.head.appendChild(s);
  });
  mermaidLoad.then(() => window.mermaid.run({ nodes: nodes.filter(n => n.isConnected) })).catch(() => nodes.forEach(n => n.classList.add('off')));
}
