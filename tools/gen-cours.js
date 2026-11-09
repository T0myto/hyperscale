// Embarque dans le jeu les notes de cours du vault cours-sisr-main qui correspondent à chaque fiche.
// Usage : node tools/gen-cours.js "<dossier du vault cours-sisr-main>"
// Écrit dc/cours.js (texte Markdown des notes) et copie les images utilisées dans cours/img/.
const fs = require('fs'), path = require('path');
const COURSE = process.argv[2];
if (!COURSE || !fs.existsSync(COURSE)) { console.error('Usage : node tools/gen-cours.js "<dossier du vault cours-sisr-main>"'); process.exit(1); }
const GAME = path.join(__dirname, '..');

// Fiche du jeu → notes du cours qui la traitent. Les fiches propres au datacenter
// (baie, froid, salle, onduleur) n'ont pas de note correspondante dans le cours.
const MAP = {
  elec: ['Réseaux/4 - Exploitation/Architectures réseau.md'],
  cuivre: ['Réseaux/1 - Fondamentaux/Câblage fibre SFP et PoE.md'],
  switch: ["Réseaux/1 - Fondamentaux/Fonctionnement d'un switch.md", 'Réseaux/Cisco - VLAN STP VTP.md'],
  virtu: ['Systèmes/Virtualisation.md'],
  ip: ['Réseaux/1 - Fondamentaux/Adressage IPv4 et sous-réseaux.md', 'Aide-mémoire/Aide-mémoire - Sous-réseaux et chiffres.md'],
  raid: ['Systèmes/Linux/Linux - RAID.md'],
  recette: ['Réseaux/4 - Exploitation/Outils réseau nmap tcpdump iperf3 mtr.md'],
  fibre: ['Réseaux/1 - Fondamentaux/Câblage fibre SFP et PoE.md'],
  pf: ['Réseaux/3 - Sécurité/Pare-feu et DMZ.md'],
  ports: ['Réseaux/1 - Fondamentaux/TCP UDP et protocoles essentiels.md'],
  tls: ['Réseaux/3 - Sécurité/Cryptographie PKI et TLS.md'],
  dep: ['Réseaux/4 - Exploitation/Méthode de dépannage réseau.md'],
  sup: ['Réseaux/4 - Exploitation/Supervision SNMP Syslog NTP.md'],
  bak: ['Systèmes/Linux/Sauvegardes.md'],
  l2sec: ['Réseaux/3 - Sécurité/Sécurité de niveau 2.md'],
  archi: ['Réseaux/4 - Exploitation/Architectures réseau.md', 'Réseaux/2 - Commutation et routage/EtherChannel et LACP.md'],
  attaques: ['Réseaux/3 - Sécurité/Durcissement et recommandations ANSSI.md'],
  acl: ['Réseaux/Cisco - ACL NAT Sécurité.md'],
  ad: ['Systèmes/Windows/Windows Server 2022 - Active Directory.md'],
  k8s: ['Cloud/Kubernetes - Introduction.md', 'Docker/Docker - Cours.md'],
};

// Toutes les images du vault, par nom de fichier (Obsidian les retrouve où qu'elles soient)
const images = {};
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (!f.startsWith('.')) walk(p); }
    else if (/\.(png|jpe?g|gif|svg|webp)$/i.test(f)) images[f] = p;
  }
})(COURSE);

const notes = {}, used = new Set();
for (const rel of new Set(Object.values(MAP).flat())) {
  const p = path.join(COURSE, rel);
  if (!fs.existsSync(p)) { console.error('Note introuvable :', rel); process.exit(1); }
  let md = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  md = md.replace(/^---\n[\s\S]*?\n---\n/, '');           // propriétés Obsidian
  md = md.replace(/%%[\s\S]*?%%/g, '');                    // commentaires Obsidian
  md = md.split('\n').filter(l => !/^← /.test(l)).join('\n'); // ligne de navigation du vault
  const h1 = md.match(/^# (.+)$/m);
  const title = h1 ? h1[1].trim() : path.basename(rel, '.md');
  if (h1) md = md.replace(h1[0], '');
  for (const m of md.matchAll(/!\[\[([^\]|\\]+)/g)) {
    const f = m[1].trim();
    if (images[f]) used.add(f); else console.warn('Image introuvable :', f, 'dans', rel);
  }
  notes[rel] = { title, name: path.basename(rel, '.md'), md: md.replace(/\n{3,}/g, '\n\n').trim() };
}

// Images utilisées, copiées à côté du jeu
const imgDir = path.join(GAME, 'cours', 'img');
fs.mkdirSync(imgDir, { recursive: true });
for (const f of fs.readdirSync(imgDir)) if (!used.has(f)) fs.unlinkSync(path.join(imgDir, f));
for (const f of used) fs.copyFileSync(images[f], path.join(imgDir, f));

const out = `'use strict';
/* =========================================================
   Hyperscale — notes de cours (vault cours-sisr-main) affichées dans les fiches.
   Fichier généré par tools/gen-cours.js : ne pas le modifier à la main.
   ========================================================= */
const COURS = ${JSON.stringify({ fiches: MAP, notes }, null, 1)};
`;
fs.writeFileSync(path.join(GAME, 'dc', 'cours.js'), out, 'utf8');
console.log(`${Object.keys(notes).length} notes pour ${Object.keys(MAP).length} fiches, ${used.size} images, ${Math.round(out.length / 1024)} Ko`);
