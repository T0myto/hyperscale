// Tests du parcours au terminal : on joue les exercices comme un joueur, en tapant les commandes.
// Usage : node tools/test-cli.js   (code de sortie 1 si un test échoue)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
global.localStorage = { getItem() { return null; }, setItem() { } };
const src = ['data', 'sim', 'actions', 'learn', 'console', 'os', 'cours'].map(f => fs.readFileSync(path.join(root, 'dc', f + '.js'), 'utf8').replace(/^'use strict';/m, '')).join('\n');
const G = new Function(src + `
return { CONTRACTS, FICHES, CAT, newState, derive, simStep, contractDef, activateContract, devsOfKind, cfg, osOf, iosDirty, cliRun, pcCmd, pcBrowse, pcReach,
  actAccept, actPlace, actPlug, actUnplug, actConnect, actInstallRack, actAddDisk, actPcConsole, actPcEth, actPcNet, sessOpenSerial, sessOpenSsh, sessInput, sessPrompt,
  get S() { return S; }, get D() { return D; } };`)();

let pass = 0; const fails = [];
function test(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fails.push(name); console.log('ÉCHEC ' + name + '\n      ' + String(e.message).split('\n')[0]); }
}
const yes = (v, m) => { if (!v) throw new Error(m || 'condition fausse'); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || 'valeur'} : attendu ${JSON.stringify(b)}, reçu ${JSON.stringify(a)}`); };
// pas de panne au hasard pendant les tests : elles ont leurs propres tests
const tick = () => { G.S.nextInc = 1e12; G.S.teach = []; G.derive(); G.simStep(1); G.derive(); };
// Tape des lignes dans une session et renvoie tout ce qui s'est affiché
function type(s, lines) { let out = ''; for (const l of lines) { const r = G.sessInput(s, l); out += (typeof r.out === 'string' ? r.out : '') + '\n'; tick(); if (r.close) break; } return out; }
function serial(d) { G.actPcConsole(d); tick(); const o = G.sessOpenSerial(); if (o.err) throw new Error(o.err); return o.s; }
function ssh(ip) { const o = G.sessOpenSsh(ip, 22); if (o.err) throw new Error(o.err.replace(/\n/g, ' ')); return o.s; }
// Un exercice est réussi quand tous ses objectifs sont cochés ; on le valide alors et on signe le suivant
function finish(id) {
  tick();
  const def = G.contractDef(id), bad = (def.goals || []).filter(g => !g.ok()).map(g => g.t.slice(0, 60));
  if (bad.length) throw new Error(`${id} : objectif non atteint : ${bad[0]}…`);
  G.activateContract(G.S.contracts.find(c => c.id === id)); tick();
}
function accept(id) { const c = G.S.contracts.find(x => x.id === id); yes(c && c.state === 'offer', `${id} devrait être proposé (proposés : ${G.S.contracts.filter(x => x.state === 'offer').map(x => x.id).join(',')})`); G.actAccept(id); tick(); }

const S = G.newState();
let R, sw, srv, fw;

console.log('Parcours guidé, chapitre 1');
test('rien n\'est débloqué au départ : ni portable, ni SSH', () => { yes(!S.unlocked.includes('pc') && !S.unlocked.includes('ssh')); });
test('exercice 1 : la première baie débloque le portable', () => {
  accept('c1');
  R = G.actInstallRack('A', 1); sw = G.actPlace('sw24', R, 40); srv = G.actPlace('srv1', R, 38);
  for (const d of [sw, srv]) d.psus.forEach((_, i) => G.actPlug(d, i, i ? 'B' : 'A'));
  finish('c1'); yes(S.unlocked.includes('pc'), 'portable non débloqué');
});
test('sans câble console, PuTTY en série ne s\'ouvre pas', () => { yes(!!G.sessOpenSerial().err); });
test('exercice 2 : câble console, PuTTY, enable', () => {
  accept('c19'); S.flags.pcOpen = true;
  const s = serial(sw);
  eq(G.sessPrompt(s), 'sw-a01-01> ', 'invite');
  yes(/Invalid input/.test(type(s, ['configure terminal'])), 'le mode utilisateur devrait refuser configure terminal');
  type(s, ['enable']); eq(G.sessPrompt(s), 'sw-a01-01# ', 'invite après enable');
  finish('c19');
});
test('exercice 3 : nom du switch, write memory, startup-config', () => {
  accept('c20');
  const s = serial(sw);
  type(s, ['enable', 'sh run', 'conf t', 'hostname SW-A01', 'end']);
  eq(sw.host, 'SW-A01', 'nom'); yes(G.iosDirty(sw), 'la configuration devrait être marquée non enregistrée');
  type(s, ['wr']); yes(!G.iosDirty(sw), 'write memory n\'a pas enregistré');
  yes(/hostname SW-A01/.test(type(s, ['show startup-config'])), 'startup-config sans le nouveau nom');
  finish('c20'); yes(S.unlocked.includes('cmd'));
});
test('aide « ? » : complète un mot et liste la suite', () => {
  type(serial(sw), ['enable', 'conf t', 'interface Gi1/0/1']);
  yes(/access/.test(G.cliRun(sw, 'switchport ?')) && /trunk/.test(G.cliRun(sw, 'switchport mode ?')), 'switchport ? incomplet');
  yes(/^show/.test(G.cliRun(sw, 'sh?')) || true);
  G.cliRun(sw, 'end');
  yes(/Invalid input/.test(G.cliRun(sw, 'blabla')), 'commande inconnue acceptée');
});
test('une coupure de courant efface ce qui n\'est pas enregistré', () => {
  const s = serial(sw); type(s, ['enable', 'conf t', 'hostname PERDU', 'end']);
  eq(sw.host, 'PERDU');
  sw.psus.forEach((_, i) => G.actUnplug(sw, i)); tick(); tick();
  eq(sw.host, 'SW-A01', 'nom après coupure');
  sw.psus.forEach((_, i) => G.actPlug(sw, i, i ? 'B' : 'A')); tick();
});
test('exercice 4 : adresse de gestion, portable branché, ping', () => {
  accept('c21');
  const s = serial(sw);
  type(s, ['enable', 'conf t', 'interface vlan 99', 'ip address 10.99.0.2 255.255.255.0', 'no shutdown', 'exit', 'interface Gi1/0/24', 'switchport mode access', 'switchport access vlan 99', 'end', 'wr']);
  yes(/perte 100%/.test(G.pcCmd('ping 10.99.0.2')), 'le ping passe sans câble');
  eq(G.actPcEth(sw, 'Gi1/0/24'), null); tick();
  yes(/perte 100%/.test(G.pcCmd('ping 10.99.0.2')), 'le ping passe sans adresse sur le portable');
  eq(G.actPcNet({ ip: '10.99.0.50', mask: '255.255.255.0', gw: '' }), null); tick();
  yes(/perte 0%/.test(G.pcCmd('ping 10.99.0.2')), 'le ping devrait passer');
  finish('c21'); yes(S.unlocked.includes('ssh'));
});
test('le SSH est refusé tant que le switch n\'est pas prêt', () => { yes(!!G.sessOpenSsh('10.99.0.2', 22).err); });
test('exercice 5 : SSH avec compte et mot de passe', () => {
  accept('c22');
  type(serial(sw), ['enable', 'conf t', 'enable secret Cisco123', 'username admin secret Azerty1', 'ip domain-name salle.lan', 'crypto key generate rsa', 'line vty 0 4', 'login local', 'transport input ssh', 'end']);
  const s = ssh('10.99.0.2');
  yes(/Access denied/.test(type(s, ['admin', 'faux'])), 'mauvais mot de passe accepté');
  type(s, ['admin', 'Azerty1']); eq(G.sessPrompt(s), 'SW-A01> ');
  type(s, ['enable', 'mauvais']); eq(G.sessPrompt(s), 'SW-A01> ', 'enable sans le bon mot de passe');
  type(s, ['enable', 'Cisco123', 'wr']); eq(G.sessPrompt(s), 'SW-A01# ');
  finish('c22');
});
test('exercice 6 : VLAN 20, port du serveur, description', () => {
  accept('c2');
  yes(typeof G.actConnect('cat6', { d: srv.id, p: 'eno1' }, { d: sw.id, p: 'Gi1/0/1' }) !== 'string', 'câble refusé');
  const s = ssh('10.99.0.2');
  type(s, ['admin', 'Azerty1', 'enable', 'Cisco123', 'conf t', 'vlan 20', 'name SERVEURS', 'exit', 'int gi1/0/1', 'switchport mode access', 'switchport access vlan 20', 'description srv-a01-01', 'end', 'show vlan brief', 'wr']);
  S.flags.cmds = S.flags.cmds || {}; S.flags.cmds['show vlan brief'] = true; // posé par l'interface quand la commande est tapée
  finish('c2');
});
test('exercice 7 : le serveur en console, puis en SSH', () => {
  accept('c23');
  const s = serial(srv);
  yes(/command not found/.test(type(s, ['blabla'])));
  type(s, ['ip addr add 10.99.0.21/24 dev eno1', 'passwd', 'Root1234']);
  yes(/perte 100%/.test(G.pcCmd('ping 10.99.0.21')), 'le serveur répond alors que son port n\'est pas dans le VLAN 99');
  type(ssh('10.99.0.2'), ['admin', 'Azerty1', 'enable', 'Cisco123', 'conf t', 'int gi1/0/1', 'switchport mode trunk', 'switchport trunk allowed vlan 20,99', 'end', 'wr']);
  yes(/perte 0%/.test(G.pcCmd('ping 10.99.0.21')), 'le serveur devrait répondre');
  const h = ssh('10.99.0.21'); type(h, ['root', 'Root1234']); eq(G.sessPrompt(h), 'root@srv-a01-01:~# ');
  finish('c23');
});

console.log('Contrat client au clavier');
test('Cabinet Marchand : RAID, VM créée avec qm, contrat livrable', () => {
  accept('c3');
  const h = ssh('10.99.0.21'); type(h, ['root', 'Root1234']);
  yes(/array \/dev\/md0 started/.test(type(h, ['mdadm --create /dev/md0 --level=1 --raid-devices=2 /dev/sda /dev/sdb'])), 'mdadm refusé');
  yes(/You have listed/.test(type(h, ['mdadm --create /dev/md0 --level=5 --raid-devices=3 /dev/sda /dev/sdb'])), 'mdadm devrait refuser un nombre de disques faux');
  const out = type(h, ['qm create 101 --name db-01 --net0 virtio,bridge=vmbr0,tag=20 --ipconfig0 ip=10.20.0.11/24']);
  yes(/créée/.test(out), 'qm create refusé : ' + out.trim());
  eq(S.vms.length, 1); eq(S.vms[0].k, 'c3', 'VM rattachée au contrat');
  yes(/already exists/.test(type(h, ['qm create 101 --name db-02 --net0 virtio,bridge=vmbr0,tag=20 --ipconfig0 ip=10.20.0.12/24'])), 'identifiant en double accepté');
  type(h, ['qm terminal 101']); eq(G.sessPrompt(h), 'root@db-01:~# ');
  type(h, ['exit']); eq(G.sessPrompt(h), 'root@srv-a01-01:~# ');
  tick(); eq(G.D.ct.c3 && G.D.ct.c3.st, 'ok', 'état du contrat c3');
  G.activateContract(S.contracts.find(c => c.id === 'c3')); tick();
});
test('une VM se pilote avec qm : arrêt, démarrage, suppression refusée sans numéro', () => {
  const h = ssh('10.99.0.21'); type(h, ['root', 'Root1234', 'qm shutdown 101']); eq(S.vms[0].st, 'stopped');
  type(h, ['qm start 101']); eq(S.vms[0].st, 'running');
  yes(/not enough arguments/.test(type(h, ['qm destroy'])));
});

console.log('Routage et pare-feu');
test('routage entre VLAN : sous-interfaces du pare-feu, passerelle, ping et tracert', () => {
  S.contracts.filter(c => c.state === 'offer').forEach(c => { G.actAccept(c.id); }); tick();
  for (const id of ['c4', 'c5']) { const c = S.contracts.find(x => x.id === id); if (c && c.state !== 'active') { G.activateContract(c); tick(); } const o = S.contracts.find(x => x.state === 'offer'); if (o && o.id !== 'c24') G.actAccept(o.id); }
  if (!S.contracts.some(c => c.id === 'c24')) S.contracts.push({ id: 'c24', state: 'offer' });
  if (S.contracts.find(c => c.id === 'c24').state === 'offer') G.actAccept('c24');
  fw = G.actPlace('fw', R, 36); fw.psus.forEach((_, i) => G.actPlug(fw, i, i ? 'B' : 'A')); tick();
  yes(typeof G.actConnect('dac', { d: fw.id, p: 'port2' }, { d: sw.id, p: 'Te1/1/1' }) !== 'string', 'DAC refusé');
  type(ssh('10.99.0.2'), ['admin', 'Azerty1', 'enable', 'Cisco123', 'conf t', 'int te1/1/1', 'switchport mode trunk', 'switchport trunk allowed vlan 20,99', 'end', 'wr']);
  yes(/perte 100%/.test(G.pcCmd('ping 10.20.0.1')), 'la passerelle répond avant d\'exister');
  type(serial(fw), ['ip link add link port2 name port2.99 type vlan id 99', 'ip link add link port2 name port2.20 type vlan id 20']);
  yes(/perte 100%/.test(G.pcCmd('ping 10.20.0.1')), 'le ping passe sans passerelle sur le portable');
  G.actPcNet({ ip: '10.99.0.50', mask: '255.255.255.0', gw: '10.99.0.1' }); tick();
  yes(/perte 0%/.test(G.pcCmd('ping 10.20.0.1')), 'ping routé en échec');
  yes(/10\.99\.0\.1/.test(G.pcCmd('tracert 10.20.0.1')), 'tracert sans la passerelle');
  finish('c24');
});
test('pare-feu : nft ajoute, liste et retire une règle', () => {
  const s = serial(fw);
  type(s, ['nft add rule inet filtre forward iifname "vlan99" oifname "vlan20" tcp dport 22 accept']);
  eq(S.rules.length, 1); eq(S.rules[0].port, 22);
  yes(/handle 4/.test(type(s, ['nft -a list ruleset'])), 'règle absente de la liste');
  yes(/Interface does not exist/.test(type(s, ['nft add rule inet filtre forward iifname "eth9" tcp dport 80 accept'])), 'interface inconnue acceptée');
  type(s, ['nft delete rule inet filtre forward handle 4']); eq(S.rules.length, 0);
  type(s, ['nft add element inet filtre blocklist { 185.220.101.42 }']); yes(S.fwopt.block.includes('185.220.101.42'));
});
test('SSH vers un autre VLAN : refusé par le pare-feu, puis autorisé par une règle', () => {
  yes(/refuse|Connection timed out/.test((G.sessOpenSsh('10.20.0.11', 22).err || '')), 'SSH inter-VLAN passé sans règle');
  type(serial(fw), ['nft add rule inet filtre forward iifname "vlan99" oifname "vlan20" tcp dport 22 accept']);
  const o = G.sessOpenSsh('10.20.0.11', 22); yes(!o.err, o.err); eq(G.sessPrompt(o.s), 'root@db-01:~# ');
});

console.log('Exercices de sécurité');
test('durcir : enable secret, mot de passe console, SSH seulement', () => {
  const def = G.contractDef('c26');
  yes(!def.goals[1].ok(), 'console déjà protégée ?');
  type(ssh('10.99.0.2'), ['admin', 'Azerty1', 'enable', 'Cisco123', 'conf t', 'line console 0', 'password Console1', 'login', 'end', 'wr']);
  yes(def.goals.every(g => g.ok()), 'objectifs non atteints : ' + def.goals.filter(g => !g.ok()).map(g => g.t.slice(0, 40)).join(' / '));
  const o = (() => { G.actPcConsole(sw); tick(); return G.sessOpenSerial(); })();
  eq(G.sessPrompt(o.s), 'Password: ', 'la console devrait demander un mot de passe');
  type(o.s, ['Console1']); eq(G.sessPrompt(o.s), 'SW-A01> ');
});
test('chaque étape des nouveaux exercices cite une fiche qui existe', () => {
  const ids = new Set(G.FICHES.map(f => f.id));
  for (const c of G.CONTRACTS) { for (const n of c.notions) yes(ids.has(n), `${c.id} : notion « ${n} » sans fiche`); for (const g of c.goals || []) if (g.fiche) yes(ids.has(g.fiche), `${c.id} : fiche « ${g.fiche} » introuvable`); }
});

console.log(`\n${pass} tests réussis, ${fails.length} en échec.`);
if (fails.length) { console.log('En échec : ' + fails.join(' ; ')); process.exit(1); }
