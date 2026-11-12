// Tests automatiques d'Hyperscale : les règles du jeu tournent sans navigateur.
// Usage : node tools/test.js   (code de sortie 1 si un test échoue)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
global.localStorage = { getItem() { return null; }, setItem() { } };
const src = ['data', 'sim', 'actions', 'learn', 'console', 'cours'].map(f => fs.readFileSync(path.join(root, 'dc', f + '.js'), 'utf8').replace(/^'use strict';/m, '')).join('\n');
const G = new Function(src + `
return { CAT, CABLES, MODULES, CONTRACTS, FICHES, INCIDENTS, ECO, DEFAULT_UNLOCKED,
  newState, derive, simStep, cableCheck, contractDef, devsOfKind, freeIp,
  actAccept, actPlace, actPlug, actConnect, actModule, actPortCfg, actDeploy, actAddRule, actAddDisk, actSetRaid, actInstallRack,
  get S() { return S; }, set S(v) { S = v; }, get D() { return D; } };`)();

let pass = 0; const fails = [];
function test(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fails.push(name); console.log('ÉCHEC ' + name + '\n      ' + String(e.message).split('\n')[0]); }
}
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || 'valeur'} : attendu ${JSON.stringify(b)}, reçu ${JSON.stringify(a)}`); };
const yes = (v, m) => { if (!v) throw new Error(m || 'condition fausse'); };
const isErr = (r, m) => { if (typeof r !== 'string') throw new Error((m || 'action') + ' : un refus était attendu'); };
const isOk = (r, m) => { if (typeof r === 'string') throw new Error((m || 'action') + ' refusée : ' + r); return r; };

/* ---------- Données ---------- */
console.log('Données');
test('nouvelle partie : argent de départ, baie MMR et premier contrat', () => {
  const S = G.newState();
  eq(S.money, G.ECO.start, 'argent'); eq(S.racks.length, 1, 'baies'); eq(S.contracts[0].id, 'c1', 'contrat');
});
test('18 contrats : un client, une prime, et des étapes pour chaque mission', () => {
  eq(G.CONTRACTS.length, 18, 'nombre de contrats');
  for (const c of G.CONTRACTS) {
    yes(c.client && c.what, c.id + ' sans client ou sans description');
    yes(c.bonus > 0 && Array.isArray(c.unlock) && Array.isArray(c.notions), c.id + ' : prime, déblocages ou notions absents');
    if (c.mission) yes(c.goals && c.goals.length, c.id + ' : mission sans étape');
  }
});
test('chaque étape de contrat renvoie à une fiche qui existe', () => {
  const ids = new Set(G.FICHES.map(f => f.id));
  for (const c of G.CONTRACTS) for (const g of c.goals || []) if (g.fiche) yes(ids.has(g.fiche), `${c.id} : fiche « ${g.fiche} » introuvable`);
});
test('chaque incident a un titre et des indices', () => {
  for (const [k, i] of Object.entries(G.INCIDENTS)) { yes(i.title, k + ' sans titre'); yes(typeof i.hints === 'function', k + ' sans indices'); }
});
test('chaque module a un prix, une norme et un type de fibre ou de cuivre', () => {
  for (const [k, m] of Object.entries(G.MODULES)) { yes(m.price && m.price.sfp != null, k + ' sans prix SFP+'); yes(['mm', 'sm', 'cu'].includes(m.media), k + ' : support inconnu'); yes(m.norm, k + ' sans norme'); }
});

/* ---------- Une salle complète, comme dans les premiers contrats ---------- */
console.log('Construction');
let S, rtr, fw, sw, srv, srv2, nas, odf;
test('poser une baie et y installer le matériel', () => {
  S = G.newState();
  S.unlocked = [...new Set([...S.unlocked, ...Object.keys(G.CAT), ...Object.keys(G.CABLES), ...Object.keys(G.MODULES)])];
  S.money = 200000;
  for (const id of ['c6', 'c8']) { S.contracts.push({ id, state: 'offer' }); G.actAccept(id); }
  const R = isOk(G.actInstallRack('A', 1), 'baie');
  rtr = isOk(G.actPlace('router', R, 40)); fw = isOk(G.actPlace('fw', R, 38)); sw = isOk(G.actPlace('sw24', R, 36));
  srv = isOk(G.actPlace('srv1', R, 34)); srv2 = isOk(G.actPlace('srv1', R, 32)); nas = isOk(G.actPlace('nas', R, 28));
  for (const d of [rtr, fw, sw, srv, srv2, nas]) d.psus.forEach((_, i) => isOk(G.actPlug(d, i, i ? 'B' : 'A'), 'alimentation'));
  odf = G.devsOfKind('odf')[0];
  yes(odf, 'tiroir optique absent de la salle MMR');
});
test('deux équipements ne tiennent pas dans la même unité', () => {
  isErr(G.actPlace('srv1', srv.rack, 34), 'pose sur une unité occupée');
});
test('un achat trop cher est refusé et ne coûte rien', () => {
  const m = S.money; S.money = 5;
  isErr(G.actPlace('srv1', srv.rack, 20), 'achat sans argent');
  eq(S.money, 5, 'argent'); S.money = m;
});

console.log('Modules de cage et câbles');
const A = () => ({ d: rtr.id, p: 'Te0/0/0' }), OP = () => ({ d: odf.id, p: 'OP1' });
test('fibre vers l\'opérateur refusée sans module', () => {
  yes(!G.cableCheck('os2', A(), OP()).ok, 'la fibre passe sans module');
  isErr(G.actConnect('os2', A(), OP()), 'fibre sans module');
});
test('module SR (multimode) refusé sur une fibre monomode', () => {
  isOk(G.actModule(rtr, 'Te0/0/0', 'SR'));
  yes(!G.cableCheck('os2', A(), OP()).ok, 'SR accepté sur OS2');
});
test('retirer un module sain le rembourse', () => {
  const m = S.money; isOk(G.actModule(rtr, 'Te0/0/0', null));
  eq(S.money, m + G.MODULES.SR.price.sfp, 'argent après retrait');
});
test('module LR + fibre OS2 : le lien opérateur monte', () => {
  isOk(G.actModule(rtr, 'Te0/0/0', 'LR'));
  yes(G.cableCheck('os2', A(), OP()).ok, G.cableCheck('os2', A(), OP()).why);
  isOk(G.actConnect('os2', A(), OP()));
});
test('un module ne se retire pas quand un câble est branché', () => {
  isErr(G.actModule(rtr, 'Te0/0/0', null), 'retrait sous câble');
});
test('DAC entre deux cages vides accepté, refusé si un module est présent', () => {
  isOk(G.actConnect('dac', { d: rtr.id, p: 'Te0/1/0' }, { d: fw.id, p: 'port1' }));
  isOk(G.actModule(sw, 'Te1/1/1', 'SR'));
  isErr(G.actConnect('dac', { d: fw.id, p: 'port2' }, { d: sw.id, p: 'Te1/1/1' }), 'DAC sur cage équipée');
  isOk(G.actModule(sw, 'Te1/1/1', null));
  isOk(G.actConnect('dac', { d: fw.id, p: 'port2' }, { d: sw.id, p: 'Te1/1/1' }));
});
test('câble cuivre refusé dans une cage vide, accepté avec un module T', () => {
  isErr(G.actConnect('cat6', { d: srv.id, p: 'eno1' }, { d: sw.id, p: 'Te1/1/3' }), 'cuivre dans une cage');
  isOk(G.actModule(sw, 'Te1/1/3', 'T'));
  yes(G.cableCheck('cat6', { d: srv.id, p: 'eno1' }, { d: sw.id, p: 'Te1/1/3' }).ok, 'module T refusé');
  isOk(G.actModule(sw, 'Te1/1/3', null));
});
test('un port déjà câblé ne reçoit pas un second câble', () => {
  isOk(G.actConnect('cat6', { d: srv.id, p: 'eno1' }, { d: sw.id, p: 'Gi1/0/1' }));
  isErr(G.actConnect('cat6', { d: srv2.id, p: 'eno1' }, { d: sw.id, p: 'Gi1/0/1' }), 'port occupé');
  isOk(G.actConnect('cat6', { d: srv2.id, p: 'eno1' }, { d: sw.id, p: 'Gi1/0/2' }));
});

console.log('Réseau, services et simulation');
test('VLAN, stockage RAID, services et règles de pare-feu', () => {
  isOk(G.actConnect('dac', { d: nas.id, p: 'eth0' }, { d: sw.id, p: 'Te1/1/2' }));
  for (let b = 0; b < 4; b++) isOk(G.actAddDisk(nas, b, 'ssd'), 'disque');
  isOk(G.actSetRaid(nas, '5'), 'RAID 5');
  G.actPortCfg(fw, 'port2', { mode: 'trunk', allowed: [10, 20, 99] });
  for (const p of ['Te1/1/1', 'Gi1/0/1', 'Gi1/0/2']) G.actPortCfg(sw, p, { mode: 'trunk', allowed: [10, 20, 30, 99], native: 999 });
  G.actPortCfg(sw, 'Te1/1/2', { vlan: 30 });
  G.derive();
  isOk(G.actDeploy('c6', 'web', srv.id, 10, G.freeIp(10), srv.id), 'site web');
  isOk(G.actDeploy('c8', 'web', srv2.id, 10, G.freeIp(10), srv2.id), 'second site');
  isOk(G.actDeploy('c8', 'db', srv.id, 20, G.freeIp(20), srv.id), 'base de données');
  for (const r of [['Internet', 'DMZ', 'tcp', 443], ['DMZ', 'SERVEURS', 'tcp', 5432]]) G.actAddRule({ src: r[0], dst: r[1], proto: r[2], port: r[3] });
  G.derive();
  eq(S.vms.length, 3, 'machines virtuelles');
});
test('deux machines ne peuvent pas avoir la même adresse IP', () => {
  isErr(G.actDeploy('c8', 'web', srv2.id, 10, S.vms[0].ip, srv2.id), 'adresse en double');
});
test('trois jours de jeu sans erreur, avec pannes et tickets', () => {
  for (let i = 0; i < 3 * 1440; i++) { G.simStep(1); if (G.D.dirty) G.derive(); }
  yes(S.t > 3 * 1440, 'le temps n\'avance pas');
  yes(Number.isFinite(S.money), 'argent invalide : ' + S.money);
  for (const t of Object.values(G.D.temp || {})) yes(Number.isFinite(t), 'température invalide');
});
test('la partie se sauvegarde et se recharge à l\'identique', () => {
  const txt = JSON.stringify(S), back = JSON.parse(txt);
  eq(JSON.stringify(back), txt, 'aller-retour');
  G.S = back; G.derive();
  for (let i = 0; i < 120; i++) { G.simStep(1); if (G.D.dirty) G.derive(); }
  yes(Object.keys(G.S.devs).length === Object.keys(S.devs).length, 'équipements perdus au rechargement');
});

console.log(`\n${pass} tests réussis, ${fails.length} en échec.`);
if (fails.length) { console.log('En échec : ' + fails.join(' ; ')); process.exit(1); }
