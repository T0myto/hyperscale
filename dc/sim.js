'use strict';
/* =========================================================
   Hyperscale — simulation : état, énergie, liens, VLAN, flux
   ========================================================= */
let S = null;
let D = { powered: {}, draw: {}, util: {}, link: {}, adj: {}, pdu: {}, temp: {}, vm: {}, ct: {}, inet: { ok: false }, cUse: {}, rate: 0, cost: 0, cpu: {} };
let REV = 0;
function touch() { REV++; D.dirty = true; }

const PDU_CAP = 3680; // 16 A x 230 V
const rackName = i => { const k = S.racks[i]; return !k ? '?' : k.row === 'MMR' ? 'MMR' : k.row + String(k.pos).padStart(2, '0'); };
const feedLive = p => S.feeds[p] && !S.power.ups[p].trip && (S.power.edf || S.power.genRun || S.power.batt > 0);
const rowPowered = r => { const k = S.racks[r]; return !!k && (k.row === 'MMR' || !!S.power.rows[k.row]); };
function rackXY(r) {
  const k = S.racks[r];
  if (k.row === 'MMR') return { x: MMR_RACK.x + 0.6, y: MMR_RACK.y + 0.3 };
  return { x: ROW_X0 + (k.pos - 1) * RACK_W + 0.3, y: ROW_Y[k.row] + 0.6 };
}
const rackAt = (row, pos) => S.racks.findIndex(k => k.row === row && k.pos === pos);
const dev = id => S.devs[id];
const kindOf = d => CAT[d.type].kind;
const devsIn = r => Object.values(S.devs).filter(d => d.rack === r);
const devsOfKind = k => Object.values(S.devs).filter(d => kindOf(d) === k);
const portDef = (d, p) => CAT[d.type].ports.find(x => x.id === p);
const nameOf = d => d.host || CAT[d.type].name;
const unlocked = key => !key || S.unlocked.includes(key);
const speedName = s => s >= 1000 ? (s / 1000).toLocaleString('fr-FR') + ' Gbit/s' : s + ' Mbit/s';
const fmtLen = m => m < 1 ? (m * 100).toFixed(0) + ' cm' : m.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' m';
const money = n => Math.round(n).toLocaleString('fr-FR') + ' €';
const portTypeName = t => ({ rj45: 'RJ45 cuivre', sfp: 'cage SFP+', qsfp: 'cage QSFP+' }[t] || t);
function clock(t) {
  const day = Math.floor(t / 1440) + 1, m = Math.floor(t % 1440);
  return { day, hh: String(Math.floor(m / 60)).padStart(2, '0'), mm: String(m % 60).padStart(2, '0'), stamp: `J${day} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` };
}

/* ---------- Journal ---------- */
function logEvent(msg, kind) {
  S.events.unshift({ t: S.t, msg, kind: kind || 'info' });
  if (S.events.length > 120) S.events.length = 120;
}
function syslog(d, sev, msg) {
  S.syslog.push({ t: S.t, d: d.id, sev, msg });
  if (S.syslog.length > 600) S.syslog.splice(0, S.syslog.length - 600);
}
function cli(d, lines) {
  S.cli.push({ t: S.t, d: d ? d.id : null, lines });
  if (S.cli.length > 200) S.cli.shift();
  if (typeof onCli === 'function') onCli(d, lines);
}

/* ---------- Création ---------- */
function newState() {
  S = {
    v: 3, money: ECO.start, t: 8 * 60, xp: 0, racks: [], devs: {}, cables: [], vms: [], rules: [], contracts: [], tickets: [],
    codex: { seen: {}, quiz: {} }, unlocked: [...DEFAULT_UNLOCKED], feeds: { A: true, B: true },
    power: { edf: true, batt: 15, battMax: 15, gen: false, genRun: false, genT: 0, ups: { A: { kw: 20, trip: false }, B: { kw: 20, trip: false } }, rows: { A: true } },
    cool: { cracs: [{ slot: 0, ok: true }], contain: {} },
    room: { op2: false }, fwopt: { syn: false, scrub: false, block: [] },
    seq: { d: 0, c: 0, v: 0, t: 0, h: {}, s: {} }, syslog: [], events: [], cli: [], flags: {}, timers: {},
    nextInc: 8 * 60 + 200, teach: [], speed: 1, done: 0, tuto: true,
  };
  addRack('MMR', 0, 'mmr');
  addDevice('odf', 0, 21);
  S.contracts.push({ id: 'c1', state: 'offer' });
  logEvent("Prise de poste : la salle est vide. Seules l'arrivée des opérateurs (salle MMR), l'électricité et un climatiseur sont en place.", 'info');
  return S;
}
function addRack(row, pos, kind) {
  S.racks.push({ row, pos, kind: kind || 'rack', trip: { A: false, B: false } });
  return S.racks.length - 1;
}
function makeHost(type, r) {
  const k = CAT[type].kind;
  const pre = { router: 'rtr', fw: 'fw', odf: 'odf', nas: 'nas', server: 'srv' }[k] || (type === 'leaf' ? 'leaf' : type === 'spine' ? 'spine' : k === 'switch' ? 'sw' : null);
  if (!pre) return '';
  if (pre === 'rtr' || pre === 'fw') { S.seq.h[pre] = (S.seq.h[pre] || 0) + 1; return `${pre}-${String(S.seq.h[pre]).padStart(2, '0')}`; }
  const key = pre + rackName(r);
  S.seq.h[key] = (S.seq.h[key] || 0) + 1;
  return `${pre}-${rackName(r).toLowerCase()}-${String(S.seq.h[key]).padStart(2, '0')}`;
}
function addDevice(type, r, u) {
  const c = CAT[type];
  const d = {
    id: 'd' + (++S.seq.d), type, rack: r, u, host: makeHost(type, r),
    psus: Array.from({ length: c.psu }, () => ({ ok: true, out: null })),
    cfg: {}, mods: {}, modFail: {}, disks: [], raid: 'none', ram: c.ram || 0, on: true,
  };
  if (c.kind === 'server') { d.disks = Array.from({ length: c.bays }, (_, i) => i < 2 ? { type: 'ssd', st: 'ok', rb: 0 } : null); d.raid = '1'; }
  if (c.kind === 'nas') { d.disks = Array(c.bays).fill(null); d.raid = 'none'; }
  if (c.kind === 'odf') { d.mods.OP1 = 'LR'; d.mods.OP2 = 'LR'; }
  S.devs[d.id] = d;
  return d;
}
function cfg(d, pid) {
  return d.cfg[pid] || (d.cfg[pid] = { admin: true, mode: 'access', vlan: 1, allowed: [], native: 1, speed: 'auto', duplex: 'auto', bpdu: false, psec: false, err: null, grp: 0, desc: '' });
}
const hasCfg = (d, pd) => kindOf(d) === 'switch' || (kindOf(d) === 'fw' && pd.role === 'lan');

/* ---------- Emplacements ---------- */
function slotMap(r, ignore) {
  const m = new Array(RACK_U + 2).fill(null);
  for (const d of devsIn(r)) { if (d.id === ignore) continue; for (let k = 0; k < CAT[d.type].u; k++) m[d.u + k] = d.id; }
  return m;
}
function fits(type, r, u, ignore) {
  const h = CAT[type].u;
  if (r < 0 || r >= S.racks.length || u < 1 || u + h - 1 > RACK_U) return false;
  const m = slotMap(r, ignore);
  for (let k = 0; k < h; k++) if (m[u + k]) return false;
  return true;
}

/* ---------- Câbles ---------- */
function portCable(d, p) { return S.cables.find(c => (c.a.d === d && c.a.p === p) || (c.b.d === d && c.b.p === p)); }
function otherEnd(c, d, p) { return (c.a.d === d && c.a.p === p) ? c.b : c.a; }
function portPos(e) { const d = dev(e.d); return { r: d.rack, u: d.u + CAT[d.type].u / 2 }; }
function cableLen(a, b) {
  const A = portPos(a), B = portPos(b);
  if (A.r === B.r) return Math.abs(A.u - B.u) * 0.0445 + 0.6;
  const P = rackXY(A.r), Q = rackXY(B.r);
  return Math.abs(P.x - Q.x) + Math.abs(P.y - Q.y) + (43 - A.u) * 0.0445 + (43 - B.u) * 0.0445 + 1.5;
}
const stdLen = m => STD_LEN.find(x => x >= m) || Math.ceil(m / 5) * 5;
function cableCheck(type, a, b) {
  const ct = CABLES[type], da = dev(a.d), db = dev(b.d), pa = portDef(da, a.p), pb = portDef(db, b.p);
  const res = { ok: false, type, why: '', len: 0, L: 0, cost: 0, mods: [], speed: 0 };
  if (a.d === b.d && a.p === b.p) { res.why = "C'est le même port."; return res; }
  if (!unlocked(ct.unlock)) { res.why = "Pas encore au catalogue : livre d'autres contrats."; return res; }
  if (pa.t !== pb.t) { res.why = `Les deux ports ne sont pas du même type (${portTypeName(pa.t)} et ${portTypeName(pb.t)}).`; return res; }
  const t = pa.t;
  if (ct.ends === 'rj45' && t !== 'rj45') { res.why = "Un câble cuivre se branche sur deux prises RJ45."; return res; }
  if (ct.ends === 'sfp' && t !== 'sfp') { res.why = t === 'rj45' ? "Un DAC se branche dans des cages SFP+, pas sur du RJ45." : "Ce DAC est au format SFP+, pas QSFP+."; return res; }
  if (ct.ends === 'qsfp' && t !== 'qsfp') { res.why = "Ce DAC est au format QSFP+ 40G."; return res; }
  if (ct.ends === 'fiber' && t === 'rj45') { res.why = "La fibre arrive dans une cage SFP+ ou QSFP+ équipée d'un module, pas dans une prise RJ45."; return res; }
  const speed = Math.min(pa.speed, pb.speed);
  res.speed = speed;
  res.len = cableLen(a, b); res.L = stdLen(res.len);
  const max = ct.max[speed];
  if (!max) { res.why = `${ct.name} ne transporte pas ${speedName(speed)}.`; return res; }
  if (res.L > max) { res.why = `Trop long : il faut ${fmtLen(res.L)}, et ce câble est limité à ${max} m à ${speedName(speed)}.`; return res; }
  let modCost = 0;
  for (const [e, d, pd] of [[a, da, pa], [b, db, pb]]) {
    const cur = d.mods[e.p];
    if (pd.op) { if (ct.module !== 'LR') { res.why = "L'opérateur livre de la fibre monomode : il faut de l'OS2 et des modules LR."; return res; } continue; }
    if (ct.noModule) { if (cur) { res.why = `Retire d'abord le module ${cur} de ${e.p} : un DAC a ses modules intégrés.`; return res; } continue; }
    if (ct.module) {
      if (cur && cur !== ct.module) { res.why = `${e.p} a déjà un module ${cur}. Il faut des modules ${ct.module} aux deux bouts.`; return res; }
      if (!cur) { res.mods.push(e); modCost += MODULES[ct.module].price[t]; }
    }
  }
  if (portCable(a.d, a.p) || portCable(b.d, b.p)) { res.why = "Un des deux ports est déjà câblé."; return res; }
  res.cost = Math.round(ct.base + ct.perM * res.L + modCost);
  res.ok = true;
  return res;
}
function addCable(type, a, b) {
  const c = { id: 'c' + (++S.seq.c), type, a, b, len: stdLen(cableLen(a, b)), dmg: false };
  S.cables.push(c);
  touch();
  return c;
}

/* ---------- Énergie ---------- */
function plugPSU(d, i, pdu, silent) {
  const used = new Set();
  for (const x of devsIn(d.rack)) for (const p of x.psus) if (p.out && p.out.pdu === pdu) used.add(p.out.i);
  // prise la plus proche de la hauteur de l'équipement
  const ideal = Math.round((d.u - 1) / 42 * 23);
  let best = -1, bd = 99;
  for (let k = 0; k < 24; k++) if (!used.has(k) && Math.abs(k - ideal) < bd) { bd = Math.abs(k - ideal); best = k; }
  if (best < 0) return "Plus aucune prise libre sur ce PDU.";
  d.psus[i].out = { pdu, i: best };
  if (!silent) logEvent(`${nameOf(d)} : PSU${i + 1} branchée sur le PDU ${pdu} de la baie ${rackName(d.rack)}.`);
  touch();
  return null;
}
const pduLive = (r, p) => feedLive(p) && rowPowered(r) && !S.racks[r].trip[p];
function computePower() {
  const pdu = {};
  S.racks.forEach((_, i) => { pdu[i] = { A: 0, B: 0 }; });
  D.powered = {}; D.draw = {};
  for (const d of Object.values(S.devs)) {
    const c = CAT[d.type];
    if (!c.psu) { D.powered[d.id] = c.kind === 'odf'; D.draw[d.id] = 0; continue; }
    const live = d.psus.filter(p => p.ok && p.out && pduLive(d.rack, p.out.pdu));
    const on = live.length > 0 && d.on && !d.thermalOff;
    D.powered[d.id] = on;
    if (!on) { D.draw[d.id] = 0; continue; }
    const u = clampN(D.util[d.id] || 0, 0, 1);
    const w = c.w[0] + (c.w[1] - c.w[0]) * u;
    D.draw[d.id] = w;
    for (const p of live) pdu[d.rack][p.out.pdu] += w / live.length;
  }
  D.pdu = pdu;
  let again = false;
  D.ups = { A: 0, B: 0 };
  S.racks.forEach((_, i) => { D.ups.A += pdu[i].A; D.ups.B += pdu[i].B; });
  for (const p of ['A', 'B']) {
    if (feedLive(p) && D.ups[p] > S.power.ups[p].kw * 1000) {
      S.power.ups[p].trip = true; again = true;
      logEvent(`Onduleur ${p} en surcharge (${(D.ups[p] / 1000).toFixed(1)} kW pour ${S.power.ups[p].kw} kW) : il coupe sa sortie.`, 'bad');
      if (typeof raiseIncident === 'function') raiseIncident('upsover', { p });
    }
  }
  S.racks.forEach((rk, i) => {
    for (const p of ['A', 'B']) if (pduLive(i, p) && pdu[i][p] > PDU_CAP) {
      rk.trip[p] = true; again = true;
      logEvent(`Disjoncteur du PDU ${p} (baie ${rackName(i)}) déclenché : ${Math.round(pdu[i][p])} W pour ${PDU_CAP} W.`, 'bad');
      if (typeof raiseIncident === 'function') raiseIncident('breaker', { rack: i, pdu: p });
    }
  });
  if (again) computePower();
}
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Liens ---------- */
const opActive = n => n === 1 ? !S.flags.op1down : (S.room.op2 && !S.flags.op2down);
function linkEval(c) {
  const ct = CABLES[c.type];
  const ends = [c.a, c.b].map(e => { const d = dev(e.d); return { e, d, pd: portDef(d, e.p) }; });
  for (const x of ends) if (!D.powered[x.d.id]) return { up: false, why: `${nameOf(x.d)} est hors tension` };
  for (const x of ends) if (hasCfg(x.d, x.pd)) {
    const k = cfg(x.d, x.e.p);
    if (k.err) return { up: false, why: `${x.e.p} de ${nameOf(x.d)} est err-disabled (${k.err})`, err: true };
    if (!k.admin) return { up: false, why: `${x.e.p} de ${nameOf(x.d)} est en shutdown`, admin: true };
  }
  if (ct.ends === 'fiber') {
    for (const x of ends) {
      if (x.pd.op) { if (!opActive(x.pd.op)) return { up: false, why: `la fibre de l'opérateur ${x.pd.op} est éteinte` }; continue; }
      const m = x.d.mods[x.e.p];
      if (!m) return { up: false, why: `aucun module dans la cage ${x.e.p} de ${nameOf(x.d)}` };
      if (m !== ct.module) return { up: false, why: `module ${m} dans ${x.e.p} alors que la ${ct.name} demande des modules ${ct.module}` };
      if (x.d.modFail[x.e.p]) return { up: false, why: `le module de ${x.e.p} (${nameOf(x.d)}) n'émet plus de lumière`, optic: true };
    }
  }
  if (c.cut) return { up: false, why: 'câble sectionné' };
  const need = stdLen(cableLen(c.a, c.b));
  if (need > c.len) return { up: false, why: `câble trop court depuis le déplacement (${fmtLen(c.len)} posé, ${fmtLen(need)} nécessaires)` };
  const speed = Math.min(ends[0].pd.speed, ends[1].pd.speed);
  let mismatch = false;
  if (ends[0].pd.t === 'rj45') {
    const dup = ends.map(x => hasCfg(x.d, x.pd) ? cfg(x.d, x.e.p).duplex : 'auto');
    mismatch = dup[0] !== dup[1];
  }
  return { up: true, speed, mismatch, dmg: !!c.dmg };
}
function computeLinks() {
  const prev = D.link || {};
  D.link = {}; D.adj = {};
  for (const c of S.cables) {
    const r = linkEval(c);
    D.link[c.id] = r;
    const was = prev[c.id];
    if (was && was.up !== r.up) logLinkChange(c, r.up);
    if (r.up) {
      (D.adj[c.a.d] = D.adj[c.a.d] || []).push({ c, me: c.a, other: c.b });
      (D.adj[c.b.d] = D.adj[c.b.d] || []).push({ c, me: c.b, other: c.a });
    }
  }
}
function logLinkChange(c, up) {
  for (const e of [c.a, c.b]) {
    const d = dev(e.d), k = kindOf(d);
    if (k === 'switch' || k === 'router') {
      syslog(d, 3, `%LINK-3-UPDOWN: Interface ${e.p}, changed state to ${up ? 'up' : 'down'}`);
      syslog(d, 5, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${e.p}, changed state to ${up ? 'up' : 'down'}`);
    } else if (k === 'fw') syslog(d, 4, `kernel: ${e.p}: link ${up ? 'up' : 'down'}`);
    else if (k === 'server' || k === 'nas') syslog(d, up ? 6 : 3, `kernel: ${e.p}: NIC Link is ${up ? 'Up ' + speedName(portDef(d, e.p).speed) : 'Down'}`);
  }
}

/* ---------- VLAN et commutation ---------- */
function carries(e, v) {
  const d = dev(e.d), pd = portDef(d, e.p), k = kindOf(d);
  if (k === 'switch' || (k === 'fw' && pd.role === 'lan')) {
    const c = cfg(d, e.p);
    return c.mode === 'access' ? c.vlan === v : c.allowed.includes(v);
  }
  return k === 'server' || k === 'nas';
}
function portModeText(e) {
  const d = dev(e.d), c = cfg(d, e.p);
  return c.mode === 'access' ? `access VLAN ${c.vlan}` : `trunk (VLAN autorisés : ${c.allowed.join(',') || 'aucun'})`;
}
function l2Search(fromDev, portFilter, v, isGoal) {
  const prev = {}; prev[fromDev] = null;
  const queue = [fromDev], blocked = [];
  while (queue.length) {
    const cur = queue.shift();
    for (const l of D.adj[cur] || []) {
      if (cur === fromDev && portFilter && !portFilter(l.me.p)) continue;
      if (!carries(l.me, v) || !carries(l.other, v)) { blocked.push(l); continue; }
      if (isGoal(l.other)) {
        const path = [l.c.id]; let n = cur;
        while (prev[n]) { path.unshift(prev[n].c); n = prev[n].p; }
        return { ok: true, path, goal: l.other };
      }
      const od = dev(l.other.d);
      if (kindOf(od) === 'switch' && !(od.id in prev)) { prev[od.id] = { c: l.c.id, p: cur }; queue.push(od.id); }
    }
  }
  return { ok: false, blocked };
}
const gwGoal = e => { const d = dev(e.d); return kindOf(d) === 'fw' && portDef(d, e.p).role === 'lan'; };
function blockedText(l, v) {
  const side = !carries(l.me, v) ? l.me : l.other;
  return `${side.p} de ${nameOf(dev(side.d))} est en ${portModeText(side)} et bloque le VLAN ${v}`;
}

/* ---------- Disques et RAID ---------- */
function arrayInfo(d) {
  const present = d.disks.map((x, i) => x ? Object.assign({ i }, x) : null).filter(Boolean);
  const n = present.length, R = RAID[d.raid];
  if (!n) return { n: 0, usable: 0, state: 'none', valid: false, tol: 0, size: 0, failed: 0, rebuild: 0 };
  const size = Math.min(...present.map(x => DISKS[x.type].size));
  const valid = n >= R.min && (!R.even || n % 2 === 0);
  const isBad = x => x.st !== 'ok';
  const failed = present.filter(x => x.st === 'failed').length, rebuild = present.filter(x => x.st === 'rebuild').length;
  const bad = failed + rebuild;
  let state = 'ok';
  if (d.raid === '10') {
    let dead = false;
    for (let i = 0; i < n; i += 2) { const a = present[i], b = present[i + 1]; if (b && isBad(a) && isBad(b)) dead = true; }
    state = dead ? 'fail' : bad ? 'deg' : 'ok';
  } else state = bad > R.tol(n) ? 'fail' : bad ? 'deg' : 'ok';
  if (!valid) state = 'invalid';
  return { n, size, usable: valid ? R.usable(n, size) : 0, tol: valid ? R.tol(n) : 0, failed, rebuild, state, valid, mixed: new Set(present.map(x => x.type)).size > 1 };
}
function storeUsed(d) { return S.vms.filter(v => v.sto === d.id).reduce((a, v) => a + v.disk, 0) / 1000; }
function hostUsed(d) {
  const vms = S.vms.filter(v => v.host === d.id);
  return { vcpu: vms.reduce((a, v) => a + v.vcpu, 0), ram: vms.reduce((a, v) => a + v.ram, 0), n: vms.length };
}
function diskName(i) { return '/dev/sd' + String.fromCharCode(97 + i); }

/* ---------- Adresses IP ---------- */
function ipCheck(ip, v, selfId) {
  const vl = VLANS[v];
  if (!vl || !vl.net) return "Ce VLAN n'a pas de plan d'adressage.";
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip || '');
  if (!m || [1, 2, 3, 4].some(k => +m[k] > 255)) return "Format attendu : quatre nombres de 0 à 255, par exemple " + vl.net + ".20";
  if (!ip.startsWith(vl.net + '.')) return `${ip} n'est pas dans le réseau ${vl.net}.0/24 du VLAN ${v}.`;
  const h = +m[4];
  if (h === 0) return `${ip} est l'adresse du réseau.`;
  if (h === 255) return `${ip} est l'adresse de broadcast.`;
  if (h === 1 && vl.gw) return `${ip} est la passerelle (le pare-feu).`;
  if (S.vms.some(x => x.id !== selfId && x.ip === ip)) return `${ip} est déjà utilisée par une autre VM.`;
  return null;
}
function freeIp(v) {
  const vl = VLANS[v];
  for (let h = 10; h < 250; h++) { const ip = `${vl.net}.${h}`; if (!S.vms.some(x => x.ip === ip)) return ip; }
  return `${vl.net}.250`;
}

/* ---------- Règles du pare-feu ---------- */
function ruleAllows(src, dst, proto, port) {
  return S.rules.some(r => (r.src === src || r.src === 'any') && (r.dst === dst || r.dst === 'any') && (r.proto === proto || r.proto === 'any') && (r.port === port || r.port === 'any'));
}
const zoneOfVlan = v => VLANS[v] && VLANS[v].zone;

/* ---------- Internet ---------- */
function computeInternet() {
  const I = { ok: false, why: "Aucun pare-feu sous tension.", cap: 0, path: [], ops: 0 };
  for (const fw of devsOfKind('fw')) {
    if (!D.powered[fw.id]) { I.why = `${fw.host} est hors tension.`; continue; }
    const c = portCable(fw.id, 'port1');
    if (!c) { I.why = `Le port WAN (port1) de ${fw.host} n'est pas câblé.`; continue; }
    const L = D.link[c.id];
    if (!L.up) { I.why = `Lien WAN de ${fw.host} coupé : ${L.why}.`; continue; }
    const peer = dev(otherEnd(c, fw.id, 'port1').d);
    if (kindOf(peer) !== 'router') { I.why = `Le port WAN de ${fw.host} doit être relié au routeur de bordure.`; continue; }
    let cap = 0; const wan = [];
    for (const p of CAT[peer.type].ports.filter(x => x.role === 'wan')) {
      const wc = portCable(peer.id, p.id);
      if (!wc || !D.link[wc.id].up) continue;
      const o = dev(otherEnd(wc, peer.id, p.id).d);
      if (kindOf(o) !== 'odf') continue;
      cap += D.link[wc.id].speed; wan.push(wc.id);
    }
    if (!cap) {
      const wc = portCable(peer.id, 'Te0/0/0');
      I.why = wc ? `Aucun lien opérateur actif sur ${peer.host} : ${D.link[wc.id].why || 'lien coupé'}.` : `${peer.host} n'est relié à aucun opérateur.`;
      continue;
    }
    Object.assign(I, { ok: true, why: '', cap: Math.min(cap, L.speed), path: [c.id, ...wan], ops: wan.length, fw: fw.id, rtr: peer.id });
    break;
  }
  D.inet = I;
}

/* ---------- Charge et trafic ---------- */
function loadAt(t) {
  const h = (t / 60) % 24;
  const day = h >= 7 && h <= 23 ? Math.sin(Math.PI * (h - 7) / 16) : 0;
  return 0.3 + 0.7 * Math.max(0, day);
}
function vmBw(vm) {
  const s = SVC[vm.svc];
  const def = contractDef(vm.k);
  const n = Math.max(1, S.vms.filter(x => x.k === vm.k && x.svc === vm.svc).length);
  const extra = vm.svc === 'sftp' ? 1 : (def && def.final ? 3 : 1);
  return s.bw * extra * loadAt(S.t) * (vm.svc === 'web' && n > 1 ? 1.5 : 1);
}

/* ---------- Statut des VM ---------- */
function vmEval(vm) {
  const R = [], s = SVC[vm.svc], host = dev(vm.host);
  const add = (lvl, sev, msg) => R.push({ lvl, sev, msg });
  let path = [];
  if (!host) { add(1, 'down', "L'hôte de la VM a été retiré."); return { st: 'down', R, path }; }
  if (!D.powered[host.id]) add(1, 'down', `${host.host} est hors tension : vérifie ses alimentations (PSU → PDU).`);
  if (vm.st === 'stopped') add(7, 'down', `La VM ${vm.name} est arrêtée.`);
  if (vm.st === 'lost') add(1, 'down', `Les données de ${vm.name} ont disparu avec la grappe RAID : restaure la sauvegarde ou réinstalle.`);
  if (vm.st === 'encrypted') add(7, 'down', `Les fichiers de ${vm.name} sont chiffrés par un rançongiciel.`);
  if (vm.st === 'crashed') add(7, 'down', `Le service ${s.unit} de ${vm.name} est tombé (${vm.crash || 'erreur'}). Redémarre la VM.`);
  if (vm.st === 'restoring') add(7, 'down', `Restauration de ${vm.name} en cours.`);
  // stockage
  const sto = dev(vm.sto);
  if (!sto) add(1, 'down', "Le stockage de la VM a disparu.");
  else {
    const A = arrayInfo(sto);
    if (A.state === 'fail') add(1, 'down', `La grappe ${RAID[sto.raid].name} de ${sto.host} est hors service.`);
    else if (A.state === 'deg') add(1, 'info', `La grappe ${RAID[sto.raid].name} de ${sto.host} est dégradée : le service tourne, mais il n'y a plus aucune marge en cas de nouvelle panne.`);
    if (sto.id !== host.id) {
      if (!D.powered[sto.id]) add(1, 'down', `La baie de stockage ${sto.host} est hors tension.`);
      else {
        const r = l2Search(host.id, p => portDef(host, p).role !== 'bmc', 30, e => e.d === sto.id);
        if (!r.ok) add(2, 'down', `${host.host} n'atteint pas ${sto.host} dans le VLAN 30 (stockage) : ${r.blocked[0] ? blockedText(r.blocked[0], 30) : "aucun chemin câblé"}.`);
      }
    }
  }
  // réseau
  const v = vm.vlan, data = (D.adj[host.id] || []).filter(l => portDef(host, l.me.p).role !== 'bmc');
  if (D.powered[host.id]) {
    if (!data.length) {
      const cabled = CAT[host.type].ports.filter(p => p.role !== 'bmc').map(p => portCable(host.id, p.id)).filter(Boolean);
      if (cabled.length) add(1, 'down', `Les liens de ${host.host} sont coupés : ${D.link[cabled[0].id].why}.`);
      else add(1, 'down', `Aucune carte réseau de données de ${host.host} n'est câblée (eno1, eno2, ens1f0, ens1f1).`);
    } else if (vm.isolated) add(2, 'down', `${vm.name} est isolée du réseau (carte virtuelle déconnectée).`);
    else if (VLANS[v].gw) {
      const r = l2Search(host.id, p => portDef(host, p).role !== 'bmc', v, gwGoal);
      if (!r.ok) {
        const first = data.filter(l => !carries(l.other, v));
        if (first.length === data.length) add(2, 'down', `${first[0].other.p} de ${nameOf(dev(first[0].other.d))} est en ${portModeText(first[0].other)} : la VM attend le VLAN ${v} (${VLANS[v].name}).`);
        else add(3, 'down', `La passerelle ${VLANS[v].gw} est injoignable dans le VLAN ${v} : ${r.blocked[0] ? blockedText(r.blocked[0], v) : "aucun chemin jusqu'au pare-feu"}.`);
      } else path = r.path;
    }
    const ipErr = ipCheck(vm.ip, v, vm.id);
    if (ipErr) add(3, 'down', `Adresse IP invalide : ${ipErr}`);
    if (S.flags.ipdup && S.flags.ipdup.ip === vm.ip) add(3, 'deg', `Conflit d'adresse IP : une autre machine répond aussi sur ${vm.ip}.`);
  }
  // flux
  const def = contractDef(vm.k), zone = zoneOfVlan(v);
  if (def) {
    for (const f of def.flows) {
      const mine = (f[1] === zone && s.ports.some(p => p[0] === f[2] && p[1] === f[3])) || (f[0] === zone && (vm.svc === 'mon' || vm.svc === 'bak'));
      if (!mine) continue;
      if (!ruleAllows(f[0], f[1], f[2], f[3])) add(4, 'down', `Aucune règle n'autorise ${f[0]} → ${f[1]} ${f[2].toUpperCase()} ${f[3]} sur le pare-feu.`);
    }
  }
  if (s.pub && !D.inet.ok) add(1, 'down', `Pas d'accès Internet : ${D.inet.why}`);
  // application
  if (s.cert && vm.st === 'running' && vm.cert < S.t) add(7, 'down', `Le certificat TLS de ${vm.name} a expiré : les navigateurs refusent la connexion.`);
  if (vm.fill >= 1) add(7, 'down', `Le disque de ${vm.name} est plein (100 %) : le service ne peut plus écrire.`);
  else if (vm.fill > 0.9) add(7, 'deg', `Le disque de ${vm.name} est plein à ${Math.round(vm.fill * 100)} %.`);
  if (D.cpu[host.id] > 1) add(7, 'deg', `Le processeur de ${host.host} est saturé (${Math.round(D.cpu[host.id] * 100)} %).`);
  if (host.throttle) add(1, 'deg', `${host.host} réduit sa fréquence : température d'entrée trop haute.`);
  const st = R.some(r => r.sev === 'down') ? 'down' : R.some(r => r.sev === 'deg') ? 'deg' : 'ok';
  return { st, R, path };
}
function computeVMs() {
  D.vm = {}; D.cpu = {};
  for (const d of devsOfKind('server')) {
    const vms = S.vms.filter(v => v.host === d.id && v.st === 'running');
    const use = vms.reduce((a, v) => a + v.vcpu * (0.15 + 0.7 * loadAt(S.t)) * (v.svc === 'sftp' ? 1.2 : 1), 0);
    D.cpu[d.id] = use / (CAT[d.type].cores * (d.throttle ? 0.7 : 1));
  }
  for (const vm of S.vms) D.vm[vm.id] = vmEval(vm);
}
function computeTraffic() {
  D.cUse = {}; let inet = 0, fwUse = 0;
  const pubVMs = [];
  for (const vm of S.vms) {
    const r = D.vm[vm.id]; if (r.st === 'down') continue;
    const bw = vmBw(vm);
    for (const id of r.path) D.cUse[id] = (D.cUse[id] || 0) + bw;
    fwUse += bw;
    if (SVC[vm.svc].pub) { inet += bw; pubVMs.push(vm); }
  }
  const atk = S.flags.ddos ? S.flags.ddos.mbps : 0;
  const atkLink = S.flags.ddos && !S.fwopt.scrub ? atk : 0;
  inet += atkLink;
  for (const id of D.inet.path || []) D.cUse[id] = (D.cUse[id] || 0) + inet;
  const fwLoad = fwUse + (S.flags.ddos && S.flags.ddos.kind === 'syn' && !S.fwopt.syn ? 9000 : 0);
  D.fwUse = fwLoad; D.inetUse = inet;
  // saturations
  const sat = {};
  for (const c of S.cables) { const L = D.link[c.id]; if (L.up && (D.cUse[c.id] || 0) > L.speed) sat[c.id] = true; }
  for (const vm of S.vms) {
    const r = D.vm[vm.id]; if (r.st === 'down') continue;
    const add = (lvl, msg) => { r.R.push({ lvl, sev: 'deg', msg }); if (r.st === 'ok') r.st = 'deg'; };
    for (const id of r.path) {
      const c = S.cables.find(x => x.id === id), L = D.link[id];
      if (sat[id]) add(1, `Le lien ${c.a.p} ↔ ${c.b.p} est saturé (${speedName(Math.round(D.cUse[id]))} pour ${speedName(L.speed)}).`);
      if (L.dmg) add(1, `Erreurs CRC sur le lien ${c.a.p} ↔ ${c.b.p} : des trames arrivent abîmées.`);
      if (L.mismatch) add(1, `Duplex incohérent sur le lien ${c.a.p} ↔ ${c.b.p} : collisions tardives.`);
    }
    if (SVC[vm.svc].pub && D.inet.ok && inet > D.inet.cap) add(1, `Le lien Internet est saturé (${speedName(Math.round(inet))} pour ${speedName(D.inet.cap)}).`);
    if (fwLoad > CAT.fw.tput) add(4, `Le pare-feu est débordé : sa table de sessions est pleine.`);
    if (S.flags.stp && S.flags.stp.sw && r.path.some(id => { const c = S.cables.find(x => x.id === id); return c.a.d === S.flags.stp.sw || c.b.d === S.flags.stp.sw; })) add(2, `Le Spanning Tree de ${nameOf(dev(S.flags.stp.sw))} recalcule sans arrêt : un équipement inconnu envoie des BPDU.`);
  }
  // charge des équipements
  D.util = {};
  for (const d of Object.values(S.devs)) {
    const k = kindOf(d);
    if (k === 'server') D.util[d.id] = clampN(D.cpu[d.id] || 0, 0, 1);
    else if (k === 'fw') D.util[d.id] = clampN(fwLoad / CAT.fw.tput, 0, 1);
    else if (k === 'router') D.util[d.id] = D.inet.cap ? clampN(inet / D.inet.cap, 0, 1) : 0;
    else if (k === 'switch' || k === 'nas') {
      let m = 0;
      for (const l of D.adj[d.id] || []) m = Math.max(m, (D.cUse[l.c.id] || 0) / D.link[l.c.id].speed);
      D.util[d.id] = clampN(m + (k === 'nas' ? 0.3 : 0), 0, 1);
    }
  }
}

/* ---------- Contrats ---------- */
function contractEval(cs) {
  const def = contractDef(cs.id), R = [];
  const add = (sev, msg) => R.push({ sev, msg });
  const vms = S.vms.filter(v => v.k === cs.id);
  for (const req of def.svcs) {
    const list = vms.filter(v => v.svc === req.s);
    if (list.length < req.n) add('todo', `Déployer ${req.n - list.length} VM « ${SVC[req.s].name} » dans le VLAN ${SVC[req.s].zone} (${VLANS[SVC[req.s].zone].name}).`);
    for (const v of list) {
      if (v.vlan !== SVC[req.s].zone) add('down', `${v.name} est dans le VLAN ${v.vlan} : ce service doit être dans le VLAN ${SVC[req.s].zone} (${VLANS[SVC[req.s].zone].name}).`);
      const sto = dev(v.sto);
      if (req.raid && sto) {
        if (req.raid === 10 && sto.raid !== '10') add('down', `${v.name} doit être sur une grappe RAID 10 (actuellement ${RAID[sto.raid].name} sur ${sto.host}).`);
        if (req.raid === 1 && (sto.raid === 'none' || sto.raid === '0')) add('down', `${v.name} demande un RAID avec tolérance de panne (actuellement ${RAID[sto.raid].name}).`);
      }
      if (SVC[req.s].nas && sto && kindOf(sto) !== 'nas') add('down', `${v.name} doit écrire ses sauvegardes sur une baie de stockage, pas sur le serveur qu'elle protège.`);
    }
    if (req.anti && list.length > 1 && new Set(list.map(v => v.host)).size < list.length) add('down', `Les VM « ${SVC[req.s].name} » doivent être sur des hôtes différents (anti-affinité) : une seule panne couperait tout.`);
    if (req.antiRack && list.length > 1 && new Set(list.map(v => dev(v.host) ? dev(v.host).rack : -1)).size < list.length) add('down', `Les VM « ${SVC[req.s].name} » doivent être dans des baies différentes : une panne d'alimentation ou de switch d'une baie ne doit pas tout couper.`);
  }
  for (const v of vms) for (const r of D.vm[v.id].R) add(r.sev, `${v.name} · couche ${r.lvl} : ${r.msg}`);
  for (const [a, b] of def.deps || []) {
    const aOk = vms.filter(v => v.svc === a && D.vm[v.id].st !== 'down').length;
    const bOk = vms.filter(v => v.svc === b && D.vm[v.id].st !== 'down').length;
    if (aOk && !bOk && vms.some(v => v.svc === b)) add('down', `${SVC[a].name} ne joint plus ${SVC[b].name} : le service est inutilisable.`);
  }
  if (def.needOp2 && !(S.room.op2 && D.inet.ops >= 2)) add('down', "Le SLA exige deux liens opérateurs actifs sur le routeur (achète le second opérateur et câble OP2).");
  if (def.needGen && !S.power.gen) add('down', "Le SLA exige un groupe électrogène : sans lui, une coupure EDF plus longue que les batteries arrête la salle.");
  const st = R.some(r => r.sev === 'down' || r.sev === 'todo') ? 'down' : R.some(r => r.sev === 'deg') ? 'deg' : 'ok';
  return { st, R };
}
function computeContracts() {
  D.ct = {};
  for (const cs of S.contracts) {
    if (cs.state === 'offer') continue;
    const r = contractEval(cs);
    D.ct[cs.id] = r;
    if (cs.state === 'setup' && r.st === 'ok' && !cs.readyLog) { cs.readyLog = true; logEvent(`Contrat « ${contractDef(cs.id).client} » prêt : lance la recette pour le mettre en service.`, 'good'); }
  }
  const mon = S.contracts.find(c => c.id === 'c4' && c.state === 'active');
  const monVm = S.vms.find(v => v.svc === 'mon');
  D.monitoring = !!(mon && monVm && D.vm[monVm.id] && D.vm[monVm.id].st !== 'down');
  const bak = S.vms.find(v => v.svc === 'bak');
  D.backup = !!(bak && S.contracts.some(c => c.id === 'c6' && c.state === 'active') && D.vm[bak.id] && D.vm[bak.id].st !== 'down');
}
function activateContract(cs) {
  const def = contractDef(cs.id);
  cs.state = 'active'; cs.since = S.t; cs.up = 0; cs.tot = 0;
  S.money += def.bonus; S.xp += 40; S.done++;
  def.unlock.forEach(u => { if (!S.unlocked.includes(u)) S.unlocked.push(u); });
  logEvent(`Contrat « ${def.client} » en service : prime de ${money(def.bonus)}.`, 'good');
  if (typeof onContractActive === 'function') onContractActive(cs, def);
  const idx = CONTRACTS.findIndex(c => c.id === cs.id);
  const nextId = idx >= 0 ? (CONTRACTS[idx + 1] ? CONTRACTS[idx + 1].id : 'c' + (CONTRACTS.length + 1)) : 'c' + (+cs.id.slice(1) + 1);
  if (!S.contracts.some(c => c.id === nextId)) S.contracts.push({ id: nextId, state: 'offer' });
}

/* ---------- Température ---------- */
function roomCooling() {
  const crac = S.cool.cracs.filter(c => c.ok).length * CRAC_KW;
  const inrow = (feedLive('A') || feedLive('B')) ? S.racks.filter(r => r.kind === 'inrow' && rowPowered(S.racks.indexOf(r))).length * INROW_KW : 0;
  return { crac, inrow, total: crac + inrow };
}
function rackLocalCooling(i) {
  const rk = S.racks[i];
  if (rk.row === 'MMR') return 4;
  const contained = !!S.cool.contain[coldAisleOf(rk.row)];
  const near = S.racks.some(x => x.kind === 'inrow' && x.row === rk.row && Math.abs(x.pos - rk.pos) <= 2);
  return 4 + (contained ? 2 : 0) + (near ? 6 : 0);
}
function computeTemps() {
  D.temp = {}; D.rackW = {};
  const itW = Object.values(D.draw).reduce((a, b) => a + b, 0);
  const cap = roomCooling().total;
  const load = itW / 1000 / Math.max(cap, 2); // 2 kW : ce que les murs dissipent sans climatisation
  D.coolLoad = load; D.coolCap = cap;
  S.racks.forEach((rk, i) => {
    if (rk.kind === 'inrow') return;
    const list = devsIn(i);
    const W = list.reduce((a, d) => a + (D.draw[d.id] || 0), 0);
    const m = slotMap(i);
    let open = 0;
    for (let u = 1; u <= RACK_U; u++) if (!m[u]) open++;
    const contained = rk.row !== 'MMR' && !!S.cool.contain[coldAisleOf(rk.row)];
    const base = 20 + Math.max(0, load - 0.75) * 32;
    const dens = Math.max(0, W / 1000 - rackLocalCooling(i)) * 2.2;
    const recirc = list.some(d => CAT[d.type].psu && kindOf(d) !== 'rogue') ? Math.min(5, open * 0.12) * (contained ? 0.4 : 1) : 0;
    const t = Math.min(60, base + dens + recirc);
    D.temp[i] = t; D.rackW[i] = W;
    for (const d of list) {
      if (!CAT[d.type].psu) continue;
      if (t > 36 && !d.thermalOff) { d.thermalOff = true; logEvent(`${nameOf(d)} s'arrête pour se protéger : ${t.toFixed(1)} °C en entrée.`, 'bad'); syslog(d, 1, `%ENV-1-SHUTDOWN: Temperature critical (${t.toFixed(1)} C), shutting down`); }
      else if (d.thermalOff && t < 30) { d.thermalOff = false; logEvent(`${nameOf(d)} redémarre : la température est revenue à ${t.toFixed(1)} °C.`); }
      d.throttle = kindOf(d) === 'server' && t > 30;
    }
  });
  const it = itW / 1000;
  const nCont = Object.values(S.cool.contain).filter(Boolean).length;
  const coolF = Math.max(0.22, 0.45 - nCont * 0.05 - (S.racks.some(r => r.kind === 'inrow') ? 0.06 : 0));
  D.itKW = it; D.pue = it > 0 ? (it + it * coolF + it * 0.06 + 0.15) / it : 0;
}

/* ---------- Dérivation complète ---------- */
function derive() {
  D.dirty = false;
  computePower();
  computeLinks();
  computeInternet();
  computeVMs();
  computeTraffic();
  computeContracts();
  computeTemps();
}

/* ---------- Pas de temps (1 minute de jeu) ---------- */
function simStep(dt) {
  S.t += dt;
  // secours électrique : batteries des onduleurs, puis groupe électrogène
  const P = S.power;
  if (!P.edf) {
    if (P.gen && !P.genRun) { P.genT += dt; if (P.genT >= 1) { P.genRun = true; logEvent('Groupe électrogène démarré : il reprend la salle.', 'good'); touch(); } }
    if (!P.genRun) {
      const before = P.batt; P.batt = Math.max(0, P.batt - dt);
      if (before > 0 && P.batt === 0) { logEvent('Batteries des onduleurs vides : la salle s’éteint.', 'bad'); touch(); }
    }
  } else {
    if (P.genRun) { P.genRun = false; logEvent('Retour du secteur : le groupe électrogène s’arrête.', 'info'); touch(); }
    P.genT = 0; P.batt = Math.min(P.battMax, P.batt + dt * 0.25);
  }
  // reconstruction RAID
  for (const d of Object.values(S.devs)) for (const x of d.disks || []) {
    if (x && x.st === 'rebuild' && D.powered[d.id]) {
      x.rb += dt / (DISKS[x.type].size * 20);
      if (x.rb >= 1) { x.st = 'ok'; x.rb = 0; logEvent(`${d.host} : reconstruction RAID terminée.`, 'good'); syslog(d, 6, `md/raid: md0: recovery done.`); touch(); }
    }
  }
  // grappes détruites → VM perdues
  for (const d of Object.values(S.devs)) {
    if (!d.disks || !d.disks.length) continue;
    const A = arrayInfo(d);
    if (A.state === 'fail' && !d.lost) {
      d.lost = true;
      S.vms.filter(v => v.sto === d.id && v.st !== 'lost').forEach(v => { v.st = 'lost'; });
      logEvent(`${d.host} : la grappe ${RAID[d.raid].name} est détruite, les données sont perdues.`, 'bad');
      syslog(d, 2, `md/raid: md0: Disk failure, array is FAILED. Cannot continue operation.`);
    }
    if (A.state !== 'fail') d.lost = false;
  }
  // VM : fuites mémoire, remplissage, restaurations
  for (const v of S.vms) {
    if (v.st === 'running' && v.leak) { v.leak += dt / 40; if (v.leak > 1) { v.st = 'crashed'; v.crash = 'Out of memory: Killed process'; v.leak = 0; logEvent(`${v.name} : le noyau a tué le service (mémoire épuisée).`, 'bad'); touch(); } }
    if (v.st === 'running' && v.filling) v.fill = Math.min(1, v.fill + dt / 70);
    if (v.st === 'restoring') { v.rs -= dt; if (v.rs <= 0) { v.st = 'running'; v.encrypted = false; logEvent(`${v.name} restaurée depuis la sauvegarde.`, 'good'); touch(); } }
    if (v.acme && SVC[v.svc].cert && v.cert - S.t < 1440) v.cert = S.t + 3 * 1440;
  }
  // minuteries
  for (const [k, until] of Object.entries(S.timers)) if (S.t >= until) { delete S.timers[k]; if (typeof onTimer === 'function') onTimer(k); touch(); }
  // sauvegardes nocturnes
  const h = Math.floor(S.t % 1440);
  if (D.backup && (h === 120 || !S.flags.firstBak)) {
    S.flags.firstBak = true;
    for (const v of S.vms) if (v.svc !== 'bak' && D.vm[v.id] && D.vm[v.id].st !== 'down' && !v.encrypted) v.lastBak = S.t;
    logEvent('Sauvegarde : travail nocturne terminé (incrémentale).', 'info');
  }
  derive();
  // argent
  let rev = 0;
  for (const cs of S.contracts) {
    if (cs.state !== 'active') continue;
    const def = contractDef(cs.id), r = D.ct[cs.id];
    cs.tot = (cs.tot || 0) + dt;
    if (r.st === 'ok') { cs.up = (cs.up || 0) + dt; rev += def.rev; }
    else if (r.st === 'deg') { cs.up = (cs.up || 0) + dt * 0.5; rev += def.rev * 0.5; }
  }
  // Pas de factures ni de pénalités : seuls les contrats en service rapportent.
  D.rate = rev; D.cost = 0;
  S.money += rev * dt / 60;
  if (typeof incidentTick === 'function') incidentTick(dt);
}
