// Génère les notes Obsidian du vault Jeu-SISR à partir des données du jeu.
// Usage : node gen-vault.js <dossier du jeu> <dossier du vault>
const fs = require('fs'), path = require('path');
const [GAME, VAULT] = process.argv.slice(2);
global.localStorage = { getItem() { return null; }, setItem() {} };
const src = ['data', 'sim', 'actions', 'learn', 'console'].map(f => fs.readFileSync(path.join(GAME, 'dc', f + '.js'), 'utf8').replace(/^'use strict';/m, '')).join('\n');
const API = new Function(src + `
return { FICHES, INCIDENTS, CAT, CABLES, MODULES, DISKS, RAID, ROOM_ITEMS, SVC, CONTRACTS, CHAPTERS, IF_CMDS, CONF_CMDS, RIF_CMDS, LINE_CMDS, VLANS, VLAN_IDS, TEACH, RANKS, ECO, ROWS, NPOS, CRAC_KW, INROW_KW, AISLES,
  newState, actAccept, actPlace, actPlug, actConnect, actPortCfg, actDeploy, actAddRule, actAddDisk, actSetRaid, actInstallRack, derive, devsOfKind, cmdList,
  get S(){ return S; }, freeIp };`)();
const { FICHES, INCIDENTS, CAT, CABLES, MODULES, DISKS, RAID, ROOM_ITEMS, SVC, CONTRACTS, CHAPTERS, VLANS, VLAN_IDS, TEACH, RANKS, ECO, ROWS, NPOS, CRAC_KW, INROW_KW, AISLES } = API;

/* ---------- utilitaires ---------- */
// Garde la progression déjà cochée dans les notes existantes (revise, quiz_reussi, maitrise).
function keepProgress(p, txt) {
  if (!fs.existsSync(p)) return txt;
  const old = fs.readFileSync(p, 'utf8');
  for (const k of ['revise', 'quiz_reussi', 'maitrise']) if (new RegExp(`^${k}: true$`, 'm').test(old)) txt = txt.replace(new RegExp(`^${k}: false$`, 'm'), `${k}: true`);
  return txt;
}
const write = (rel, txt) => { const p = path.join(VAULT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, keepProgress(p, txt.replace(/\n{3,}/g, '\n\n').trim() + '\n'), 'utf8'); written.push(rel); };
const written = [];
const safe = s => s.replace(/\s*:\s*/g, ' - ').replace(/[\\/?*"<>|]/g, '-').trim();
const pad2 = n => String(n).padStart(2, '0');
function hh(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function shuffle(n, seed) { const a = [...Array(n).keys()]; let h = hh(seed); for (let i = n - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const L = 'abcd';
const ent = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
function inline(s) { return ent(s.replace(/<b>(.*?)<\/b>/g, '**$1**').replace(/<i>(.*?)<\/i>/g, '*$1*').replace(/<code>(.*?)<\/code>/g, '`$1`').replace(/<[^>]+>/g, '')).trim(); }
function html2md(h) {
  const out = [];
  const re = /<table>([\s\S]*?)<\/table>|<p>([\s\S]*?)<\/p>|<ol>([\s\S]*?)<\/ol>|<ul>([\s\S]*?)<\/ul>/g;
  let m;
  while ((m = re.exec(h))) {
    if (m[1]) {
      const rows = [...m[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(r => [...r[1].matchAll(/<t[hd]>([\s\S]*?)<\/t[hd]>/g)].map(c => inline(c[1]).replace(/\|/g, '\\|')));
      out.push('| ' + rows[0].join(' | ') + ' |', '|' + rows[0].map(() => '---').join('|') + '|', ...rows.slice(1).map(r => '| ' + r.join(' | ') + ' |'), '');
    } else if (m[2]) out.push(inline(m[2]), '');
    else if (m[3]) { [...m[3].matchAll(/<li>([\s\S]*?)<\/li>/g)].forEach((li, i) => out.push(`${i + 1}. ${inline(li[1])}`)); out.push(''); }
    else if (m[4]) { [...m[4].matchAll(/<li>([\s\S]*?)<\/li>/g)].forEach(li => out.push(`- ${inline(li[1])}`)); out.push(''); }
  }
  return out.join('\n');
}
const ficheFile = f => `${pad2(FICHES.indexOf(f) + 1)} - ${safe(f.title)}`;
const ficheLink = id => { const f = FICHES.find(x => x.id === id); return `[[Fiches/${ficheFile(f)}|${f.title}]]`; };
const ACCUEIL = '[[00 - Accueil|Accueil]]';
const GAME_URL = 'https://t0myto.github.io/hyperscale/';

/* ---------- état d'exemple pour les incidents et la console ---------- */
API.newState();
const S = API.S;
S.money = 1e6;
S.unlocked.push('nas', 'ram', 'hdd');
S.contracts.push({ id: 'c5', state: 'offer' }, { id: 'c7', state: 'offer' });
API.actAccept('c5'); API.actAccept('c7');
const R1 = API.actInstallRack('A', 1);
const rtr = API.actPlace('router', R1, 40), fw = API.actPlace('fw', R1, 38);
const sw = API.actPlace('sw24', R1, 36), srv = API.actPlace('srv1', R1, 34), srv2 = API.actPlace('srv1', R1, 32), nas = API.actPlace('nas', R1, 28);
for (const d of [rtr, fw, sw, srv, srv2, nas]) d.psus.forEach((_, i) => API.actPlug(d, i, i ? 'B' : 'A'));
for (let b = 0; b < 4; b++) API.actAddDisk(nas, b, 'ssd');
API.actSetRaid(nas, '5');
const odf = API.devsOfKind('odf')[0];
API.actConnect('os2', { d: rtr.id, p: 'Te0/0/0' }, { d: odf.id, p: 'OP1' });
API.actConnect('dac', { d: rtr.id, p: 'Te0/1/0' }, { d: fw.id, p: 'port1' });
API.actConnect('dac', { d: fw.id, p: 'port2' }, { d: sw.id, p: 'Te1/1/1' });
API.actPortCfg(fw, 'port2', { mode: 'trunk', allowed: [10, 20, 99] });
API.actPortCfg(sw, 'Te1/1/1', { mode: 'trunk', allowed: [10, 20, 30, 99], native: 999 });
API.actConnect('cat6', { d: srv.id, p: 'eno1' }, { d: sw.id, p: 'Gi1/0/1' });
API.actConnect('cat6', { d: srv2.id, p: 'eno1' }, { d: sw.id, p: 'Gi1/0/2' });
API.actConnect('dac', { d: nas.id, p: 'eth0' }, { d: sw.id, p: 'Te1/1/2' });
API.actPortCfg(sw, 'Gi1/0/1', { mode: 'trunk', allowed: [10, 20, 30, 99], native: 999 });
API.actPortCfg(sw, 'Gi1/0/2', { mode: 'trunk', allowed: [10, 20, 30, 99], native: 999 });
API.actPortCfg(sw, 'Te1/1/2', { vlan: 30 });
API.derive();
const web = API.actDeploy('c5', 'web', srv.id, 10, API.freeIp(10), srv.id);
API.actDeploy('c7', 'web', srv2.id, 10, API.freeIp(10), srv2.id);
API.actDeploy('c7', 'db', srv.id, 20, API.freeIp(20), srv.id);
for (const r of [['Internet', 'DMZ', 'tcp', 443], ['DMZ', 'SERVEURS', 'tcp', 5432], ['Internet', 'DMZ', 'tcp', 22]]) API.actAddRule({ src: r[0], dst: r[1], proto: r[2], port: r[3] });
API.derive();
S.contracts.forEach(c => { if (c.state === 'setup') c.state = 'active'; });
API.derive();

/* ---------- Fiches ---------- */
// Les cases cochées suivent la fiche par son identifiant, même si son numéro change
const oldProg = {};
const fdir = path.join(VAULT, 'Fiches');
if (fs.existsSync(fdir)) for (const fn of fs.readdirSync(fdir)) {
  const t = fs.readFileSync(path.join(fdir, fn), 'utf8'), m = t.match(/^fiche: (\w+)$/m);
  if (m) oldProg[m[1]] = ['revise', 'quiz_reussi'].filter(k => new RegExp(`^${k}: true$`, 'm').test(t));
}
const withProg = (id, txt) => (oldProg[id] || []).reduce((x, k) => x.replace(new RegExp(`^${k}: false$`, 'm'), `${k}: true`), txt);
const taughtBy = id => CONTRACTS.map((c, i) => c.notions.includes(id) ? `- ${i + 1}. ${c.client}${c.mission ? ' (mission)' : ''}, chapitre ${c.chap}` : '').filter(Boolean);
for (const f of FICHES) {
  const quiz = f.quiz.map((q, i) => { const ord = shuffle(q.o.length, f.id + i); return { q, ord, good: ord.indexOf(q.a) }; });
  const inc = Object.entries(INCIDENTS).filter(([, d]) => d.fiche === f.id).map(([k, d]) => `- [[Incidents/${safe(d.title)}|${d.title}]]`);
  write(`Fiches/${ficheFile(f)}.md`, withProg(f.id, `---
tags: [jeu-sisr, fiche]
fiche: ${f.id}
revise: false
quiz_reussi: false
---

# ${f.title}

← ${ACCUEIL} · Toutes les fiches : [[Fiches/00 - Sommaire des fiches|Sommaire]]

> [!info] Source
> Note du vault **cours-sisr-main** : *${f.vault}*. Cette fiche est celle du jeu Hyperscale, complétée pour le datacenter.

${html2md(f.html)}

> [!tip] À retenir
> ${f.retenir}

## Quiz

${quiz.map(({ q, ord }, i) => `**${i + 1}. ${q.q}**\n${ord.map((j, k) => `- ${L[k]}) ${q.o[j]}`).join('\n')}`).join('\n\n')}

> [!success]- Correction
${quiz.map(({ q, good }, i) => `> ${i + 1}. **${L[good]}) ${q.o[q.a]}**. ${q.e}`).join('\n')}
${inc.length ? `\n## Incidents du jeu liés à cette fiche\n\n${inc.join('\n')}` : ''}
${taughtBy(f.id).length ? `\n## Où le jeu l'enseigne\n\n${taughtBy(f.id).join('\n')}\n\nVoir [[Référence/Contrats et progression|Contrats et progression]].` : ''}
`));
}
write('Fiches/00 - Sommaire des fiches.md', `---
tags: [jeu-sisr, sommaire]
---

# Sommaire des fiches

← ${ACCUEIL}

Les ${FICHES.length} fiches du jeu, dans l'ordre où on les rencontre en jouant. Coche la propriété \`revise\` dans chaque fiche, puis suis ta progression dans [[Progression.base|Progression]].

${FICHES.map(f => `${FICHES.indexOf(f) + 1}. ${ficheLink(f.id)} : ${f.retenir}`).join('\n')}
`);

/* ---------- Incidents ---------- */
const DETECT = { hw: 'Matériel : remonte par le BMC (iDRAC, IPMI) si la supervision est en place, sinon seulement par les voyants ou quand un client appelle.', svc: "Service : la supervision le voit tout de suite ; sans elle, c'est le client qui appelle.", facility: 'Bâtiment : la GTB (gestion technique du bâtiment) ou l’opérateur prévient immédiatement.', fw: "Sécurité : l'IDS du pare-feu lève une alerte." };
const sampleCtx = {
  breaker: { rack: R1, pdu: 'A' }, cert: { vm: web.id }, hot: { rack: R1 }, upsover: { p: 'A' }, edf: { dur: 60 }, crac: { slot: 0 },
};
const incList = [];
for (const [k, d] of Object.entries(INCIDENTS)) {
  let x = sampleCtx[k] || (d.pick ? d.pick() : null);
  if (!x && k === 'brute') x = { vm: web.id, ip: '185.220.101.42' };
  if (!x && k === 'ddos') x = { kind: 'vol', mbps: 25000 };
  if (!x) { console.error('pas de contexte pour', k); continue; }
  const q = d.quiz(x), co = shuffle(4, k + 'c'), po = shuffle(4, k + 'p');
  const hints = d.hints(x);
  const teachBy = Object.entries(TEACH).filter(([, l]) => l.includes(k)).map(([c]) => { const z = CONTRACTS.find(y => y.id === c); return z.internal ? `${z.client} « ${z.what} »` : z.client; });
  incList.push({ k, d });
  let extra = '';
  if (k === 'ddos') {
    const y = { kind: 'syn', mbps: 3000 }, q2 = d.quiz(y);
    extra = `\n## Variante : SYN flood\n\n${d.hints(y).map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\n- **Cause racine** : ${q2.cause[0]}\n- **Prévention** : ${q2.prev[0]}\n`;
  }
  write(`Incidents/${safe(d.title)}.md`, `---
tags: [jeu-sisr, incident]
incident: ${k}
fiche: ${d.fiche}
maitrise: false
---

# ${d.title}

← ${ACCUEIL} · [[Incidents/00 - Méthode et liste des incidents|Tous les incidents]] · Fiche : ${ficheLink(d.fiche)}

> [!info] Comment on l'apprend
> ${DETECT[d.detect]}${d.natural ? '\n> Cet incident arrive tout seul quand les conditions sont réunies (charge, date, température).' : ''}${teachBy.length ? `\n> Le jeu le déclenche pour la première fois après le contrat **${teachBy.join(', ')}**.` : ''}

## 1. Définir

> [!warning] Alerte (exemple dans le jeu)
> ${d.alert(x)}

## 2. Collecter

Commande à lancer dans la console du jeu :

\`\`\`
${d.cmd(x)}
\`\`\`

## 3. Supposer et tester

${hints.map((h, i) => `${i + 1}. ${h}`).join('\n')}
${extra}
## 4. Documenter : la fiche d'incident

**Quelle est la cause racine ?**
${co.map((j, i) => `- ${L[i]}) ${q.cause[j]}`).join('\n')}

**Qu'est-ce qui évite que ça se reproduise ?**
${po.map((j, i) => `- ${L[i]}) ${q.prev[j]}`).join('\n')}

> [!success]- Réponses
> - Cause : **${L[co.indexOf(0)]}) ${q.cause[0]}**
> - Prévention : **${L[po.indexOf(0)]}) ${q.prev[0]}**
`);
}
write('Incidents/00 - Méthode et liste des incidents.md', `---
tags: [jeu-sisr, incident, methode]
---

# Méthode de dépannage et incidents du jeu

← ${ACCUEIL} · Fiche : ${ficheLink('dep')}

\`\`\`mermaid
flowchart LR
    A["1. Définir<br/>qui, quoi, depuis quand"] --> B["2. Collecter<br/>console, journaux, voyants"]
    B --> C["3. Hypothèse"] --> D["4. Tester<br/>un seul changement"]
    D -->|"échec"| C
    D -->|"résolu"| E["5. Documenter<br/>cause et prévention"]
\`\`\`

> [!tip] De bas en haut
> Énergie et câbles (couche 1), VLAN et ports (2), adresse IP et passerelle (3), règles du pare-feu (4), service, disque, mémoire et certificat (7). Le diagnostic des contrats du jeu suit cet ordre.

| Incident | Fiche | Détection | Commande de collecte |
|---|---|---|---|
${incList.map(({ k, d }) => { const x = sampleCtx[k] || (d.pick && d.pick()) || (k === 'brute' ? { vm: web.id, ip: '185.220.101.42' } : { kind: 'vol', mbps: 25000 }); return `| [[Incidents/${safe(d.title)}\\|${d.title}]] | ${ficheLink(d.fiche).replace('|', '\\|')} | ${{ hw: 'Matériel (BMC)', svc: 'Supervision ou client', facility: 'GTB, opérateur', fw: 'IDS' }[d.detect]} | \`${d.cmd(x).replace(/\|/g, '\\|')}\` |`; }).join('\n')}

> [!info] Sans supervision
> Une alimentation ou un disque redondés tombent sans couper le service : personne ne le voit. La panne suivante, elle, coupe tout. C'est tout l'intérêt du contrat interne « Superviser la salle avec Zabbix ».
`);

/* ---------- Commandes ---------- */
const kinds = [['Switch (Cisco IOS)', { d: sw.id }], ['Routeur de bordure', { d: API.devsOfKind('router')[0].id }], ['Pare-feu (Linux, nftables)', { d: fw.id }], ['Serveur hyperviseur (Proxmox, Debian)', { d: srv.id }], ['Baie de stockage (NAS)', { d: nas.id }], ['Machine virtuelle (exemple : site web)', { vm: web.id }]];
write("Aide-mémoire/Commandes de la console.md", `---
tags: [jeu-sisr, memo, commandes]
---

# Commandes de la console

← ${ACCUEIL}

Toutes les commandes acceptées par la console du jeu. Les sorties imitent les vraies (Cisco IOS, Linux, Proxmox, nftables). Les abréviations Cisco fonctionnent : \`sh int st\` = \`show interfaces status\`.

${kinds.map(([name, tg]) => {
  const seen = new Set(), rows = [];
  for (const c of API.cmdList(tg)) {
    const g = c.c.replace(/ (Gi|Te|Fo)\d+\/\d+\/\d+$/, ' <port>').replace(/^ethtool (-m )?\S+$/, (m, o) => `ethtool ${o || ''}<carte>`).replace(/^arping -I vmbr0 .+$/, 'arping -I vmbr0 <adresse IP>').replace(/^ping -c 3 .+$/, 'ping -c 3 <passerelle>').replace(/^show running-config interface .+$/, 'show running-config interface <port>');
    if (seen.has(g) || (!c.chip && g === c.c)) continue;
    seen.add(g);
    const hint = ({ 'show running-config interface <port>': 'Configuration du port', 'ethtool -m <carte>': 'Puissance optique reçue par la carte', 'ethtool <carte>': 'Lien de la carte : vitesse, duplex, lien détecté', 'show interfaces <port>': 'Compteurs du port : débit, CRC, collisions (ex. Te0/0/0 pour le lien opérateur)', 'arping -I vmbr0 <adresse IP>': 'Qui répond à cette adresse ? Deux MAC = conflit', 'ping -c 3 <passerelle>': 'La passerelle répond-elle ?' })[g] || c.hint || '';
    rows.push(`| \`${g.replace(/\|/g, '\\|')}\` | ${hint} |`);
  }
  return `## ${name}\n\n| Commande | À quoi elle sert |\n|---|---|\n${rows.join('\n')}`;
}).join('\n\n')}

## Mode configuration (Cisco IOS)

Dans l'onglet CLI d'un switch ou du routeur, on configure comme sur un vrai équipement Cisco. Chaque réglage fait dans l'onglet Config s'affiche aussi en commandes dans ce terminal.

\`\`\`
sw-a01-01# configure terminal
sw-a01-01(config)# interface range Gi1/0/3-24
sw-a01-01(config-if-range)# shutdown
sw-a01-01(config-if-range)# exit
sw-a01-01(config)# interface Gi1/0/1
sw-a01-01(config-if)# switchport mode access
sw-a01-01(config-if)# switchport access vlan 20
sw-a01-01(config-if)# end
sw-a01-01# show vlan brief
\`\`\`

### Configuration globale

| Commande | Équipement | À quoi elle sert |
|---|---|---|
${API.CONF_CMDS.map(c => `| \`${c.p.replace(' <rest>', ' …').replace(' <n>', ' N').replace(/\|/g, '\\|')}\` | ${c.rt ? 'routeur' : c.sw ? 'switch' : 'switch et routeur'} | ${c.h} |`).join('\n')}
| \`end\` · \`exit\` · \`do show …\` | tous | revenir au mode privilégié, remonter d'un niveau, lancer une commande show sans quitter |

### Interface d'un switch

| Commande | À quoi elle sert |
|---|---|
${API.IF_CMDS.map(c => `| \`${c.p.replace(/[{}]/g, '').replace(' <rest?>', '').replace('<n>', 'N').replace('<rest>', '…').replace(/\|/g, ' / ')}\` | ${c.h} |`).join('\n')}

### Routeur : ACL, interfaces et lignes VTY

\`\`\`
rtr-01(config)# access-list 10 permit 10.99.0.0 0.0.0.255
rtr-01(config)# line vty 0 4
rtr-01(config-line)# transport input ssh
rtr-01(config-line)# access-class 10 in
rtr-01(config-line)# exit
rtr-01(config)# ip access-list extended EDGE-IN
rtr-01(config-ext-nacl)# deny ip 10.0.0.0 0.255.255.255 any
rtr-01(config-ext-nacl)# permit tcp host 198.51.100.1 host 198.51.100.2 eq bgp
rtr-01(config-ext-nacl)# permit tcp any host 203.0.113.10 eq 443 22
rtr-01(config-ext-nacl)# exit
rtr-01(config)# interface Te0/0/0
rtr-01(config-if)# ip access-group EDGE-IN in
rtr-01(config-if)# end
rtr-01# show access-lists
\`\`\`

| Mode | Commande | À quoi elle sert |
|---|---|---|
| ACL \`(config-ext-nacl)\` | \`permit\` ou \`deny\` PROTO SOURCE DESTINATION [\`eq\` PORT…] | ajoute une ligne à la fin (numéro + 10) ; \`eq\` accepte jusqu'à 10 ports |
| ACL \`(config-ext-nacl)\` | \`15 permit …\` · \`no 20\` · \`remark …\` | insère au numéro 15, supprime la ligne 20, commente |
${API.RIF_CMDS.map(c => `| Interface \`(config-if)\` | \`${c.p.replace(' <rest>', ' NOM in')}\` | ${c.h} |`).join('\n')}
${API.LINE_CMDS.map(c => `| Lignes VTY \`(config-line)\` | \`${c.p.replace(' <rest>', ' …')}\` | ${c.h} |`).join('\n')}

> [!tip] Adresses dans une ACL
> \`any\` = n'importe qui · \`host 203.0.113.10\` = une seule adresse · \`10.0.0.0 0.255.255.255\` = un réseau avec son masque générique (l'inverse du masque). Voir la fiche ${ficheLink('acl')}.

## Lire les sorties

| Ce que tu vois | Ce que ça veut dire |
|---|---|
| \`err-disabled\` | Port coupé par une sécurité (BPDU Guard, Port Security) |
| \`disabled\` | Port en \`shutdown\` |
| \`notconnect\` | Rien au bout, ou l'autre côté est éteint |
| \`a-half\` avec des \`late collision\` | Duplex forcé d'un côté, automatique de l'autre |
| \`CRC\` qui augmente | Câble ou connecteur abîmé |
| \`Rx -40.0 dBm\` | Plus de lumière : module, fibre ou module d'en face |
| \`[U_]\` dans \`/proc/mdstat\` | Grappe RAID dégradée |
| \`Redundancy Lost\` | Une alimentation manque |
| \`Destination Host Unreachable\` | La passerelle ne répond pas : VLAN, trunk ou IP |
| \`certificate has expired\` | Certificat TLS à renouveler |
`);
write("Aide-mémoire/Commandes équivalentes.md", `---
tags: [jeu-sisr, memo, commandes]
---

# Ce que fait chaque action du jeu, en ligne de commande

← ${ACCUEIL}

Chaque réglage fait dans l'interface affiche sa commande réelle dans l'inspecteur. Les voici regroupées.

## Switch Cisco

| Action dans le jeu | Commande |
|---|---|
| Couper / rallumer un port | \`shutdown\` / \`no shutdown\` |
| Port en access dans le VLAN 10 | \`switchport mode access\` puis \`switchport access vlan 10\` |
| Port en trunk | \`switchport mode trunk\`, \`switchport trunk allowed vlan 10,20,99\`, \`switchport trunk native vlan 999\`, \`switchport nonegotiate\` |
| Vitesse et duplex | \`speed auto\`, \`duplex auto\` |
| Protéger un port serveur | \`spanning-tree portfast\`, \`spanning-tree bpduguard enable\` |
| Port Security | \`switchport port-security\`, \`switchport port-security maximum 2\`, \`switchport port-security violation restrict\` |
| Description | \`description vers srv-a1-01\` |

## Pare-feu Linux (nftables)

| Action | Commande |
|---|---|
| Autoriser Internet → DMZ en TCP 443 | \`nft add rule inet filtre forward iifname "wan0" oifname "vlan10" tcp dport 443 accept\` |
| Supprimer une règle | \`nft delete rule inet filtre forward handle N\` |
| Interface d'un VLAN sur un trunk | \`ip link add link port2 name port2.10 type vlan id 10\` |
| Limiter les SYN | \`nft add rule inet filtre input tcp flags syn limit rate over 200/second drop\` |
| Bloquer une adresse | \`nft add element inet filtre blocklist { 185.220.101.42 }\` |

## Hyperviseur Proxmox et Linux

| Action | Commande |
|---|---|
| Créer une VM dans le VLAN 10 | \`qm create 101 --name web-01 --cores 2 --memory 4096 --net0 virtio,bridge=vmbr0,tag=10 --scsi0 local-lvm:40\` |
| Démarrer, redémarrer, arrêter | \`qm start 101\`, \`qm reboot 101\`, \`qm shutdown 101\` |
| Isoler une VM | \`qm set 101 --net0 virtio,bridge=vmbr0,tag=10,link_down=1\` |
| Adresse et passerelle dans la VM | \`ip addr add 172.16.10.10/24 dev eth0\`, \`ip route add default via 172.16.10.1\` |
| Créer une grappe RAID 5 | \`mdadm --create /dev/md0 --level=5 --raid-devices=4 /dev/sd[a-d]\` |
| Remplacer un disque | \`mdadm /dev/md0 --remove /dev/sdb\`, puis \`mdadm /dev/md0 --add /dev/sdb\` |
| Renouveler un certificat | \`certbot renew\`, et \`systemctl enable --now certbot.timer\` pour l'automatique |
| fail2ban | \`apt install fail2ban && systemctl enable --now fail2ban\` |
| Purger les journaux | \`journalctl --vacuum-size=200M\`, \`logrotate -f /etc/logrotate.conf\` |
`);

/* ---------- Matériel, câbles, services, adressage, contrats ---------- */
const mo = n => n.toLocaleString('fr-FR') + ' €';
write('Référence/Matériel.md', `---
tags: [jeu-sisr, reference, materiel]
---

# Matériel du jeu

← ${ACCUEIL} · Fiches : ${ficheLink('baie')} · ${ficheLink('elec')}

| Équipement | Taille | Alimentations | Consommation | Prix | Rôle |
|---|---|---|---|---|---|
${Object.entries(CAT).filter(([, c]) => !c.hidden).map(([, c]) => `| **${c.name}** | ${c.u}U | ${c.psu || '—'} | ${c.psu ? `${c.w[0]} à ${c.w[1]} W` : 'passif'} | ${c.fixed ? 'fourni' : mo(c.cost)} | ${c.desc} |`).join('\n')}

## Ports de chaque équipement

| Équipement | Ports (face arrière) |
|---|---|
${Object.entries(CAT).filter(([, c]) => !c.hidden && c.ports.length).map(([, c]) => { const g = {}; c.ports.forEach(p => { const k = `${p.t === 'rj45' ? 'RJ45' : p.t === 'sfp' ? 'SFP+' : 'QSFP+'} ${p.speed >= 1000 ? p.speed / 1000 + ' Gbit/s' : p.speed}`; (g[k] = g[k] || []).push(p.id); }); return `| ${c.name} | ${Object.entries(g).map(([k, l]) => `${l.length} × ${k} (${l.length > 3 ? l[0] + ' à ' + l[l.length - 1] : l.join(', ')})`).join(' ; ')} |`; }).join('\n')}

## Achats pour la salle

| Achat | Prix | Effet |
|---|---|---|
${Object.values(ROOM_ITEMS).map(u => `| ${u.name} | ${mo(u.cost)} | ${u.desc} |`).join('\n')}

> [!info] Électricité
> Chaque baie a un PDU A (voie A, cordons rouges) et un PDU B (voie B, cordons bleus) de 16 A sous 230 V, soit 3 680 W. Au-delà, le disjoncteur saute. Voir [[Référence/Salle, énergie et froid|Salle, énergie et froid]].
`);
write('Référence/Salle, énergie et froid.md', `---
tags: [jeu-sisr, reference, salle, energie, froid]
---

# Salle, énergie et froid

← ${ACCUEIL} · Fiches : ${ficheLink('salle')} · ${ficheLink('onduleur')} · ${ficheLink('froid')}

## Le plan

- **${ROWS.length} rangées** (${ROWS.join(', ')}) de **${NPOS} emplacements**. Une baie se nomme par sa rangée et sa position : B04.
- Allées froides : ${AISLES.filter(a => a.cold).map(a => a.id).join(', ')}. Allées chaudes : ${AISLES.filter(a => !a.cold).map(a => a.id).join(', ')}.
- **Salle opérateurs (MMR)** à gauche : l'ODF où arrivent les fibres OP1 et OP2. On s'y relie en fibre monomode OS2 (environ 10 à 15 m depuis la rangée A).
- **Local électrique** à droite : TGBT, onduleurs A et B, batteries. Le groupe électrogène se pose dans la cour.
- **Chemins de câbles** en hauteur : un câble entre deux baies suit les allées, sa longueur se mesure en mètres réels.

\`\`\`mermaid
flowchart LR
    EDF(["Arrivée EDF"]) --> TGBT["TGBT"]
    GE["Groupe électrogène"] -.->|"coupure EDF"| TGBT
    TGBT --> UA["Onduleur A<br/>+ batteries"]
    TGBT --> UB["Onduleur B<br/>+ batteries"]
    UA --> GA["Gaine à barres A<br/>de chaque rangée"]
    UB --> GB["Gaine à barres B"]
    GA --> PA["PDU A de la baie"]
    GB --> PB["PDU B de la baie"]
    PA --> S["Serveur : PSU1"]
    PB --> S2["Serveur : PSU2"]
\`\`\`

## Énergie : les règles du jeu

| Règle | Valeur |
|---|---|
| Départ | ${mo(ECO.start)}, rangée A électrifiée, onduleurs de 20 kW par voie, 15 min de batteries |
| PDU d'une baie | 16 A × 230 V = 3 680 W, disjoncteur au-delà |
| Onduleur | coupe sa sortie s'il dépasse sa puissance ; réarmement manuel |
| Redondance 2N | chaque onduleur reste sous 50 % pour reprendre seul la voie d'en face |
| Coupure EDF | les batteries tiennent leur autonomie ; le groupe démarre en 1 minute de jeu |

## Froid : les règles du jeu

| Règle | Valeur |
|---|---|
| CRAC (le long des murs) | ${CRAC_KW} kW chacun, 6 emplacements |
| Climatiseur en rangée | ${INROW_KW} kW, prend un emplacement de baie, renforce les baies à 2 positions ou moins |
| Charge thermique de la salle | au-delà de 75 % de la puissance de froid, toutes les baies se réchauffent |
| Froid local d'une baie | 4 kW, +2 kW si l'allée froide est confinée, +6 kW près d'un climatiseur en rangée |
| Unités vides sans obturateur | l'air chaud revient vers l'avant : +0,12 °C par unité |
| Seuils | 27 °C : alerte (ASHRAE) · 30 °C : les serveurs ralentissent · 36 °C : arrêt de protection |

> [!tip] N+1
> Il faut toujours un climatiseur et un onduleur de plus que nécessaire : la panne d'un seul élément ne doit rien couper.
`);
write('Aide-mémoire/Recette des contrats.md', `---
tags: [jeu-sisr, memo, recette]
---

# Recette des contrats

← ${ACCUEIL} · Fiche : ${ficheLink('recette')}

Un contrat n'est livré qu'après sa recette. Les tests partent de la place de l'utilisateur et remontent les couches.

| Service | Test depuis | Commande | Réponse attendue |
|---|---|---|---|
| Toute VM | la VM | \`ping -c 3 <passerelle>\` | 0 % de perte |
| Service public | une sonde sur Internet | \`nmap -Pn -p 443 203.0.113.10\` | \`443/tcp open\` |
| Site web, répartiteur | Internet | \`curl -sI https://www.client.fr\` | \`HTTP/2 200\` |
| Base de données | la DMZ | \`psql -h 10.20.0.10 -U app -c "select 1"\` | une ligne |
| DNS | Internet | \`dig @203.0.113.10 client.fr SOA +short\` | l'enregistrement SOA |
| Messagerie | Internet | \`openssl s_client -starttls smtp -connect mail.client.fr:587\` | \`250 STARTTLS\` |
| VPN | la passerelle | \`wg show wg0 latest-handshakes\` | un échange récent |
| SFTP | Internet | \`sftp -P 22 client@203.0.113.10\` | \`Connected\` |
| Supervision | Zabbix | \`zabbix_get -s <ip> -k agent.ping\` | \`1\` |
| Sauvegarde | Bareos | \`echo 'status storage' \\| bconsole\` | \`is mounted\` |
| Active Directory | la DMZ | \`ldapsearch -H ldap://<ip> -x -s base namingContexts\` | le nom du domaine |
| Kubernetes | l'administration | \`kubectl get nodes\` | nœuds \`Ready\` |

## Recette qualité

Elle ne bloque pas la livraison, mais chaque point rapporte de l'expérience :

- [ ] Chaque hôte a une alimentation sur la voie A et une sur la voie B
- [ ] Les unités vides des baies utilisées sont obturées
- [ ] Les données sont sur un RAID tolérant aux pannes
- [ ] Les ports de switch vers les serveurs ont BPDU Guard
- [ ] Les ports de switch utilisés ont une description
`);
write('Référence/Câbles, modules et disques.md', `---
tags: [jeu-sisr, reference, cablage, stockage]
---

# Câbles, modules et disques

← ${ACCUEIL} · Fiches : ${ficheLink('cuivre')} · ${ficheLink('fibre')} · ${ficheLink('raid')}

## Câbles

| Câble | Norme | Se branche sur | Portée | Modules | Couleur dans le jeu |
|---|---|---|---|---|---|
${Object.values(CABLES).map(c => `| **${c.name}** | ${c.std} | ${{ rj45: 'prises RJ45', sfp: 'cages SFP+', qsfp: 'cages QSFP+', fiber: 'cages SFP+ ou QSFP+' }[c.ends]} | ${Object.entries(c.max).map(([s, m]) => `${m} m à ${s / 1000} Gbit/s`).join(', ')} | ${c.noModule ? 'intégrés' : c.module ? c.module + ' aux deux bouts' : '—'} | ${c.color} |`).join('\n')}

> [!tip] Choisir
> Dans une baie entre cages SFP+ : un DAC. Entre baies : fibre OM4 et modules SR. Vers un opérateur : fibre OS2 et modules LR. Pour du cuivre 10 Gbit/s au-delà de 55 m : Cat 6A.

## Modules optiques

| Module | Fibre | Référence SFP+ | Référence QSFP+ | Prix SFP+ / QSFP+ |
|---|---|---|---|---|
${Object.values(MODULES).map(m => `| ${m.name} | ${m.long} | ${m.std.sfp} | ${m.std.qsfp} | ${mo(m.price.sfp)} / ${mo(m.price.qsfp)} |`).join('\n')}

## Disques

| Disque | Capacité | Prix |
|---|---|---|
${Object.values(DISKS).map(d => `| ${d.name} | ${String(d.size).replace('.', ',')} To | ${mo(d.price)} |`).join('\n')}

## RAID

| Niveau | Disques min. | Tolérance | Capacité utile | Usage |
|---|---|---|---|---|
| RAID 0 | 2 | aucune | N × taille | vitesse seule |
| RAID 1 | 2 | N − 1 | 1 × taille | miroir, système |
| RAID 5 | 3 | 1 disque | (N − 1) × taille | compromis |
| RAID 6 | 4 | 2 disques | (N − 2) × taille | gros disques, archives |
| RAID 10 | 4 (pair) | 1 par miroir | N / 2 × taille | bases de données, VM |

> [!example] Calcul
> 4 SSD de 1,92 To en RAID 5 : 3 × 1,92 = **5,76 To** utiles. En RAID 10 : 2 × 1,92 = **3,84 To**.
`);
write('Référence/Services et ports.md', `---
tags: [jeu-sisr, reference, services, ports]
---

# Services hébergés et leurs ports

← ${ACCUEIL} · Fiches : ${ficheLink('ports')} · ${ficheLink('virtu')}

| Service | Logiciel | vCPU | RAM | Disque | Ports | VLAN | Exposé à Internet |
|---|---|---|---|---|---|---|---|
${Object.values(SVC).map(s => `| **${s.name}** | ${s.soft} | ${s.vcpu} | ${s.ram} Go | ${s.disk} Go | ${s.ports.map(p => p[0].toUpperCase() + ' ' + p[1]).join(', ')} | ${s.zone} ${VLANS[s.zone].name} | ${s.pub ? 'oui' : 'non'} |`).join('\n')}

> [!warning] Exposition
> Ce qui est exposé va en DMZ. La base de données reste en SERVEURS et n'accepte que le flux DMZ → SERVEURS TCP 5432.
`);
write("Référence/Plan d'adressage.md", `---
tags: [jeu-sisr, reference, adressage, vlan]
---

# Plan d'adressage de la salle

← ${ACCUEIL} · Fiches : ${ficheLink('ip')} · ${ficheLink('switch')}

| VLAN | Nom | Réseau | Passerelle | Usage |
|---|---|---|---|---|
${VLAN_IDS.map(v => { const x = VLANS[v]; return `| ${v} | ${x.name} | ${x.net ? x.net + '.0/24' : '—'} | ${x.gw || '—'} | ${x.use} |`; }).join('\n')}

> [!tip] Règles
> - La passerelle de chaque VLAN routé est le pare-feu (.1).
> - Une VM prend une adresse de .2 à .254 dans le réseau de son VLAN.
> - Le VLAN 30 n'a pas de passerelle : seul un hôte branché dans ce VLAN atteint le stockage.
> - Le VLAN natif des trunks est le 999, jamais le 1.

\`\`\`mermaid
flowchart TB
    OP(["Opérateurs"]) --- R["Routeur de bordure<br/>BGP"]
    R --- F{"Pare-feu<br/>passerelle .1 de chaque VLAN"}
    F ===|"trunk 10, 20, 99"| S["Switch"]
    S ---|"trunk"| H1["Hyperviseur<br/>VM web (VLAN 10)<br/>VM base (VLAN 20)"]
    S ---|"access 30"| N["Baie de stockage<br/>NFS"]
\`\`\`
`);
const unlockLabel = u => (CAT[u] && CAT[u].name) || (CABLES[u] && CABLES[u].name) || (ROOM_ITEMS[u] && ROOM_ITEMS[u].name) || (DISKS[u] && DISKS[u].name) || (u === 'ram' ? 'extensions de mémoire' : u);
const contractNote = (c, i) => `### ${i + 1}. ${c.client}${c.mission ? ' (mission)' : c.internal ? ' (projet interne)' : ''}

- [ ] ${c.mission ? 'Réussie' : 'Mise en service'}

*${c.what}*
${c.notions.length ? `\n**Notions** : ${c.notions.map(ficheLink).join(', ')}\n` : ''}${c.goals ? `\n**Objectifs**\n\n${c.goals.map((g, k) => `${k + 1}. ${g.t}`).join('\n')}\n` : ''}${c.svcs.length ? `
| Service | Nombre | VLAN | Contrainte |
|---|---|---|---|
${c.svcs.map(s => `| ${SVC[s.s].name} (${SVC[s.s].soft}) | ${s.n} | ${SVC[s.s].zone} ${VLANS[SVC[s.s].zone].name} | ${[s.raid ? (s.raid === 10 ? 'RAID 10' : 'RAID avec tolérance') : '', s.anti ? 'hôtes différents' : '', s.antiRack ? 'baies différentes' : '', SVC[s.s].nas ? 'stockage sur la baie NAS' : ''].filter(Boolean).join(', ') || '—'} |`).join('\n')}
` : ''}${c.lanOnly ? '\nService purement interne : les postes du client sont dans le même VLAN, il n\'a pas besoin de passerelle ni de pare-feu.\n' : ''}${c.flows.length ? `\n**Flux à ouvrir sur le pare-feu** : ${c.flows.map(f => `${f[0]} → ${f[1]} ${f[2].toUpperCase()} ${f[3]}`).join(' ; ')}\n` : ''}${c.needOp2 ? '\n**Exige** deux opérateurs actifs (BGP).\n' : ''}${c.needGen ? '\n**Exige** un groupe électrogène.\n' : ''}
**Livraison** : ${c.mission ? 'la mission se valide dans le jeu dès que tous les objectifs sont atteints.' : 'par la [[Aide-mémoire/Recette des contrats|recette]].'}

**Revenu** : ${c.rev ? mo(c.rev) + ' par heure de jeu' : '—'} · **Prime** : ${mo(c.bonus)}${c.unlock.length ? ` · **Débloque** : ${c.unlock.map(unlockLabel).join(', ')}` : ''}${TEACH[c.id] ? `\n\n**Incidents introduits ensuite** : ${TEACH[c.id].map(k => `[[Incidents/${safe(INCIDENTS[k].title)}|${INCIDENTS[k].title}]]`).join(', ')}` : ''}
`;
write('Référence/Contrats et progression.md', `---
tags: [jeu-sisr, reference, contrats]
---

# Contrats et progression

← ${ACCUEIL}

Le jeu avance en ${CHAPTERS.length} chapitres, des notions vues en cours aux notions avancées. Chaque contrat introduit une ou deux notions, avec leurs fiches de cours. Une **mission** se valide dès que ses objectifs sont atteints ; un **contrat client** se livre par une recette. Dans le jeu, chaque étape du guide a un bouton « Montrer » qui amène au bon endroit, et un lien « Pourquoi ? » vers la fiche.

\`\`\`mermaid
flowchart LR
${CHAPTERS.map(ch => `    C${ch.n}["Chapitre ${ch.n}<br/>${ch.name}"]`).join('\n')}
    ${CHAPTERS.map(ch => `C${ch.n}`).join(' --> ')}
\`\`\`

${CHAPTERS.map(ch => `## Chapitre ${ch.n} · ${ch.name}

> ${ch.desc}

${CONTRACTS.map((c, i) => c.chap === ch.n ? contractNote(c, i) : '').filter(Boolean).join('\n')}`).join('\n')}

## Après le dernier contrat

D'autres clients continuent d'arriver (site web, DNS, messagerie ou VPN), avec des revenus de plus en plus élevés.

## Grades

| XP | Grade |
|---|---|
${RANKS.map(([n, r]) => `| ${n} | ${r} |`).join('\n')}
`);
write('Aide-mémoire/Glossaire du datacenter.md', `---
tags: [jeu-sisr, memo, glossaire]
---

# Glossaire du datacenter

← ${ACCUEIL}

| Terme | Définition |
|---|---|
| **1U** | Une unité de baie : 44,45 mm de haut |
| **ASHRAE** | Organisme qui recommande 18 à 27 °C pour l'air d'entrée des serveurs |
| **BGP** | Protocole de routage entre opérateurs ; bascule automatique entre deux liens |
| **BMC, iDRAC, IPMI** | Contrôleur de gestion du serveur : capteurs, alimentations, console à distance |
| **BPDU Guard** | Coupe un port d'accès qui reçoit des trames Spanning Tree |
| **CRAC** | Climatiseur de salle informatique |
| **DAC** | Câble cuivre avec modules SFP+ intégrés, quelques mètres |
| **DMZ** | Zone des serveurs exposés à Internet |
| **err-disabled** | Port coupé automatiquement par une protection |
| **GTB** | Gestion technique du bâtiment : électricité, climatisation, alarmes |
| **Hyperviseur** | Système qui fait tourner des machines virtuelles (Proxmox, ESXi) |
| **LR, SR** | Modules optiques longue portée (monomode) et courte portée (multimode) |
| **ODF** | Tiroir optique où arrivent les fibres des opérateurs |
| **OM4, OS2** | Fibre multimode turquoise, fibre monomode jaune |
| **PDU** | Bandeau de prises de la baie, alimenté par une voie électrique |
| **PSU** | Bloc d'alimentation d'un équipement |
| **PUE** | Énergie totale du site divisée par l'énergie informatique |
| **RAID** | Combinaison de disques pour la performance ou la tolérance de panne |
| **RPO, RTO** | Perte de données acceptable, délai de reprise |
| **SFP+, QSFP+** | Cages pour modules 10 Gbit/s et 40 Gbit/s |
| **SLA** | Engagement de disponibilité envers le client |
| **Spine-leaf** | Architecture où chaque switch de baie est relié à chaque switch de cœur |
| **Trunk** | Port qui transporte plusieurs VLAN étiquetés 802.1Q |
| **Voie A, voie B** | Deux alimentations électriques indépendantes du bâtiment |
| **2N, N+1** | 2N : deux chaînes complètes. N+1 : un élément de plus que le besoin |
| **Allée chaude, allée froide** | Allée où les baies rejettent leur air chaud, allée où elles aspirent l'air froid |
| **Cross-connect** | Câble qui relie ta baie à l'ODF de l'opérateur, en salle MMR |
| **Gaine à barres** | Conducteur posé au-dessus d'une rangée, sur lequel se branchent les PDU des baies |
| **Groupe électrogène** | Moteur diesel qui reprend la salle pendant une coupure EDF |
| **kVA, kW** | Puissance apparente d'un onduleur, puissance réelle consommée (kW = kVA × 0,9 environ) |
| **MMR** | Meet-me room : salle où arrivent les opérateurs |
| **Onduleur (UPS)** | Fournit un courant propre et tient sur batteries pendant une coupure |
| **Recette** | Série de tests qui prouve qu'un service fonctionne avant de le livrer |
| **TGBT** | Tableau général basse tension : il reçoit l'arrivée EDF |
| **ACL** | Liste de règles permit / deny lue de haut en bas sur un routeur ; la première qui correspond décide |
| **ACL standard, étendue** | Standard (1 à 99) : source seule. Étendue (100 à 199 ou nommée) : protocole, source, destination, port |
| **Anti-usurpation (anti-spoofing)** | Refuser en entrée les adresses privées qui ne peuvent pas venir d'Internet |
| **Deny implicite** | Ligne invisible en fin d'ACL qui refuse tout ce qui n'a pas été autorisé |
| **Masque générique (wildcard)** | Inverse du masque de sous-réseau, utilisé dans les ACL : 0.0.0.255 pour un /24 |
| **PortFast** | Port d'accès qui passe tout de suite en transmission, sans attendre le Spanning Tree |
| **SSH, Telnet** | Accès à distance en ligne de commande : chiffré pour SSH, en clair pour Telnet |
| **VLAN natif** | VLAN non étiqueté d'un trunk ; on le place sur un VLAN vide (999) contre le VLAN hopping |
| **VTY** | Lignes virtuelles d'accès à distance d'un équipement Cisco (line vty 0 4) |
`);

/* ---------- Progression (Base) ---------- */
fs.writeFileSync(path.join(VAULT, 'Progression.base'), `filters:
  and:
    - file.ext == "md"
properties:
  note.revise:
    displayName: Révisée
  note.quiz_reussi:
    displayName: Quiz réussi
  note.maitrise:
    displayName: Maîtrisé
  note.fiche:
    displayName: Fiche
views:
  - type: table
    name: Fiches à réviser
    filters:
      and:
        - file.hasTag("fiche")
        - note.revise == false
    order:
      - file.name
      - revise
      - quiz_reussi
    sort:
      - property: file.name
        direction: ASC
  - type: table
    name: Toutes les fiches
    filters:
      and:
        - file.hasTag("fiche")
    order:
      - file.name
      - revise
      - quiz_reussi
    sort:
      - property: file.name
        direction: ASC
  - type: table
    name: Incidents
    filters:
      and:
        - file.hasTag("incident")
        - file.name != "00 - Méthode et liste des incidents"
    order:
      - file.name
      - maitrise
      - fiche
    sort:
      - property: file.name
        direction: ASC
`, 'utf8');
written.push('Progression.base');

/* ---------- Accueil ---------- */
write('00 - Accueil.md', `---
tags: [jeu-sisr, accueil]
---

# Jeu SISR : Hyperscale

Le simulateur de datacenter du jeu Hyperscale, et tout ce qu'il enseigne, en notes. Tu pars d'une salle vide de six rangées avec ${mo(ECO.start)} : baies, matériel, câblage, énergie et froid sont à construire, contrat après contrat, des notions vues en cours jusqu'aux ACL. Chaque contrat client se livre par une recette.

> [!abstract] Jouer
> - En ligne : [Hyperscale](${GAME_URL})
> - Hors ligne : ouvre \`Jeu/hyperscale.html\` dans ton navigateur depuis l'explorateur Windows (voir [[Jeu/Lancer le jeu|Lancer le jeu]]).

## Apprendre

- [[Référence/Contrats et progression|Le parcours]] : ${CHAPTERS.length} chapitres, ${CONTRACTS.length} contrats, des notions vues en cours jusqu'aux ACL
- [[Fiches/00 - Sommaire des fiches|Les ${FICHES.length} fiches de cours]], chacune avec son quiz
- [[Incidents/00 - Méthode et liste des incidents|Méthode de dépannage et les ${incList.length} incidents]]
- [[Progression.base|Progression]] : fiches à réviser, incidents maîtrisés

## Référence

- [[Référence/Salle, énergie et froid|Salle, énergie et froid]]
- [[Référence/Plan d'adressage|Plan d'adressage]]
- [[Référence/Matériel|Matériel]]
- [[Référence/Câbles, modules et disques|Câbles, modules et disques]]
- [[Référence/Services et ports|Services et ports]]
- [[Référence/Contrats et progression|Contrats et progression]]

## Aide-mémoire

- [[Aide-mémoire/Recette des contrats|Recette des contrats]]
- [[Aide-mémoire/Commandes de la console|Commandes de la console]]
- [[Aide-mémoire/Commandes équivalentes|Ce que fait chaque action, en ligne de commande]]
- [[Aide-mémoire/Glossaire du datacenter|Glossaire du datacenter]]

\`\`\`mermaid
flowchart LR
    J(("Hyperscale")) --> F["Fiches<br/>cours et quiz"]
    J --> I["Incidents<br/>dépannage"]
    J --> R["Référence<br/>matériel, adressage, contrats"]
    J --> M["Aide-mémoire<br/>commandes, glossaire"]
    F <--> I
\`\`\`

> [!info] Lien avec tes cours
> Les fiches viennent du vault **cours-sisr-main** (Câblage fibre SFP et PoE, Fonctionnement d'un switch, Cisco - ACL NAT Sécurité, Pare-feu et DMZ, Linux - RAID, Sécurité de niveau 2, Méthode de dépannage réseau, Supervision SNMP Syslog NTP…), complétées pour le datacenter.
`);

/* ---------- Copie du jeu, jouable hors ligne ---------- */
const page = fs.readFileSync(path.join(GAME, 'hyperscale.html'), 'utf8');
fs.mkdirSync(path.join(VAULT, 'Jeu', 'dc'), { recursive: true });
fs.writeFileSync(path.join(VAULT, 'Jeu', 'hyperscale.html'), '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n' + page + '\n</body>\n</html>\n', 'utf8');
written.push('Jeu/hyperscale.html');
for (const f of fs.readdirSync(path.join(GAME, 'dc'))) { fs.copyFileSync(path.join(GAME, 'dc', f), path.join(VAULT, 'Jeu', 'dc', f)); written.push('Jeu/dc/' + f); }
write('Jeu/Lancer le jeu.md', `---
tags: [jeu-sisr, jeu]
---

# Lancer le jeu

← ${ACCUEIL}

- **En ligne** : [Hyperscale](${GAME_URL}). La partie est sauvegardée dans le navigateur.
- **Hors ligne** : dans l'explorateur Windows, ouvre le dossier \`Jeu\` de ce vault et double-clique sur \`hyperscale.html\`. Garde le dossier \`dc\` à côté : il contient le code du jeu. La partie hors ligne est séparée de la partie en ligne.

## Fichiers

| Fichier | Contenu |
|---|---|
| \`hyperscale.html\` | La page, la mise en forme et l'interface |
| \`dc/data.js\` | Matériel, câbles, plan d'adressage, services, contrats |
| \`dc/sim.js\` | Simulation : électricité, liens, VLAN, flux, chaleur, contrats |
| \`dc/actions.js\` | Actions du joueur et commandes équivalentes |
| \`dc/learn.js\` | Fiches, quiz et incidents |
| \`dc/console.js\` | Console et sorties des commandes |
| \`dc/view.js\` | Dessin d'une baie, face avant et face arrière |
| \`dc/room.js\` | La salle vue de dessus et le déplacement du technicien |
| \`dc/ui.js\` | Panneaux, fenêtres, recette, console, boucle de jeu |

> [!tip] Prendre en main
> - Le panneau **Contrats** donne les étapes une par une. Le bouton « 👉 Montrer » t'amène au bon endroit, « Pourquoi ? » ouvre la fiche de cours.
> - Dans la salle : flèches ou ZQSD pour marcher, clic sur une baie pour l'ouvrir. Dans une baie : F bascule face avant et face arrière, Échap revient à la salle, Espace met en pause.
> - Un double-clic sur un équipement ouvre sa fenêtre : onglets **Physique** (alimentations, ports, câbles), **Config** (VLAN, RAID, ACL…), **CLI** (vraies commandes Cisco IOS) et **Aide** (mode d'emploi et fiches liées).
`);

/* ---------- Nettoyage : notes générées qui n'existent plus (fiches renumérotées, fichiers retirés) ---------- */
const keep = new Set(written.map(w => w.split('/').join(path.sep)));
for (const dir of ['Fiches', 'Incidents', 'Référence', 'Aide-mémoire', 'Jeu']) {
  (function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f), rel = path.relative(VAULT, p);
      if (fs.statSync(p).isDirectory()) { walk(p); continue; }
      if (keep.has(rel)) continue;
      const gen = rel.startsWith(path.join('Jeu', 'dc')) || (f.endsWith('.md') && /^tags: \[jeu-sisr/m.test(fs.readFileSync(p, 'utf8')));
      if (gen) { fs.unlinkSync(p); console.log('supprimé (obsolète) : ' + rel); }
    }
  })(path.join(VAULT, dir));
}
console.log(written.length + ' fichiers');
console.log(written.join('\n'));
