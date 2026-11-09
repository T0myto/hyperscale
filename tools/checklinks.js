const fs = require('fs'), path = require('path');
const root = process.argv[2];
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { if (f === '.obsidian') continue; const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else files.push(path.relative(root, p).split(path.sep).join('/')); } })(root);
const names = new Set(files);
const base = new Set(files.map(f => f.split('/').pop()));
let bad = 0, n = 0;
for (const f of files.filter(f => f.endsWith('.md'))) {
  const t = fs.readFileSync(path.join(root, f), 'utf8');
  for (const m of t.matchAll(/\[\[([^\]|#]+?)(?:\\?\|[^\]]*)?\]\]/g)) {
    n++;
    const tg = m[1].replace(/\\$/, '');
    if (!names.has(tg + '.md') && !names.has(tg) && !base.has(tg) && !base.has(tg + '.md')) { bad++; console.log('LIEN CASSÉ', f, '->', tg); }
  }
}
console.log(`${files.length} fichiers, ${n} liens vérifiés, ${bad} cassé(s)`);
