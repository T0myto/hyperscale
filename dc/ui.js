'use strict';
/* =========================================================
   Hyperscale — interface : panneaux, modales, console, boucle
   ========================================================= */
const $ = s => document.querySelector(s);
const svg = $('#rackview');
UI.tab = 'contracts';
UI.openTicket = null;
UI.lastCli = {};
UI.ruleDraft = { src: 'Internet', dst: 'DMZ', proto: 'tcp', port: '443' };
let LIVE = {};
let liveSeq = 0, LIVEP = 's';
const live = fn => { const k = LIVEP + '_' + (++liveSeq); LIVE[k] = fn; return `<span data-live="${k}">${fn()}</span>`; };
const clearLive = p => { for (const k in LIVE) if (k.startsWith(p + '_')) delete LIVE[k]; };

/* ---------- Utilitaires ---------- */
function toast(msg, kind, onClick) {
  const el = document.createElement(onClick ? 'button' : 'div');
  el.className = 'toast ' + (kind || '');
  el.textContent = msg;
  if (onClick) el.addEventListener('click', () => { onClick(); el.remove(); });
  const box = $('#toasts'); box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.remove(), onClick ? 7000 : 4200);
}
function act(fn) {
  const r = fn();
  if (typeof r === 'string') toast(r, 'bad');
  derive(); renderAll();
  return r;
}
const pill = (st, txt) => `<span class="pill ${st}">${esc(txt)}</span>`;
const stDot = st => `<i class="dot ${st}"></i>`;
const rankOf = xp => { let r = RANKS[0][1]; for (const [n, name] of RANKS) if (xp >= n) r = name; return r; };
const nextRank = xp => RANKS.find(([n]) => n > xp);
function selDev() { return UI.sel && UI.sel.d ? dev(UI.sel.d) : null; }

/* ---------- Barre du haut ---------- */
function renderTop() {
  const c = clock(S.t);
  $('#clk').textContent = `Jour ${c.day} · ${c.hh}:${c.mm}`;
  $('#money').textContent = money(S.money);
  $('#money').classList.toggle('neg', S.money < 0);
  $('#rate').textContent = `+${Math.round(D.rate).toLocaleString('fr-FR')} €/h`;
  $('#rate').title = 'Revenus des contrats en service. Aucune facture ni pénalité : seuls tes achats coûtent de l’argent.';
  $('#it').textContent = `${(D.itKW || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kW`;
  $('#pue').textContent = D.pue ? D.pue.toFixed(2).replace('.', ',') : '–';
  const tmax = Math.max(...S.racks.map((_, i) => D.temp[i] || 20));
  $('#tmax').textContent = tmax.toFixed(1).replace('.', ',') + ' °C';
  $('#tmax').className = 'val ' + (tmax > 32 ? 'bad' : tmax > 27 ? 'warn' : '');
  $('#rank').textContent = rankOf(S.xp);
  const nr = nextRank(S.xp);
  $('#xp').textContent = nr ? `${S.xp} / ${nr[0]} XP` : `${S.xp} XP`;
  const open = S.tickets.filter(t => t.det && !t.closed).length;
  const b = $('#tabTickets .badge'); b.textContent = open; b.hidden = !open;
  document.querySelectorAll('[data-speed]').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.speed === S.speed)));
  const inRack = UI.mode === 'rack';
  $('#vbRoom').hidden = inRack; $('#vbRack').hidden = !inRack;
  document.querySelectorAll('[data-layer]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.layer === UI.layer)));
  $('#faceFront').setAttribute('aria-pressed', String(UI.face === 'front'));
  $('#faceRear').setAttribute('aria-pressed', String(UI.face === 'rear'));
  if (inRack) {
    $('#rName').textContent = S.racks[UI.rack].row === 'MMR' ? 'MMR' : rackName(UI.rack);
    const nb = rackNeighbors(UI.rack);
    $('#rPrev').disabled = nb.prev < 0; $('#rNext').disabled = nb.next < 0;
    $('#rPrev').title = nb.prev >= 0 ? 'Baie ' + rackName(nb.prev) : ''; $('#rNext').title = nb.next >= 0 ? 'Baie ' + rackName(nb.next) : '';
  }
  let hint = '';
  if (UI.place) hint = `Choisis un emplacement libre (en vert) pour : ${CAT[UI.place.type].name}${UI.place.move ? ' (déplacement)' : UI.place.left > 1 ? ` · encore ${UI.place.left} à placer` : ''} · Échap pour arrêter`;
  else if (UI.from) hint = `Câblage depuis ${nameOf(dev(UI.from.d))} ${UI.from.p} (baie ${rackName(dev(UI.from.d).rack)}) : clique un second port libre du même type, dans cette baie ou dans une autre · Échap pour annuler`;
  else if (!inRack) hint = "Salle vue de dessus : flèches ou ZQSD pour marcher, clic sur le sol pour y aller, clic sur une baie pour l'ouvrir. Clique un emplacement libre pour installer une baie.";
  else hint = UI.face === 'rear' ? "Face arrière (allée chaude) : ports, alimentations et PDU. Clique un port libre pour tirer un câble, double-clique un équipement pour sa fenêtre de configuration. Échap : retour à la salle." : "Face avant (allée froide) : disques, voyants et unités vides. Double-clique un équipement pour sa fenêtre de configuration. Ports en face arrière (touche F).";
  $('#hint').textContent = hint;
  $('#hint').classList.toggle('active', !!(UI.place || UI.from));
}

/* ---------- Panneau latéral ---------- */
function renderSide() {
  const ae = document.activeElement;
  if (ae && $('#sidebody').contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA')) return;
  clearLive('s'); LIVEP = 's';
  document.querySelectorAll('#tabs [role=tab]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === UI.tab)));
  const body = $('#sidebody');
  const scroll = body.scrollTop;
  body.innerHTML = ({ contracts: sideContracts, equip: sideEquip, tickets: sideTickets, network: sideNetwork, room: sideRoom })[UI.tab]();
  body.scrollTop = scroll;
}
function updateLive() { document.querySelectorAll('[data-live]').forEach(el => { const f = LIVE[el.dataset.live]; if (f) { const v = f(); if (el.innerHTML !== v) el.innerHTML = v; } }); }

/* ----- Contrats ----- */
function tutoSteps() {
  const racks = S.racks.map((k, i) => i).filter(i => S.racks[i].kind === 'rack');
  const r0 = racks[0];
  const fw = devsOfKind('fw')[0], rtr = devsOfKind('router')[0], sws = devsOfKind('switch'), srvs = devsOfKind('server');
  const fwC = fw && portCable(fw.id, 'port2');
  const fwSw = fwC && kindOf(dev(otherEnd(fwC, fw.id, 'port2').d)) === 'switch' ? otherEnd(fwC, fw.id, 'port2') : null;
  const opLink = rtr && CAT.router.ports.some(p => p.role === 'wan' && (c => c && kindOf(dev(otherEnd(c, rtr.id, p.id).d)) === 'odf')(portCable(rtr.id, p.id)));
  const wanLink = fw && (c => c && kindOf(dev(otherEnd(c, fw.id, 'port1').d)) === 'router')(portCable(fw.id, 'port1'));
  const srvLink = [];
  for (const s of srvs) for (const p of CAT[s.type].ports) if (p.role !== 'bmc') { const c = portCable(s.id, p.id); if (c) { const o = otherEnd(c, s.id, p.id); if (kindOf(dev(o.d)) === 'switch') srvLink.push(o); } }
  const all = [rtr, fw, ...sws, ...srvs].filter(Boolean);
  const powered = all.length >= 4 && all.every(d => d.psus.every(p => p.out) && (d.psus.length < 2 || d.psus[0].out.pdu !== d.psus[1].out.pdu));
  const vm = S.vms.find(v => v.k === 'c1');
  const cs = S.contracts.find(c => c.id === 'c1');
  const openR0 = () => { if (r0 !== undefined) openRack(r0); };
  const goPort = (d, p) => { if (!d) return openR0(); openRack(dev(d).rack); UI.face = 'rear'; select({ t: 'port', d, p }); };
  return [
    { t: 'Dans la salle, clique un emplacement libre de la rangée A et installe une baie 42U', ok: racks.length > 0, go: () => { backToRoom(); UI.tab = 'equip'; select({ t: 'slot', row: 'A', pos: 1 }); } },
    { t: 'Ouvre la baie et installe un routeur de bordure, un pare-feu, un switch d’accès et un serveur 1U (Catalogue)', ok: !!(rtr && fw && sws.length && srvs.length), go: () => { openR0(); openShop(!rtr ? 'router' : !fw ? 'fw' : !sws.length ? 'sw24' : 'srv1'); } },
    { t: 'Face arrière : branche chaque alimentation, PSU1 sur le PDU A et PSU2 sur le PDU B', ok: powered, go: () => { const d = all.find(x => x.psus.some(p => !p.out)) || all[0]; if (d) { openRack(d.rack); UI.face = 'rear'; select({ t: 'dev', d: d.id }); } else openR0(); } },
    { t: 'Relie le routeur (Te0/0/0) à l’ODF de la salle MMR (OP1) : fibre monomode OS2 et modules LR', ok: !!opLink, go: () => goPort(rtr && rtr.id, 'Te0/0/0') },
    { t: 'Relie le routeur (Te0/1/0) au port WAN du pare-feu (port1) avec un DAC', ok: !!wanLink, go: () => goPort(rtr && rtr.id, 'Te0/1/0') },
    { t: 'Relie le pare-feu (port2) au switch (Te1/1/1) avec un DAC, puis passe les deux bouts en trunk avec le VLAN 10 autorisé', ok: !!(fwSw && cfg(dev(fwSw.d), fwSw.p).mode === 'trunk' && carries(fwSw, 10) && carries({ d: fw.id, p: 'port2' }, 10)), go: () => fwSw && !carries(fwSw, 10) ? goPort(fwSw.d, fwSw.p) : goPort(fw && fw.id, 'port2') },
    { t: 'Câble le serveur (eno1) à un port Gi du switch en Cat 6, et passe ce port en access VLAN 10', ok: srvLink.some(o => carries(o, 10)), go: () => srvLink[0] ? goPort(srvLink[0].d, srvLink[0].p) : goPort(srvs[0] && srvs[0].id, 'eno1') },
    { t: 'Déploie la VM « Site web HTTPS » dans le VLAN 10', ok: !!vm, go: () => openDeploy('c1', 'web') },
    { t: 'Autorise Internet → DMZ TCP 443 sur le pare-feu', ok: ruleAllows('Internet', 'DMZ', 'tcp', 443), go: () => { UI.ruleDraft = { src: 'Internet', dst: 'DMZ', proto: 'tcp', port: '443' }; UI.tab = 'network'; renderAll(); } },
    { t: 'Teste tout : lance la recette du contrat', ok: !!(cs && cs.state === 'active'), go: () => { if (cs) openRecette(cs); } },
  ];
}
function contractCard(cs) {
  const def = contractDef(cs.id), r = D.ct[cs.id];
  const st = cs.state === 'offer' ? ['offer', 'Offre'] : cs.state === 'setup' ? (r && r.st === 'ok' ? ['ok', 'Prêt pour la recette'] : ['todo', 'À construire']) : r && r.st === 'ok' ? ['ok', 'En service'] : r && r.st === 'deg' ? ['warn', 'Dégradé'] : ['bad', 'En panne'];
  let s = `<article class="card ccard ${def.internal ? 'internal' : ''}"><header><div><div class="eyebrow">${def.internal ? 'Projet interne' : 'Client'}</div><h3>${esc(def.client)}</h3></div>${pill(st[0], st[1])}</header>`;
  s += `<p class="muted">${esc(def.what)}</p>`;
  s += `<div class="kv"><span>Revenu</span><b>${def.rev ? money(def.rev) + ' / h' : '—'}</b><span>Prime de mise en service</span><b>${money(def.bonus)}</b>`;
  if (cs.state === 'active') s += `<span>Disponibilité (SLA)</span><b>${live(() => cs.tot ? (cs.up / cs.tot * 100).toFixed(2).replace('.', ',') + ' %' : '—')}</b>`;
  s += `</div>`;
  if (def.unlock.length) s += `<p class="unl">Débloque : ${def.unlock.map(u => esc(unlockName(u))).join(', ')}</p>`;
  if (cs.state === 'offer') return s + `<button class="btn primary" data-act="accept" data-id="${cs.id}">Signer le contrat</button></article>`;
  // services
  s += `<h4>Services demandés</h4><ul class="svcl">`;
  for (const req of def.svcs) {
    const list = S.vms.filter(v => v.k === cs.id && v.svc === req.s);
    s += `<li><div class="row"><b>${esc(SVC[req.s].name)}</b> <span class="muted">× ${req.n} · ${SVC[req.s].soft} · VLAN ${SVC[req.s].zone}${req.raid ? ' · RAID ' + (req.raid === 10 ? '10' : 'tolérant') : ''}${req.anti ? ' · hôtes différents' : ''}</span></div>`;
    for (const v of list) s += `<button class="vmrow" data-act="selvm" data-id="${v.id}">${stDot(D.vm[v.id] ? D.vm[v.id].st : 'down')} ${esc(v.name)} <span class="muted">${esc(dev(v.host) ? dev(v.host).host : '?')} · ${v.ip}</span></button>`;
    if (list.length < req.n) s += `<button class="btn small" data-act="deploy" data-id="${cs.id}" data-svc="${req.s}">Déployer ${req.n - list.length > 1 ? (req.n - list.length) + ' VM' : 'la VM'}</button>`;
    s += `</li>`;
  }
  s += `</ul><h4>Flux à autoriser</h4><ul class="flows">`;
  for (const f of def.flows) {
    const ok = ruleAllows(f[0], f[1], f[2], f[3]);
    s += `<li>${stDot(ok ? 'ok' : 'down')} ${f[0]} → ${f[1]} ${f[2].toUpperCase()} ${f[3]} ${ok ? '' : `<button class="link" data-act="prefill" data-f="${esc(JSON.stringify(f))}">Préremplir</button>`}</li>`;
  }
  s += `</ul>`;
  if (cs.state === 'setup') s += `<button class="btn ${r && r.st === 'ok' ? 'primary' : ''}" data-act="recette" data-id="${cs.id}">${r && r.st === 'ok' ? 'Lancer la recette et livrer' : 'Lancer la recette (tests)'}</button>`;
  if (def.tuto && cs.state === 'setup') {
    const steps = tutoSteps();
    s += `<h4>Mise en service pas à pas</h4><ol class="steps">${steps.map((x, i) => `<li class="${x.ok ? 'done' : ''}"><span>${esc(x.t)}</span>${x.ok ? '<i class="ck">✓</i>' : `<button class="link" data-act="tuto" data-i="${i}">Montrer</button>`}</li>`).join('')}</ol>`;
  }
  if (r && r.R.length) {
    const shown = r.R.filter(x => x.sev !== 'todo').slice(0, 6);
    if (shown.length) s += `<h4>Diagnostic</h4><ul class="diag">${shown.map(x => `<li class="${x.sev}">${esc(x.msg)}</li>`).join('')}</ul>`;
  }
  return s + '</article>';
}
function unlockName(u) {
  return (CAT[u] && CAT[u].name) || (CABLES[u] && CABLES[u].name) || (ROOM_ITEMS[u] && ROOM_ITEMS[u].name) || (DISKS[u] && DISKS[u].name) || ({ ram: 'Extensions de mémoire', lacp: 'LACP' }[u]) || u;
}
function sideContracts() {
  const order = { active: 1, setup: 0, offer: 2 };
  const list = [...S.contracts].sort((a, b) => order[a.state] - order[b.state]);
  return `<p class="intro">Chaque contrat liste ses services et ses flux. Le diagnostic suit les couches du modèle OSI : énergie et câbles d'abord, puis VLAN, IP, règles et application.</p>` + list.map(contractCard).join('');
}

/* ----- Équipement ----- */
function sideEquip() {
  const s = UI.sel;
  if (!s) return equipSummary();
  if (s.t === 'dev') return dev(s.d) ? equipDev(dev(s.d)) : equipSummary();
  if (s.t === 'port') return dev(s.d) ? equipPort(dev(s.d), s.p) : equipSummary();
  if (s.t === 'cable') { const c = S.cables.find(x => x.id === s.c); return c ? equipCable(c) : equipSummary(); }
  if (s.t === 'psu') return dev(s.d) ? equipPsu(dev(s.d), s.i) : equipSummary();
  if (s.t === 'pdu') return equipPdu(s.r, s.p);
  if (s.t === 'disk') return dev(s.d) ? equipDisk(dev(s.d), s.bay) : equipSummary();
  if (s.t === 'vm') { const v = S.vms.find(x => x.id === s.id); return v ? equipVm(v) : equipSummary(); }
  if (s.t === 'empty') return equipEmpty(s.r, s.u);
  if (s.t === 'slot') return equipSlot(s.row, s.pos);
  if (s.t === 'rack') return S.racks[s.r] ? equipRackCard(s.r) : equipSummary();
  if (s.t === 'crac' || s.t === 'cracslot') return equipCrac(s.slot);
  if (s.t === 'infra') return equipInfra(s.id);
  if (s.t === 'aisle') return equipAisle(s.id);
  return equipSummary();
}
function equipSlot(row, pos) {
  const name = row + String(pos).padStart(2, '0'), powered = !!S.power.rows[row];
  const cold = coldAisleOf(row);
  let s = `<article class="card"><header><div><div class="eyebrow">Rangée ${row} · face avant sur l'allée froide ${cold}</div><h3>Emplacement ${name}</h3></div>${pill(powered ? 'off' : 'bad', powered ? 'Libre' : 'Rangée non électrifiée')}</header>`;
  if (!powered) s += `<p class="warnbox">Aucune gaine à barres au-dessus de la rangée ${row} : une baie posée ici n'aurait pas de courant.</p><button class="btn ${unlocked('rowpower') ? 'primary' : ''}" data-act="rowpower" data-row="${row}" ${unlocked('rowpower') ? '' : 'disabled'}>Électrifier la rangée ${row} (${money(ROOM_ITEMS.rowpower.cost)})</button>${unlocked('rowpower') ? '' : '<p class="note">Débloqué par le contrat Mairie de Saint-Aubin.</p>'}`;
  else {
    s += `<p class="muted">${esc(ROOM_ITEMS.rack.desc)}</p><div class="btnrow"><button class="btn primary" data-act="rackbuy" data-row="${row}" data-pos="${pos}" data-kind="rack">Installer une baie 42U (${money(ROOM_ITEMS.rack.cost)})</button>`;
    s += `<button class="btn" data-act="rackbuy" data-row="${row}" data-pos="${pos}" data-kind="inrow" ${unlocked('inrow') ? '' : 'disabled'}>Climatiseur en rangée (${money(ROOM_ITEMS.inrow.cost)})</button></div>`;
    if (!unlocked('inrow')) s += `<p class="note">Le climatiseur en rangée arrive avec le contrat Nordik Shop.</p>`;
  }
  return s + `<p class="note"><button class="link" data-act="fiche" data-id="salle">Fiche : urbanisation d'une salle</button></p></article>`;
}
function equipRackCard(r) {
  const k = S.racks[r];
  if (k.kind === 'inrow') return `<article class="card"><header><div><div class="eyebrow">Rangée ${k.row}</div><h3>Climatiseur en rangée ${rackName(r)}</h3></div>${pill('ok', INROW_KW + ' kW')}</header><p class="muted">${esc(ROOM_ITEMS.inrow.desc)} Il refroidit les baies à deux positions ou moins dans la rangée.</p></article>`;
  const list = devsIn(r).filter(d => !['blank', 'cm'].includes(kindOf(d))).sort((a, b) => b.u - a.u);
  let s = `<article class="card"><header><div><div class="eyebrow">${k.row === 'MMR' ? 'Salle opérateurs' : 'Rangée ' + k.row + ' · allée froide ' + coldAisleOf(k.row)}</div><h3>${k.row === 'MMR' ? 'ODF des opérateurs' : 'Baie ' + rackName(r)}</h3></div>${pill(rackStatus(r) === 'ok' ? 'ok' : rackStatus(r) === 'empty' ? 'off' : 'warn', rackStatus(r) === 'empty' ? 'Vide' : rackStatus(r) === 'ok' ? 'En service' : 'À surveiller')}</header>`;
  s += `<div class="kv"><span>Puissance</span><b>${live(() => ((D.rackW[r] || 0) / 1000).toFixed(2).replace('.', ',') + ' kW')}</b><span>Entrée d'air</span><b>${live(() => (D.temp[r] || 20).toFixed(1).replace('.', ',') + ' °C')}</b><span>Froid local</span><b>${rackLocalCooling(r)} kW avant surchauffe</b><span>PDU A / B</span><b>${live(() => Math.round(((D.pdu[r] || {}).A || 0)) + ' W / ' + Math.round(((D.pdu[r] || {}).B || 0)) + ' W')}</b></div>`;
  s += `<button class="btn primary" data-act="openrack" data-r="${r}">Ouvrir la baie</button>`;
  if (list.length) s += `<ul class="devlist">${list.map(d => `<li><button class="vmrow" data-act="seldev" data-id="${d.id}">${stDot(D.powered[d.id] || !CAT[d.type].psu ? (devAlarm(d) ? 'warn' : 'ok') : 'down')} <b>${esc(nameOf(d))}</b> <span class="muted">${esc(CAT[d.type].name)} · U${d.u}</span></button></li>`).join('')}</ul>`;
  return s + '</article>';
}
function equipCrac(slot) {
  const c = S.cool.cracs.find(x => x.slot === slot), cap = roomCooling();
  let s = `<article class="card"><header><div><div class="eyebrow">Climatisation de salle</div><h3>${c ? 'CRAC-' + (slot + 1) : 'Emplacement CRAC-' + (slot + 1)}</h3></div>${c ? pill(c.ok ? 'ok' : 'bad', c.ok ? CRAC_KW + ' kW' : 'En panne') : pill('off', 'Libre')}</header>`;
  s += `<div class="kv"><span>Froid disponible</span><b>${cap.total} kW (${cap.crac} CRAC + ${cap.inrow} en rangée)</b><span>Chaleur des baies</span><b>${live(() => (D.itKW || 0).toFixed(2).replace('.', ',') + ' kW')}</b><span>Charge thermique</span><b>${live(() => Math.round((D.coolLoad || 0) * 100) + ' %')}</b></div>`;
  if (!c) s += `<p class="muted">${esc(ROOM_ITEMS.crac.desc)}</p><button class="btn primary" data-act="cracbuy" data-slot="${slot}" ${unlocked('crac') ? '' : 'disabled'}>Installer un CRAC ici (${money(ROOM_ITEMS.crac.cost)})</button>${unlocked('crac') ? '' : '<p class="note">Débloqué par le projet interne de supervision.</p>'}`;
  else if (!c.ok) s += S.timers['crac' + slot] ? `<p class="infobox">Frigoriste en route : réparation à ${clock(S.timers['crac' + slot]).stamp}.</p>` : `<button class="btn primary" data-act="cracfix" data-slot="${slot}">Appeler le frigoriste (800 €)</button>`;
  else s += `<p class="note">Au-delà de 75 % de charge thermique, l'air soufflé ne suffit plus et toutes les baies se réchauffent.</p>`;
  return s + `<p class="note"><button class="link" data-act="fiche" data-id="froid">Fiche : refroidissement et PUE</button></p></article>`;
}
function equipInfra(id) {
  const b = INFRA[id], P = S.power;
  let s = `<article class="card"><header><div><div class="eyebrow">Local électrique</div><h3>${b.label}</h3></div>`;
  if (id === 'tgbt') s += `${pill(P.edf ? 'ok' : 'bad', P.edf ? 'Secteur présent' : 'Secteur coupé')}</header><p class="muted">Tableau général basse tension : il reçoit l'arrivée EDF et alimente les onduleurs A et B.</p>`;
  else if (id.startsWith('ups')) {
    const u = P.ups[b.p];
    s += `${pill(u.trip || !S.feeds[b.p] ? 'bad' : 'ok', u.trip ? 'Surcharge, sortie coupée' : !S.feeds[b.p] ? 'En défaut' : 'En service')}</header>`;
    s += `<div class="kv"><span>Charge</span><b>${live(() => ((D.ups || {})[b.p] / 1000 || 0).toFixed(2).replace('.', ',') + ' kW')}</b><span>Capacité</span><b>${u.kw} kW</b><span>Source</span><b>${P.edf ? 'secteur EDF' : P.genRun ? 'groupe électrogène' : P.batt > 0 ? 'batteries' : 'aucune'}</b></div>`;
    s += `<div class="meter"><i style="width:${Math.min(100, ((D.ups || {})[b.p] || 0) / (u.kw * 10))}%" class="${((D.ups || {})[b.p] || 0) > u.kw * 500 ? 'warn' : ''}"></i><b style="left:50%"></b></div><p class="note">Le trait marque 50 % : au-delà, cet onduleur ne pourra pas reprendre seul la voie d'en face.</p>`;
    if (u.trip) s += `<button class="btn primary" data-act="upsreset" data-p="${b.p}">Réarmer l'onduleur ${b.p}</button>`;
  } else if (id.startsWith('bat')) s += `${pill(P.batt < P.battMax ? 'warn' : 'ok', Math.round(P.batt) + ' min')}</header><p class="muted">Les batteries prennent le relais instantanément pendant une coupure, le temps que le groupe électrogène démarre.</p><div class="kv"><span>Autonomie</span><b>${live(() => Math.round(S.power.batt) + ' / ' + S.power.battMax + ' min')}</b></div>`;
  else if (id === 'gen') s += `${P.gen ? pill(P.genRun ? 'ok' : 'off', P.genRun ? 'En marche' : 'Prêt') : pill('off', 'Absent')}</header><p class="muted">${esc(ROOM_ITEMS.gen.desc)}</p>${P.gen ? '' : `<button class="btn primary" data-act="pw" data-op="gen" ${unlocked('gen') ? '' : 'disabled'}>Installer (${money(ROOM_ITEMS.gen.cost)})</button>${unlocked('gen') ? '' : '<p class="note">Débloqué par le projet interne de sauvegardes.</p>'}`}`;
  return s + `<p class="note"><button class="link" data-act="tab" data-tab="room">Onglet Salle : toute la chaîne électrique</button> · <button class="link" data-act="fiche" data-id="onduleur">Fiche : onduleurs</button></p></article>`;
}
function equipAisle(id) {
  const a = AISLES.find(x => x.id === id);
  let s = `<article class="card"><header><div><div class="eyebrow">Entre les rangées ${a.rows.join(' et ')}</div><h3>Allée ${a.cold ? 'froide' : 'chaude'} ${id}</h3></div>${a.cold && S.cool.contain[id] ? pill('ok', 'Confinée') : pill('off', a.cold ? 'Ouverte' : 'Air chaud')}</header>`;
  s += `<p class="muted">${a.cold ? `Les faces avant des rangées ${a.rows.join(' et ')} donnent ici. Les dalles perforées soufflent l'air froid.` : `Les faces arrière des rangées ${a.rows.join(' et ')} rejettent ici leur air chaud, qui repart vers les climatiseurs.`}</p>`;
  if (a.cold && !S.cool.contain[id]) s += `<button class="btn primary" data-act="contain" data-id="${id}" ${unlocked('containment') ? '' : 'disabled'}>Confiner l'allée (${money(ROOM_ITEMS.containment.cost)})</button>${unlocked('containment') ? '' : '<p class="note">Débloqué par le projet interne de supervision.</p>'}`;
  return s + `<p class="note"><button class="link" data-act="fiche" data-id="froid">Fiche : refroidissement et PUE</button></p></article>`;
}
function crumb(d, extra) { return `<nav class="crumb"><button class="link" data-act="seldev" data-id="${d.id}">${esc(nameOf(d))}</button>${extra ? ' › ' + esc(extra) : ''}</nav>`; }
function equipSummary() {
  if (UI.mode === 'rack') return equipRackCard(UI.rack) + `<p class="intro">Clique un équipement, un port, un câble, une alimentation ou un disque dans la baie. Le Catalogue installe du matériel dans cette baie.</p>`;
  let s = `<p class="intro">Clique une baie, un emplacement libre, un climatiseur ou un élément du local électrique dans la salle.</p>`;
  S.racks.forEach((rk, r) => {
    if (rk.kind === 'inrow') return;
    s += `<h4><button class="link" data-act="openrack" data-r="${r}">${rk.row === 'MMR' ? 'Salle MMR' : 'Baie ' + rackName(r)}</button> · ${live(() => ((D.rackW[r] || 0) / 1000).toFixed(2).replace('.', ',') + ' kW · ' + (D.temp[r] || 20).toFixed(1).replace('.', ',') + ' °C')}</h4><ul class="devlist">`;
    devsIn(r).filter(d => !['blank'].includes(kindOf(d))).sort((a, b) => b.u - a.u).forEach(d => {
      s += `<li><button class="vmrow" data-act="seldev" data-id="${d.id}">${stDot(D.powered[d.id] || !CAT[d.type].psu ? (devAlarm(d) ? 'warn' : 'ok') : 'down')} <b>${esc(nameOf(d))}</b> <span class="muted">${esc(CAT[d.type].name)} · U${d.u}</span></button></li>`;
    });
    s += `</ul>`;
  });
  return s;
}
function equipDev(d) {
  const c = CAT[d.type], k = c.kind;
  let s = `<article class="card"><header><div><div class="eyebrow">${esc(c.name)} · baie ${rackName(d.rack)}, U${d.u}${c.u > 1 ? '–' + (d.u + c.u - 1) : ''}</div><h3>${esc(nameOf(d))}</h3></div>`;
  s += c.psu ? (D.powered[d.id] ? pill(devAlarm(d) ? 'warn' : 'ok', devAlarm(d) ? 'Alarme' : 'Sous tension') : pill('bad', d.thermalOff ? 'Arrêt thermique' : 'Hors tension')) : pill('offer', 'Passif');
  s += `</header><p class="muted">${esc(c.desc || '')}</p>`;
  if (c.psu) s += `<div class="kv"><span>Consommation</span><b>${live(() => Math.round(D.draw[d.id] || 0) + ' W')}</b><span>Charge</span><b>${live(() => Math.round((D.util[d.id] || 0) * 100) + ' %')}</b></div>`;
  s += `<div class="btnrow">`;
  if (k !== 'blank' && k !== 'cm') s += `<button class="btn" data-act="win" data-id="${d.id}" title="Ou double-clic sur l'équipement">Fenêtre de config</button>`;
  if (k !== 'odf' && kindOf(d) !== 'blank' && kindOf(d) !== 'cm' && k !== 'rogue') s += `<button class="btn" data-act="console" data-id="${d.id}">Console</button>`;
  if (!c.fixed && k !== 'rogue') s += `<button class="btn" data-act="move" data-id="${d.id}">Déplacer</button>`;
  if (c.psu && k !== 'rogue') s += `<button class="btn" data-act="power" data-id="${d.id}">${d.on ? 'Éteindre' : 'Allumer'}</button>`;
  if (!c.fixed) s += `<button class="btn danger" data-act="remove" data-id="${d.id}">${k === 'rogue' ? 'Débrancher et retirer' : 'Retirer'}</button>`;
  s += `</div></article>`;
  if (c.psu && k !== 'rogue') {
    s += `<article class="card"><h4>Alimentations</h4><ul class="plist">`;
    d.psus.forEach((p, i) => {
      const live2 = p.out && pduLive(d.rack, p.out.pdu);
      s += `<li>${stDot(!p.ok ? 'bad' : live2 ? 'ok' : 'down')} <b>PSU${i + 1}</b> <span class="muted">${!p.ok ? 'en panne' : p.out ? `PDU ${p.out.pdu}, prise ${p.out.i + 1}${live2 ? '' : ' (sans courant)'}` : 'non branchée'}</span>
      <span class="btnrow">${!p.out ? `<button class="btn small" data-act="plug" data-id="${d.id}" data-i="${i}" data-p="A">PDU A</button><button class="btn small" data-act="plug" data-id="${d.id}" data-i="${i}" data-p="B">PDU B</button>` : `<button class="btn small" data-act="unplug" data-id="${d.id}" data-i="${i}">Débrancher</button>`}${!p.ok ? `<button class="btn small primary" data-act="psurep" data-id="${d.id}" data-i="${i}">Remplacer (180 $)</button>` : ''}</span></li>`;
    });
    s += `</ul>`;
    const outs = d.psus.filter(p => p.out).map(p => p.out.pdu);
    if (d.psus.length === 2 && outs.length === 2 && outs[0] === outs[1]) s += `<p class="warnbox">Les deux PSU sont sur le PDU ${outs[0]} : si la voie ${outs[0]} tombe, l'équipement s'éteint. Mets l'une sur A et l'autre sur B.</p>`;
    if (d.psus.length === 1) s += `<p class="note">Une seule alimentation : c'est un point unique de panne.</p>`;
    s += `</article>`;
  }
  if (k === 'server') s += serverSections(d);
  if (k === 'nas') s += storageSection(d) + `<article class="card"><h4>VM stockées ici</h4>${S.vms.filter(v => v.sto === d.id).map(v => `<button class="vmrow" data-act="selvm" data-id="${v.id}">${stDot(D.vm[v.id].st)} ${esc(v.name)}</button>`).join('') || '<p class="muted">Aucune pour l’instant.</p>'}</article>`;
  if (k === 'fw') s += `<article class="card"><h4>Pare-feu</h4><p class="muted">La matrice de flux, les VLAN routés et les protections se règlent dans l'onglet Réseau.</p><button class="btn" data-act="tab" data-tab="network">Ouvrir l'onglet Réseau</button></article>`;
  if (k === 'router') s += `<article class="card"><h4>Opérateurs</h4><div class="kv"><span>Accès Internet</span><b>${live(() => D.inet.ok ? `${D.inet.ops} lien(s), ${speedName(D.inet.cap)}` : 'coupé')}</b><span>Trafic Internet</span><b>${live(() => speedName(Math.round(D.inetUse || 0)))}</b></div>${D.inet.ok ? '' : `<p class="warnbox">${esc(D.inet.why)}</p>`}</article>`;
  if (CAT[d.type].ports.length) {
    s += `<article class="card"><h4>Ports (face arrière)</h4><table class="ptable"><thead><tr><th>Port</th><th>État</th><th>Relié à</th>${hasCfg(d, CAT[d.type].ports[0]) || kindOf(d) === 'switch' ? '<th>Mode</th>' : ''}</tr></thead><tbody>`;
    for (const p of CAT[d.type].ports) {
      const c = portCable(d.id, p.id), L = c && D.link[c.id], kc = hasCfg(d, p) ? cfg(d, p.id) : null;
      const st = kc && kc.err ? ['bad', 'err-disabled'] : kc && !kc.admin ? ['down', 'shutdown'] : c ? (L.up ? (L.dmg || L.mismatch ? ['warn', 'erreurs'] : ['ok', 'up']) : ['down', 'down']) : ['off', 'libre'];
      const peer = c ? otherEnd(c, d.id, p.id) : null;
      s += `<tr data-act="selport" data-id="${d.id}" data-p="${esc(p.id)}" tabindex="0"><td><b>${esc(p.id)}</b>${p.role ? ` <span class="muted">${p.role}</span>` : ''}</td><td>${stDot(st[0])} ${st[1]}</td><td>${peer ? esc(nameOf(dev(peer.d)) + ' ' + peer.p) : '<span class="muted">—</span>'}</td>${kc ? `<td>${kc.mode === 'access' ? 'VLAN ' + kc.vlan : 'trunk'}</td>` : (kindOf(d) === 'switch' ? '<td></td>' : '')}</tr>`;
    }
    s += `</tbody></table></article>`;
  }
  s += cliBox(d);
  return s;
}
function cliBox(d) {
  const L = S.cli.filter(x => x.d === d.id).slice(-3);
  if (!L.length) return '';
  return `<article class="card"><h4>Commandes équivalentes</h4><p class="muted">Ce que tu viens de faire, tapé en ligne de commande :</p><pre class="cli">${L.map(x => esc(x.lines.join('\n'))).join('\n\n')}</pre></article>`;
}
function serverSections(d) {
  const c = CAT[d.type], u = hostUsed(d);
  let s = `<article class="card"><h4>Ressources de l'hyperviseur</h4><div class="kv">
<span>Processeur</span><b>${live(() => Math.round((D.cpu[d.id] || 0) * 100) + ' %' + (d.throttle ? ' (fréquence réduite)' : ''))}</b>
<span>vCPU alloués</span><b>${u.vcpu} / ${c.cores} cœurs (${(u.vcpu / c.cores).toFixed(2).replace('.', ',')}:1)</b>
<span>Mémoire allouée</span><b>${u.ram} / ${d.ram} Go</b></div>
${unlocked('ram') ? `<button class="btn small" data-act="ram" data-id="${d.id}" ${d.ram >= c.ramMax ? 'disabled' : ''}>Doubler la RAM (${money(d.ram / 64 * 420)})</button>` : '<p class="note">Les extensions de mémoire arrivent avec le contrat Cabinet Marchand.</p>'}</article>`;
  s += storageSection(d);
  const vms = S.vms.filter(v => v.host === d.id);
  s += `<article class="card"><h4>Machines virtuelles</h4>${vms.map(v => `<button class="vmrow" data-act="selvm" data-id="${v.id}">${stDot(D.vm[v.id] ? D.vm[v.id].st : 'down')} <b>${esc(v.name)}</b> <span class="muted">VLAN ${v.vlan} · ${v.ip} · ${v.vcpu} vCPU · ${v.ram} Go</span></button>`).join('') || '<p class="muted">Aucune VM. Elles se déploient depuis un contrat.</p>'}</article>`;
  return s;
}
function storageSection(d) {
  const A = arrayInfo(d), used = storeUsed(d);
  let s = `<article class="card"><h4>Disques et RAID</h4><div class="kv"><span>Grappe</span><b>${RAID[d.raid].name}${A.valid ? '' : ' (non valide)'} · ${({ ok: 'saine', deg: 'dégradée', fail: 'détruite', none: 'vide', invalid: 'à configurer' })[A.state]}</b>
<span>Capacité utile</span><b>${A.usable.toFixed(2).replace('.', ',')} To (${used.toFixed(2).replace('.', ',')} To utilisés)</b><span>Tolérance</span><b>${A.valid ? A.tol + ' disque(s)' : '—'}</b></div>`;
  s += `<div class="bays">${d.disks.map((x, i) => `<button class="baybtn ${x ? x.st : 'empty'}" data-act="seldisk" data-id="${d.id}" data-bay="${i}" title="Baie ${i}">${i}<small>${x ? (x.type === 'ssd' ? 'SSD' : 'HDD') : '+'}</small></button>`).join('')}</div>`;
  s += `<label class="fld">Niveau RAID <select data-act="raid" data-id="${d.id}">${Object.keys(RAID).map(k => `<option value="${k}" ${d.raid === k ? 'selected' : ''}>${RAID[k].name} : ${RAID[k].perf}</option>`).join('')}</select></label>`;
  if (A.mixed) s += `<p class="note">Disques de tailles différentes : la grappe s'aligne sur le plus petit.</p>`;
  s += `<p class="muted">Formule : ${raidFormula(d)}</p></article>`;
  return s;
}
function raidFormula(d) {
  const A = arrayInfo(d); if (!A.n) return 'ajoute des disques en face avant.';
  const n = A.n, sz = A.size.toLocaleString('fr-FR');
  return ({ none: `${n} × ${sz} To, sans protection`, '0': `${n} × ${sz} = ${(n * A.size).toFixed(2)} To, aucune tolérance`, '1': `miroir : ${sz} To utiles sur ${n} disques`, '5': `(N − 1) × taille = ${n - 1} × ${sz} To`, '6': `(N − 2) × taille = ${n - 2} × ${sz} To`, '10': `N / 2 × taille = ${n / 2} × ${sz} To` })[d.raid];
}
function equipPort(d, pid) {
  const p = portDef(d, pid), c = portCable(d.id, pid), L = c && D.link[c.id], kc = hasCfg(d, p) ? cfg(d, pid) : null;
  let s = crumb(d, pid) + `<article class="card"><header><div><div class="eyebrow">${portTypeName(p.t)} · ${speedName(p.speed)}${p.role ? ' · ' + p.role : ''}</div><h3>${esc(pid)}</h3></div>`;
  s += kc && kc.err ? pill('bad', 'err-disabled') : kc && !kc.admin ? pill('down', 'shutdown') : c ? (L.up ? pill(L.dmg || L.mismatch ? 'warn' : 'ok', L.dmg ? 'Erreurs CRC' : L.mismatch ? 'Duplex incohérent' : 'Lien actif') : pill('bad', 'Lien coupé')) : pill('off', 'Libre');
  s += `</header>`;
  if (UI.from && UI.from.d === d.id && UI.from.p === pid) s += `<p class="infobox">Mode câblage : clique maintenant un second port libre du même type dans la baie (il brille), ou choisis-le ici.</p>`;
  if (c) {
    const o = otherEnd(c, d.id, pid);
    s += `<div class="kv"><span>Câble</span><b><button class="link" data-act="selcable" data-id="${c.id}">${esc(CABLES[c.type].name)}, ${fmtLen(c.len)}</button></b><span>Relié à</span><b><button class="link" data-act="selport" data-id="${o.d}" data-p="${esc(o.p)}">${esc(nameOf(dev(o.d)) + ' ' + o.p)}</button></b><span>Débit</span><b>${L.up ? speedName(L.speed) : '—'}</b><span>Trafic</span><b>${live(() => speedName(Math.round(D.cUse[c.id] || 0)))}</b></div>`;
    if (!L.up) s += `<p class="warnbox">Couche 1 : ${esc(L.why)}.</p>`;
  } else {
    const cands = [];
    for (const x of Object.values(S.devs)) for (const q of CAT[x.type].ports) if (q.t === p.t && !portCable(x.id, q.id) && !(x.id === d.id && q.id === pid) && kindOf(x) !== 'rogue') cands.push({ d: x.id, p: q.id, n: nameOf(x) + ' ' + q.id });
    s += `<label class="fld">Câbler vers <select data-act="cableto" data-id="${d.id}" data-p="${esc(pid)}"><option value="">Choisir un port libre…</option>${cands.map(x => `<option value="${x.d}|${esc(x.p)}">${esc(x.n)}</option>`).join('')}</select></label>`;
  }
  if (p.t !== 'rj45' && !p.op) {
    const m = d.mods[pid];
    s += `<h4>Module</h4><p class="muted">${m ? `${MODULES[m].std[p.t]} (${MODULES[m].long})${d.modFail[pid] ? ' : <b class="bad">défaillant</b>' : ''}` : c && CABLES[c.type].noModule ? 'Occupé par un DAC (modules intégrés).' : 'Cage vide.'}</p><div class="btnrow">`;
    if (!c || !CABLES[c.type].noModule) {
      if (!m) for (const k of ['SR', 'LR']) if (k === 'LR' || unlocked('om4')) s += `<button class="btn small" data-act="mod" data-id="${d.id}" data-p="${esc(pid)}" data-m="${k}">Insérer ${k} (${money(MODULES[k].price[p.t])})</button>`;
      if (m) s += `<button class="btn small ${d.modFail[pid] ? 'primary' : ''}" data-act="modrep" data-id="${d.id}" data-p="${esc(pid)}">Remplacer le module</button>${!c ? `<button class="btn small" data-act="mod" data-id="${d.id}" data-p="${esc(pid)}" data-m="">Retirer</button>` : ''}`;
    }
    s += `</div>`;
  }
  if (c) s += `<div class="btnrow"><button class="btn" data-act="cablerep" data-id="${c.id}">Remplacer le câble</button><button class="btn danger" data-act="unplugc" data-id="${c.id}">Débrancher</button></div>`;
  s += `</article>`;
  if (kc) {
    const isFw = kindOf(d) === 'fw';
    s += `<article class="card"><h4>Configuration du port</h4>
<label class="fld chk"><input type="checkbox" data-act="pcfg" data-f="admin" data-id="${d.id}" data-p="${esc(pid)}" ${kc.admin ? 'checked' : ''}> Port activé (<code>${kc.admin ? 'no shutdown' : 'shutdown'}</code>)</label>
<label class="fld">Mode <select data-act="pcfg" data-f="mode" data-id="${d.id}" data-p="${esc(pid)}"><option value="access" ${kc.mode === 'access' ? 'selected' : ''}>access : un seul VLAN</option><option value="trunk" ${kc.mode === 'trunk' ? 'selected' : ''}>trunk : plusieurs VLAN étiquetés 802.1Q</option></select></label>`;
    if (kc.mode === 'access') s += `<label class="fld">VLAN <select data-act="pcfg" data-f="vlan" data-id="${d.id}" data-p="${esc(pid)}">${VLAN_IDS.map(v => `<option value="${v}" ${kc.vlan === v ? 'selected' : ''}>${v} · ${VLANS[v].name}</option>`).join('')}</select></label>`;
    else {
      s += `<fieldset class="fld"><legend>VLAN autorisés sur le trunk</legend><div class="chips">${VLAN_IDS.filter(v => v !== 1).map(v => `<label class="chipc"><input type="checkbox" data-act="pallow" data-v="${v}" data-id="${d.id}" data-p="${esc(pid)}" ${kc.allowed.includes(v) ? 'checked' : ''}> ${v} ${VLANS[v].name}</label>`).join('')}</div></fieldset>`;
      if (!isFw) s += `<label class="fld">VLAN natif <select data-act="pcfg" data-f="native" data-id="${d.id}" data-p="${esc(pid)}">${[1, 999].map(v => `<option value="${v}" ${kc.native === v ? 'selected' : ''}>${v}${v === 999 ? ' (dédié, recommandé)' : ' (déconseillé)'}</option>`).join('')}</select></label>`;
    }
    if (!isFw && p.t === 'rj45') s += `<div class="two"><label class="fld">Vitesse <select data-act="pcfg" data-f="speed" data-id="${d.id}" data-p="${esc(pid)}">${['auto', '100', '1000'].map(v => `<option ${kc.speed === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="fld">Duplex <select data-act="pcfg" data-f="duplex" data-id="${d.id}" data-p="${esc(pid)}">${['auto', 'full', 'half'].map(v => `<option ${kc.duplex === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>`;
    if (!isFw) s += `<label class="fld chk"><input type="checkbox" data-act="pcfg" data-f="bpdu" data-id="${d.id}" data-p="${esc(pid)}" ${kc.bpdu ? 'checked' : ''}> PortFast et BPDU Guard (ports vers des serveurs)</label>
<label class="fld chk"><input type="checkbox" data-act="pcfg" data-f="psec" data-id="${d.id}" data-p="${esc(pid)}" ${kc.psec ? 'checked' : ''}> Port Security (2 MAC maximum)</label>
<label class="fld">Description <input type="text" maxlength="24" value="${esc(kc.desc)}" data-act="pdesc" data-id="${d.id}" data-p="${esc(pid)}" placeholder="ex. vers srv-a1-01"></label>`;
    if (kc.err) s += `<p class="warnbox">Port err-disabled (${esc(kc.err)}). Retire la cause, puis décoche et recoche « Port activé » (shutdown / no shutdown).</p>`;
    s += `</article>`;
  }
  return s + cliBox(d);
}
function equipCable(c) {
  const ct = CABLES[c.type], L = D.link[c.id] || {};
  let s = `<article class="card"><header><div><div class="eyebrow">Câble · ${esc(ct.std)}</div><h3>${esc(ct.name)}, ${fmtLen(c.len)}</h3></div>${L.up ? pill(c.dmg ? 'warn' : 'ok', c.dmg ? 'Erreurs CRC' : 'Lien actif') : pill('bad', 'Coupé')}</header>`;
  s += `<div class="kv">${[c.a, c.b].map((e, i) => `<span>Bout ${i ? 'B' : 'A'}</span><b><button class="link" data-act="selport" data-id="${e.d}" data-p="${esc(e.p)}">${esc(nameOf(dev(e.d)) + ' ' + e.p)}</button></b>`).join('')}
<span>Débit</span><b>${L.up ? speedName(L.speed) : '—'}</b><span>Utilisation</span><b>${live(() => L.up ? Math.round((D.cUse[c.id] || 0) / L.speed * 100) + ' %' : '—')}</b><span>Portée max</span><b>${Object.entries(ct.max).map(([sp, m]) => `${m} m à ${speedName(+sp)}`).join(', ')}</b></div>`;
  if (!L.up) s += `<p class="warnbox">${esc(L.why)}.</p>`;
  if (c.dmg) s += `<p class="warnbox">Ce câble produit des trames corrompues. Remplace-le.</p>`;
  s += `<div class="btnrow"><button class="btn primary" data-act="cablerep" data-id="${c.id}">Remplacer (${money(ct.base + ct.perM * c.len)})</button><button class="btn danger" data-act="unplugc" data-id="${c.id}">Débrancher</button></div></article>`;
  return s;
}
function equipPsu(d, i) {
  const p = d.psus[i], live2 = p.out && pduLive(d.rack, p.out.pdu);
  return crumb(d, 'PSU' + (i + 1)) + `<article class="card"><header><div><div class="eyebrow">Bloc d'alimentation</div><h3>PSU${i + 1}</h3></div>${pill(!p.ok ? 'bad' : live2 ? 'ok' : 'down', !p.ok ? 'En panne' : live2 ? 'Alimentée' : 'Sans courant')}</header>
<p class="muted">${p.out ? `Branchée sur la prise ${p.out.i + 1} du PDU ${p.out.pdu} (voie ${p.out.pdu}).` : 'Non branchée.'}</p>
<div class="btnrow">${!p.out ? `<button class="btn" data-act="plug" data-id="${d.id}" data-i="${i}" data-p="A">Brancher sur PDU A</button><button class="btn" data-act="plug" data-id="${d.id}" data-i="${i}" data-p="B">Brancher sur PDU B</button>` : `<button class="btn" data-act="unplug" data-id="${d.id}" data-i="${i}">Débrancher</button>`}${!p.ok ? `<button class="btn primary" data-act="psurep" data-id="${d.id}" data-i="${i}">Remplacer à chaud (180 $)</button>` : ''}</div>
<p class="note">Règle : PSU1 sur la voie A, PSU2 sur la voie B. <button class="link" data-act="fiche" data-id="elec">Fiche : alimentation</button></p></article>`;
}
function equipPdu(r, p) {
  const load = (D.pdu[r] || {})[p] || 0, pct = load / PDU_CAP, other = (D.pdu[r] || {})[p === 'A' ? 'B' : 'A'] || 0;
  const list = devsIn(r).filter(d => d.psus.some(x => x.out && x.out.pdu === p));
  return `<article class="card"><header><div><div class="eyebrow">Baie ${rackName(r)} · 16 A sous 230 V</div><h3>PDU ${p} (voie ${p})</h3></div>${S.racks[r].trip[p] ? pill('bad', 'Disjoncté') : !S.feeds[p] ? pill('bad', 'Voie coupée') : pill(pct > 0.5 ? 'warn' : 'ok', Math.round(pct * 100) + ' %')}</header>
<div class="kv"><span>Charge</span><b>${live(() => Math.round(((D.pdu[r] || {})[p] || 0)) + ' W · ' + (((D.pdu[r] || {})[p] || 0) / 230).toFixed(1).replace('.', ',') + ' A')}</b><span>Capacité</span><b>3 680 W (16 A × 230 V)</b><span>Si l'autre voie tombe</span><b class="${load + other > PDU_CAP ? 'bad' : ''}">${Math.round(load + other)} W ${load + other > PDU_CAP ? ': le disjoncteur sauterait' : ': ça tient'}</b></div>
<div class="meter"><i style="width:${Math.min(100, pct * 100)}%" class="${pct > 1 ? 'bad' : pct > 0.5 ? 'warn' : ''}"></i><b style="left:50%"></b></div>
<p class="note">Le trait marque 50 % : au-dessus, ce PDU ne pourra pas reprendre seul la charge de la baie.</p>
${S.racks[r].trip[p] ? `<button class="btn primary" data-act="reset" data-r="${r}" data-p="${p}">Réarmer le disjoncteur</button>` : ''}
<h4>Branché sur ce PDU</h4><ul class="plist">${list.map(d => `<li><button class="link" data-act="seldev" data-id="${d.id}">${esc(nameOf(d))}</button> <span class="muted">${Math.round((D.draw[d.id] || 0) / Math.max(1, d.psus.filter(x => x.ok && x.out && pduLive(d.rack, x.out.pdu)).length))} W</span></li>`).join('') || '<li class="muted">Rien.</li>'}</ul></article>`;
}
function equipDisk(d, bay) {
  const x = d.disks[bay];
  let s = crumb(d, 'baie ' + bay) + `<article class="card"><header><div><div class="eyebrow">Face avant · baie de disque ${bay}</div><h3>${x ? DISKS[x.type].name : 'Baie vide'}</h3></div>${x ? pill(x.st === 'ok' ? 'ok' : x.st === 'rebuild' ? 'warn' : 'bad', x.st === 'ok' ? 'En service' : x.st === 'rebuild' ? 'Reconstruction ' + Math.round(x.rb * 100) + ' %' : 'En panne') : pill('off', 'Vide')}</header>`;
  if (!x) s += `<div class="btnrow">${Object.entries(DISKS).filter(([k, v]) => unlocked(v.unlock)).map(([k, v]) => `<button class="btn" data-act="adddisk" data-id="${d.id}" data-bay="${bay}" data-t="${k}">Insérer ${v.name} (${money(v.price)})</button>`).join('')}</div><p class="note">Ajouter un disque à une grappe en service lance une reconstruction. Change le niveau RAID tant qu'aucune VM n'est stockée ici.</p>`;
  else {
    if (x.st === 'failed') s += `<p class="warnbox">Voyant orange : ce disque est en panne. Les disques sont échangeables à chaud : la reconstruction démarre seule.</p><button class="btn primary" data-act="repdisk" data-id="${d.id}" data-bay="${bay}">Remplacer à chaud (${money(DISKS[x.type].price)})</button>`;
    s += `<button class="btn" data-act="rmdisk" data-id="${d.id}" data-bay="${bay}">Retirer</button>`;
  }
  return s + `<p class="note"><button class="link" data-act="fiche" data-id="raid">Fiche : RAID</button></p></article>` + storageSection(d);
}
function equipVm(v) {
  const r = D.vm[v.id] || { st: 'down', R: [] }, s0 = SVC[v.svc], host = dev(v.host), def = v.k ? contractDef(v.k) : null;
  let s = (host ? crumb(host, v.name) : '') + `<article class="card"><header><div><div class="eyebrow">VM ${v.vmid} · ${esc(s0.soft)}${def ? ' · ' + esc(def.client) : ' · non déclarée'}</div><h3>${esc(v.name)}</h3></div>${pill(r.st === 'ok' ? 'ok' : r.st === 'deg' ? 'warn' : 'bad', r.st === 'ok' ? 'Opérationnelle' : r.st === 'deg' ? 'Dégradée' : 'En panne')}</header>`;
  s += `<div class="kv"><span>Réseau</span><b>VLAN ${v.vlan} (${VLANS[v.vlan].name}) · ${v.ip}/24</b><span>Passerelle</span><b>${VLANS[v.vlan].gw || 'aucune (non routé)'}</b><span>Ressources</span><b>${v.vcpu} vCPU · ${v.ram} Go · ${v.disk} Go</b><span>Stockage</span><b>${esc(dev(v.sto) ? (v.sto === v.host ? 'local, ' : 'NFS, ') + dev(v.sto).host : '?')}</b>`;
  if (s0.cert) s += `<span>Certificat</span><b>${v.cert < S.t ? '<span class="bad">expiré</span>' : 'valide jusqu’au ' + clock(v.cert).stamp}${v.acme ? ' · ACME' : ''}</b>`;
  if (D.backup || v.lastBak) s += `<span>Dernière sauvegarde</span><b>${v.lastBak ? clock(v.lastBak).stamp : 'jamais'}</b>`;
  s += `</div>`;
  if (r.R.length) s += `<h4>Diagnostic, couche par couche</h4><ul class="diag">${[...r.R].sort((a, b) => a.lvl - b.lvl).map(x => `<li class="${x.sev}"><b>Couche ${x.lvl}</b> ${esc(x.msg)}</li>`).join('')}</ul>`;
  s += `<div class="btnrow">`;
  s += `<button class="btn" data-act="vmcons" data-id="${v.id}">Console</button>`;
  if (v.st === 'running') s += `<button class="btn" data-act="vm" data-op="restart" data-id="${v.id}">Redémarrer</button><button class="btn" data-act="vm" data-op="stop" data-id="${v.id}">Arrêter</button>`;
  if (v.st === 'stopped' || v.st === 'crashed') s += `<button class="btn primary" data-act="vm" data-op="start" data-id="${v.id}">${v.st === 'crashed' ? 'Redémarrer' : 'Démarrer'}</button>`;
  if (v.st === 'lost' || v.st === 'encrypted') s += `<button class="btn primary" data-act="vm" data-op="restore" data-id="${v.id}">Restaurer la sauvegarde</button><button class="btn danger" data-act="vm" data-op="reinstall" data-id="${v.id}">Réinstaller (données perdues)</button>`;
  s += `<button class="btn" data-act="vm" data-op="isolate" data-id="${v.id}">${v.isolated ? 'Reconnecter au réseau' : 'Isoler du réseau'}</button>`;
  s += `</div><h4>Maintenance</h4><div class="btnrow">`;
  if (s0.cert) s += `<button class="btn small ${v.cert < S.t ? 'primary' : ''}" data-act="vm" data-op="renew" data-id="${v.id}">Renouveler le certificat</button><label class="chipc"><input type="checkbox" data-act="vmtog" data-op="acme" data-id="${v.id}" ${v.acme ? 'checked' : ''}> Renouvellement ACME</label>`;
  s += `<label class="chipc"><input type="checkbox" data-act="vmtog" data-op="f2b" data-id="${v.id}" ${v.f2b ? 'checked' : ''}> fail2ban</label>`;
  s += `<button class="btn small" data-act="vm" data-op="purge" data-id="${v.id}">Purger les journaux</button><button class="btn small" data-act="vm" data-op="ram" data-id="${v.id}">Doubler la RAM</button><button class="btn small danger" data-act="vm" data-op="delete" data-id="${v.id}">Supprimer la VM</button>`;
  return s + `</div></article>`;
}
function equipEmpty(r, u) {
  return `<article class="card"><header><div><div class="eyebrow">Baie ${rackName(r)}</div><h3>U${u} vide</h3></div>${pill('off', 'Libre')}</header>
<p class="muted">Une unité vide laisse l'air chaud de l'arrière revenir vers l'entrée d'air des serveurs.</p>
<div class="btnrow"><button class="btn primary" data-act="quick" data-t="blank" data-r="${r}" data-u="${u}">Poser un obturateur (15 $)</button><button class="btn" data-act="quick" data-t="cm" data-r="${r}" data-u="${u}">Poser un guide-câbles (60 $)</button><button class="btn" data-act="shop">Autre équipement…</button></div>
<button class="btn small" data-act="blankall" data-r="${r}">Obturer toutes les unités vides de la baie</button></article>`;
}

/* ----- Tickets ----- */
function sideTickets() {
  const open = S.tickets.filter(t => t.det && !t.closed).reverse();
  const closed = S.tickets.filter(t => t.closed).length;
  let s = `<p class="intro">Méthode : définir, collecter, supposer, tester un seul changement, documenter. Sans supervision, tu n'apprends une panne que lorsqu'un client appelle.</p>`;
  if (!D.monitoring) s += `<p class="note">Supervision absente : les pannes matérielles redondées (PSU, disque) restent invisibles tant que tu ne regardes pas les voyants.</p>`;
  if (!open.length) s += `<p class="muted">Aucun ticket ouvert.${closed ? ` ${closed} ticket(s) clos.` : ''}</p>`;
  for (const t of open) {
    const def = INCIDENTS[t.type], x = t.ctx, isOpen = UI.openTicket === t.id;
    s += `<article class="card ticket ${t.fixedAt ? 'fixed' : ''}"><header><div><div class="eyebrow">Ticket n° ${t.id} · signalé par ${esc(t.by)} · ${clock(t.det).stamp}</div><h3>${esc(def.title)}</h3></div>${t.fixedAt ? pill('ok', 'Corrigé') : pill('bad', 'Ouvert')}</header>`;
    s += `<p class="alert">${esc(t.by === 'client' ? clientSymptom(t) : def.alert(x))}</p>`;
    if (t.fixedAt) s += `<p class="muted">Le problème est réglé. Documente-le : cause racine et prévention.</p><button class="btn primary" data-act="report" data-id="${t.id}">Rédiger le rapport</button>`;
    else {
      s += `<button class="link" data-act="tkopen" data-id="${t.id}">${isOpen ? 'Masquer la démarche' : 'Voir la démarche'}</button>`;
      if (isOpen) {
        const hints = def.hints(x);
        s += `<ol class="method"><li><b>Définir</b> : ${esc(t.by === 'client' ? clientSymptom(t) : def.alert(x))}</li><li><b>Collecter</b> : ${collectChip(t)}</li><li><b>Supposer et tester</b> : un seul changement à la fois.</li><li><b>Documenter</b> : le rapport s'ouvre quand c'est réglé.</li></ol>`;
        s += hints.slice(0, t.hints).map((h, i) => `<p class="hint">Indice ${i + 1} : ${esc(h)}</p>`).join('');
        if (t.hints < hints.length) s += `<button class="btn small" data-act="hint" data-id="${t.id}">Un indice (−5 XP)</button>`;
        s += ` <button class="link" data-act="fiche" data-id="${def.fiche}">Fiche : ${esc(FICHE(def.fiche).title)}</button>`;
      }
    }
    s += `</article>`;
  }
  s += `<h4>Journal de la salle</h4><ul class="events">${S.events.slice(0, 30).map(e => `<li class="${e.kind}"><time>${clock(e.t).stamp}</time> ${esc(e.msg)}</li>`).join('')}</ul>`;
  return s;
}
function clientSymptom(t) {
  const imp = S.contracts.find(c => c.state === 'active' && D.ct[c.id] && D.ct[c.id].st !== 'ok');
  const who = imp ? contractDef(imp.id).client : 'Un client';
  const map = { crc: 'Le site est très lent, des pages ne finissent pas de charger.', duplex: 'Tout est lent depuis ce matin.', ddos: 'Le site ne répond plus du tout.', cert: 'Le navigateur affiche « Votre connexion n’est pas privée ».', full: 'Impossible d’enregistrer quoi que ce soit.', oom: 'Le service tombe toutes les vingt minutes.', ipdup: 'Ça marche une fois sur deux.', ransom: 'Nos fichiers ont tous une extension bizarre !' };
  return `${who} appelle : « ${map[t.type] || 'Plus rien ne fonctionne chez nous.'} »`;
}
function collectChip(t) {
  const def = INCIDENTS[t.type], x = t.ctx;
  const vmId = def.vmTarget && def.vmTarget(x);
  const dId = vmId ? null : (def.target ? def.target(x) : x.d);
  const cmd = def.cmd(x);
  if (vmId && S.vms.find(v => v.id === vmId)) return `<button class="link mono" data-act="runcmd" data-vm="${vmId}" data-cmd="${esc(cmd)}">${esc(cmd)}</button> sur ${esc(S.vms.find(v => v.id === vmId).name)}`;
  if (dId && dev(dId)) return `<button class="link mono" data-act="runcmd" data-dev="${dId}" data-cmd="${esc(cmd)}">${esc(cmd)}</button> sur ${esc(nameOf(dev(dId)))}`;
  return `regarde les voyants et la console des équipements concernés (<span class="mono">${esc(cmd)}</span>).`;
}

/* ----- Réseau ----- */
function sideNetwork() {
  let s = `<article class="card"><h4>Plan d'adressage</h4><table class="ptable"><thead><tr><th>VLAN</th><th>Réseau</th><th>Passerelle</th></tr></thead><tbody>${VLAN_IDS.filter(v => v !== 1).map(v => `<tr><td><i class="vl" style="background:${VLANS[v].color}"></i>${v} ${VLANS[v].name}</td><td class="mono">${VLANS[v].net}.0/24</td><td class="mono">${VLANS[v].gw || '—'}</td></tr>`).join('')}</tbody></table><p class="muted">VLAN 30 non routé : seul un hôte branché dans ce VLAN atteint le stockage.</p></article>`;
  const dr = UI.ruleDraft;
  const zones = ['Internet', 'DMZ', 'SERVEURS', 'ADMIN', 'STOCKAGE', 'any'];
  s += `<article class="card"><h4>Matrice de flux du pare-feu</h4><p class="muted">Politique par défaut : tout refuser. Chaque ligne autorise un flux ; les réponses reviennent seules (pare-feu avec état).</p>`;
  s += `<table class="ptable rules"><thead><tr><th>Source</th><th>Destination</th><th>Port</th><th></th></tr></thead><tbody>`;
  S.rules.forEach((r, i) => { const risk = ruleRisk(r); s += `<tr class="${risk ? 'risky' : ''}"><td>${r.src}</td><td>${r.dst}</td><td class="mono">${r.proto.toUpperCase()} ${r.port}</td><td><button class="link" data-act="delrule" data-i="${i}" aria-label="Supprimer la règle">Suppr.</button></td></tr>${risk ? `<tr class="risky"><td colspan="4">⚠ ${esc(risk)}</td></tr>` : ''}`; });
  if (!S.rules.length) s += `<tr><td colspan="4" class="muted">Aucune règle : tout est refusé.</td></tr>`;
  s += `</tbody></table><div class="ruleform"><label class="fld">Source <select id="rSrc">${zones.map(z => `<option ${dr.src === z ? 'selected' : ''}>${z}</option>`).join('')}</select></label><label class="fld">Destination <select id="rDst">${zones.map(z => `<option ${dr.dst === z ? 'selected' : ''}>${z}</option>`).join('')}</select></label><label class="fld">Protocole <select id="rProto">${['tcp', 'udp', 'any'].map(z => `<option ${dr.proto === z ? 'selected' : ''}>${z}</option>`).join('')}</select></label><label class="fld">Port <input id="rPort" type="text" value="${esc(dr.port)}" inputmode="numeric" placeholder="443 ou any"></label></div><button class="btn primary" data-act="addrule">Ajouter la règle</button>`;
  s += `<p class="muted mono" id="nftprev">${esc(nftLine({ src: dr.src, dst: dr.dst, proto: dr.proto, port: dr.port === 'any' ? 'any' : +dr.port || dr.port }))}</p></article>`;
  s += `<article class="card"><h4>Protection</h4><label class="fld chk"><input type="checkbox" data-act="syn" ${S.fwopt.syn ? 'checked' : ''}> Limiter les SYN (contre le SYN flood)</label><button class="btn small" data-act="scrub" ${S.fwopt.scrub ? 'disabled' : ''}>${S.fwopt.scrub ? 'Filtrage opérateur actif' : "Demander le filtrage anti-DDoS à l'opérateur (600 $)"}</button>${S.fwopt.block.length ? `<p class="muted mono">Bloquées : ${S.fwopt.block.join(', ')}</p>` : ''}${blockForm()}</article>`;
  return s;
}

/* ----- Salle : énergie, froid, opérateurs ----- */
function sideRoom() {
  const P = S.power, cap = roomCooling();
  const pct = p => Math.round(((D.ups || {})[p] || 0) / (P.ups[p].kw * 10));
  let s = `<article class="card"><h4>Chaîne électrique</h4><p class="muted">EDF → TGBT → onduleurs A et B → gaines à barres des rangées → PDU des baies.</p>
<div class="kv"><span>Secteur EDF</span><b>${P.edf ? 'présent' : '<span class="bad">coupé</span>'}</b>
<span>Onduleur A</span><b>${live(() => P.ups.A.trip ? '<span class="bad">surcharge, coupé</span>' : !S.feeds.A ? '<span class="bad">en défaut</span>' : pct('A') + ' % de ' + P.ups.A.kw + ' kW')}</b>
<span>Onduleur B</span><b>${live(() => P.ups.B.trip ? '<span class="bad">surcharge, coupé</span>' : !S.feeds.B ? '<span class="bad">en défaut</span>' : pct('B') + ' % de ' + P.ups.B.kw + ' kW')}</b>
<span>Si une voie tombe</span><b>${live(() => { const t = ((D.ups || {}).A || 0) + ((D.ups || {}).B || 0); return Math.round(t / (P.ups.A.kw * 10)) + ' % sur l’onduleur restant'; })}</b>
<span>Batteries</span><b>${live(() => Math.round(S.power.batt) + ' / ' + S.power.battMax + ' min')}</b>
<span>Groupe électrogène</span><b>${P.gen ? (P.genRun ? 'en marche' : 'prêt') : 'absent'}</b></div>`;
  for (const p of ['A', 'B']) if (P.ups[p].trip) s += `<button class="btn primary" data-act="upsreset" data-p="${p}">Réarmer l'onduleur ${p}</button>`;
  s += `<h4>Rangées électrifiées</h4><div class="chips">${ROWS.map(r => S.power.rows[r] ? `<span class="chipc">${stDot('ok')} ${r}</span>` : `<button class="chipc" data-act="rowpower" data-row="${r}" ${unlocked('rowpower') ? '' : 'disabled'}>${stDot('off')} ${r} : électrifier (${money(ROOM_ITEMS.rowpower.cost)})</button>`).join('')}</div>`;
  s += upgRow('ups', 'pw', `data-op="ups"`, `${P.ups.A.kw} kW par voie`) + upgRow('battery', 'pw', `data-op="battery"`, `${P.battMax} min`) + upgRow('gen', 'pw', `data-op="gen"`, P.gen ? 'installé' : '', P.gen);
  s += `<p class="note"><button class="link" data-act="fiche" data-id="onduleur">Fiche : onduleurs, batteries et groupe</button></p></article>`;
  s += `<article class="card"><h4>Refroidissement</h4><div class="kv"><span>Froid disponible</span><b>${cap.total} kW (${S.cool.cracs.filter(c => c.ok).length} CRAC sur ${S.cool.cracs.length}${cap.inrow ? ', ' + cap.inrow + ' kW en rangée' : ''})</b><span>Chaleur des baies</span><b>${live(() => (D.itKW || 0).toFixed(2).replace('.', ',') + ' kW')}</b><span>Charge thermique</span><b>${live(() => Math.round((D.coolLoad || 0) * 100) + ' %')}</b><span>Redondance</span><b>${live(() => { const need = (D.itKW || 0) / CRAC_KW; const ok = S.cool.cracs.filter(c => c.ok).length; return ok - 1 >= Math.ceil(need) ? 'N+1 : une panne ne chauffe pas la salle' : 'aucune marge : une panne de CRAC fera chauffer la salle'; })}</b><span>PUE</span><b>${live(() => D.pue ? D.pue.toFixed(2).replace('.', ',') : '—')}</b></div>`;
  s += `<ul class="plist">${S.cool.cracs.map(c => `<li>${stDot(c.ok ? 'ok' : 'bad')} <b>CRAC-${c.slot + 1}</b> <span class="muted">${c.ok ? CRAC_KW + ' kW' : S.timers['crac' + c.slot] ? 'réparation en cours' : 'en panne'}</span>${!c.ok && !S.timers['crac' + c.slot] ? ` <button class="btn small primary" data-act="cracfix" data-slot="${c.slot}">Frigoriste (800 €)</button>` : ''}</li>`).join('')}</ul>`;
  s += `<p class="muted">Pour ajouter un CRAC, clique un emplacement « + CRAC » le long des murs. Pour un climatiseur en rangée, clique un emplacement libre d'une rangée.</p>`;
  s += `<h4>Allées froides</h4><div class="chips">${AISLES.filter(a => a.cold).map(a => S.cool.contain[a.id] ? `<span class="chipc">${stDot('ok')} ${a.id} confinée</span>` : `<button class="chipc" data-act="contain" data-id="${a.id}" ${unlocked('containment') ? '' : 'disabled'}>${a.id} : confiner (${money(ROOM_ITEMS.containment.cost)})</button>`).join('')}</div>`;
  s += `<p class="note"><button class="link" data-act="fiche" data-id="froid">Fiche : refroidissement et PUE</button></p></article>`;
  s += `<article class="card"><h4>Opérateurs</h4><div class="kv"><span>Opérateur 1</span><b>${S.flags.op1down ? '<span class="bad">coupé</span>' : 'fibre active sur OP1'}</b><span>Opérateur 2</span><b>${S.room.op2 ? (S.flags.op2down ? '<span class="bad">coupé</span>' : 'fibre active sur OP2') : 'non souscrit'}</b><span>Accès Internet</span><b>${live(() => D.inet.ok ? D.inet.ops + ' lien(s), ' + speedName(D.inet.cap) : 'aucun')}</b></div>${upgRow('op2', 'op2', '', S.room.op2 ? 'souscrit' : '', S.room.op2)}</article>`;
  return s;
}
function upgRow(key, act, attrs, info, done) {
  const it = ROOM_ITEMS[key];
  return `<div class="upg"><div><b>${esc(it.name)}</b> <span class="muted">${money(it.cost)}${info ? ' · ' + info : ''}</span><p class="muted">${esc(it.desc)}</p></div>${done ? pill('ok', 'Installé') : unlocked(it.unlock) ? `<button class="btn small" data-act="${act}" ${attrs}>Acheter</button>` : pill('off', 'Verrouillé')}</div>`;
}
function blockForm() {
  const ips = new Set();
  for (const t of S.tickets) if (t.ctx && t.ctx.ip && !S.fwopt.block.includes(t.ctx.ip) && (t.type === 'scan' || t.type === 'brute')) ips.add(t.ctx.ip);
  return [...ips].map(ip => `<button class="btn small" data-act="block" data-ip="${ip}">Bloquer ${ip}</button>`).join('');
}

/* ---------- Modales ---------- */
let modalClose = null;
function modal(title, html, mount, wide) {
  const m = $('#modal');
  m.innerHTML = `<div class="mbox ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="mtitle"><header><h2 id="mtitle">${esc(title)}</h2><button class="x" data-close aria-label="Fermer">×</button></header><div class="mbody">${html}</div></div>`;
  m.hidden = false;
  m.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
  if (mount) mount(m);
  const f = m.querySelector('.mbody button, .mbody input, .mbody select'); if (f) f.focus();
}
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; if (modalClose) { const f = modalClose; modalClose = null; f(); } }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

function openShop(focus) {
  const inRack = UI.mode === 'rack' && S.racks[UI.rack] && S.racks[UI.rack].kind === 'rack';
  let s = inRack ? `<p class="muted">Installation dans la baie <b>${rackName(UI.rack)}</b> : choisis un équipement, puis son emplacement (les unités libres s'allument en vert).</p><div class="shop">`
    : `<p class="warnbox">Ouvre d'abord une de tes baies : clique-la dans la salle. Le matériel s'installe dans la baie ouverte. Les baies, climatiseurs et onduleurs s'achètent depuis la salle et l'onglet Salle.</p><div class="shop">`;
  for (const k of SHOP_ORDER) {
    const c = CAT[k], ok = unlocked(c.unlock || (DEFAULT_UNLOCKED.includes(k) ? null : k));
    const locked = !ok;
    s += `<article class="item ${focus === k ? 'focus' : ''} ${locked ? 'locked' : ''}"><div class="ihead"><b>${esc(c.name)}</b><span>${money(c.cost)}</span></div><p class="muted">${c.u}U · ${c.psu ? c.psu + ' alim. · ' + c.w[0] + '–' + c.w[1] + ' W' : 'passif'}</p><p>${esc(c.desc)}</p>${locked ? `<p class="lock">Débloqué par un prochain contrat.</p>` : `<div class="qtyrow" data-item="${k}"><div class="qty" role="group" aria-label="Quantité"><button class="btn small" data-q="-1" aria-label="Une unité de moins" ${inRack ? '' : 'disabled'}>−</button><output>1</output><button class="btn small" data-q="1" aria-label="Une unité de plus" ${inRack ? '' : 'disabled'}>+</button></div><span class="qtot">${money(c.cost)}</span></div>
<div class="btnrow"><button class="btn primary" data-buy="${k}" ${S.money < c.cost || !inRack ? 'disabled' : ''}>Placer à la main</button><button class="btn" data-auto="${k}" ${S.money < c.cost || !inRack ? 'disabled' : ''} title="Installe dans les premières unités libres, du haut vers le bas">Installer d'office</button></div>`}</article>`;
  }
  s += `</div>`;
  modal('Catalogue', s, m => {
    const qtyOf = k => +m.querySelector(`.qtyrow[data-item="${k}"] output`).textContent;
    const freeSlots = k => { const h = CAT[k].u; let n = 0; const map = slotMap(UI.rack); for (let u = RACK_U - h + 1; u >= 1; u--) { let ok = true; for (let i = 0; i < h; i++) if (map[u + i]) ok = false; if (ok) { n++; for (let i = 0; i < h; i++) map[u + i] = 'x'; } } return n; };
    m.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
      const row = b.closest('.qtyrow'), k = row.dataset.item, c = CAT[k];
      const max = Math.max(1, Math.min(freeSlots(k), Math.floor(S.money / c.cost)));
      const q = clampN(qtyOf(k) + +b.dataset.q, 1, max);
      row.querySelector('output').textContent = q;
      row.querySelector('.qtot').textContent = q > 1 ? `${q} × ${money(c.cost)} = ${money(q * c.cost)}` : money(c.cost);
    }));
    m.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => { UI.place = { type: b.dataset.buy, left: qtyOf(b.dataset.buy) }; UI.from = null; closeModal(); renderAll(); }));
    m.querySelectorAll('[data-auto]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.auto, h = CAT[k].u; let n = qtyOf(k), done = 0;
      for (let u = RACK_U - h + 1; u >= 1 && done < n; u--) if (fits(k, UI.rack, u)) { const r = actPlace(k, UI.rack, u); if (typeof r === 'string') { toast(r, 'bad'); break; } done++; }
      closeModal(); derive(); renderAll();
      toast(done ? `${done} × ${CAT[k].name} installé${done > 1 ? 's' : ''} dans la baie ${rackName(UI.rack)}.` : "Plus d'unités libres dans cette baie.", done ? 'good' : 'bad');
    }));
    const f = m.querySelector('.focus'); if (f) f.scrollIntoView({ block: 'nearest' });
  }, true);
}
function openCableModal(a, b) {
  const da = dev(a.d), db = dev(b.d);
  const checks = Object.keys(CABLES).map(t => cableCheck(t, a, b));
  const best = checks.filter(x => x.ok).sort((x, y) => x.cost - y.cost)[0];
  const len = cableLen(a, b);
  let s = `<p><b>${esc(nameOf(da))} ${esc(a.p)}</b> ↔ <b>${esc(nameOf(db))} ${esc(b.p)}</b></p><p class="muted">Distance mesurée : ${fmtLen(len)} (${da.rack === db.rack ? 'dans la baie, par le guide-câbles latéral' : 'entre baies, par le chemin de câbles au-dessus'}), soit un cordon standard de ${fmtLen(stdLen(len))}.</p><fieldset class="cablelist"><legend>Type de câble</legend>`;
  for (const c of checks) {
    const ct = CABLES[c.type];
    s += `<label class="copt ${c.ok ? '' : 'no'}"><input type="radio" name="ctype" value="${c.type}" ${c.ok ? '' : 'disabled'} ${best && best.type === c.type ? 'checked' : ''}><i class="sw" style="background:${ct.color}"></i><span><b>${esc(ct.name)}</b>${c.ok ? ` · ${money(c.cost)}${c.mods.length ? ` (dont ${c.mods.length} module${c.mods.length > 1 ? 's' : ''} ${ct.module})` : ''}` : ''}<small>${c.ok ? `${ct.std} · ${speedName(c.speed)}` : esc(c.why)}</small></span></label>`;
  }
  s += `</fieldset><p class="note">Dans une baie, un DAC suffit entre cages SFP+. Entre baies éloignées, la fibre multimode OM4 avec des modules SR. Vers les opérateurs, de la monomode OS2 avec des modules LR.</p><div class="btnrow"><button class="btn primary" id="cgo" ${best ? '' : 'disabled'}>Poser le câble</button><button class="btn" data-close>Annuler</button></div>`;
  modal('Poser un câble', s, m => {
    m.querySelector('#cgo').addEventListener('click', () => {
      const t = m.querySelector('input[name=ctype]:checked'); if (!t) return;
      const r = act(() => actConnect(t.value, a, b));
      if (typeof r !== 'string') { UI.from = null; UI.sel = { t: 'cable', c: r.id }; closeModal(); renderAll(); }
    });
  });
}
function openDeploy(k, svcKey) {
  const s0 = SVC[svcKey], servers = devsOfKind('server');
  if (!servers.length) { toast("Installe d'abord un serveur dans une baie.", 'bad'); return; }
  const stos = d => [d, ...devsOfKind('nas')].filter(x => arrayInfo(x).valid);
  const ip0 = freeIp(s0.zone);
  let s = `<p class="muted">${esc(s0.soft)} · ${s0.vcpu} vCPU · ${s0.ram} Go de RAM · ${s0.disk} Go de disque · écoute ${s0.ports.map(p => p[0].toUpperCase() + ' ' + p[1]).join(', ')}</p>
<label class="fld">Hôte <select id="dHost">${servers.map(d => { const u = hostUsed(d); return `<option value="${d.id}">${esc(d.host)} · ${d.ram - u.ram} Go libres · ${u.vcpu}/${CAT[d.type].cores} vCPU</option>`; }).join('')}</select></label>
<label class="fld">Stockage <select id="dSto"></select></label>
<label class="fld">VLAN de la VM <select id="dVlan">${[10, 20, 99, 30].map(v => `<option value="${v}" ${v === s0.zone ? 'selected' : ''}>${v} · ${VLANS[v].name}${v === s0.zone ? ' (attendu par le contrat)' : ''}</option>`).join('')}</select></label>
<label class="fld">Adresse IP <span class="iprow"><input id="dIp" type="text" value="${ip0}" inputmode="decimal" autocomplete="off"><button class="btn small" id="dFree" type="button">IP libre</button></span></label>
<p id="dMsg" class="muted"></p><pre class="cli" id="dCli"></pre>
<div class="btnrow"><button class="btn primary" id="dGo">Créer la VM</button><button class="btn" data-close>Annuler</button></div>`;
  modal(`Déployer : ${s0.name}`, s, m => {
    const host = m.querySelector('#dHost'), sto = m.querySelector('#dSto'), vl = m.querySelector('#dVlan'), ip = m.querySelector('#dIp'), msg = m.querySelector('#dMsg'), cl = m.querySelector('#dCli');
    const fillSto = () => {
      const d = dev(host.value);
      sto.innerHTML = stos(d).map(x => { const A = arrayInfo(x); return `<option value="${x.id}">${x.id === d.id ? 'Disques locaux' : 'NFS sur ' + esc(x.host) + ' (VLAN 30)'} · ${RAID[x.raid].name} · ${(A.usable - storeUsed(x)).toFixed(2).replace('.', ',')} To libres</option>`; }).join('') || '<option value="">Aucune grappe configurée</option>';
      if (s0.nas) { const nas = [...sto.options].find(o => o.textContent.startsWith('NFS')); if (nas) sto.value = nas.value; }
    };
    const check = () => {
      const v = +vl.value, e = ipCheck(ip.value.trim(), v, null);
      msg.textContent = e ? e : `OK : ${ip.value.trim()}/24, passerelle ${VLANS[v].gw || 'aucune'}.`;
      msg.className = e ? 'bad' : 'good';
      const d = dev(host.value), st = dev(sto.value);
      cl.textContent = `qm create ${100 + S.seq.v + 1} --name ${svcKey}-xx --cores ${s0.vcpu} --memory ${s0.ram * 1024} --net0 virtio,bridge=vmbr0,tag=${v} --scsi0 ${st && d && st.id === d.id ? 'local-lvm' : 'nfs-' + (st ? st.host : '?')}:${s0.disk}`;
    };
    host.addEventListener('change', () => { fillSto(); check(); });
    sto.addEventListener('change', check);
    vl.addEventListener('change', () => { ip.value = freeIp(+vl.value); check(); });
    ip.addEventListener('input', check);
    m.querySelector('#dFree').addEventListener('click', () => { ip.value = freeIp(+vl.value); check(); });
    m.querySelector('#dGo').addEventListener('click', () => {
      const r = act(() => actDeploy(k, svcKey, host.value, +vl.value, ip.value.trim(), sto.value));
      if (typeof r !== 'string') { closeModal(); toast(`${r.name} déployée. Vérifie son diagnostic dans le contrat.`, 'good'); }
    });
    fillSto(); check();
  });
}
function openFiches(id) {
  const f0 = FICHE(id) || FICHES[0];
  const render = f => {
    const done = S.codex.quiz[f.id] || {};
    let s = `<div class="fiches"><nav class="flist">${FICHES.map(x => `<button data-f="${x.id}" class="${x.id === f.id ? 'on' : ''}">${esc(x.title)}${Object.keys(S.codex.quiz[x.id] || {}).length === x.quiz.length ? ' <i class="ck">✓</i>' : S.codex.seen[x.id] ? ' <i class="new">•</i>' : ''}</button>`).join('')}</nav><section class="fbody"><div class="eyebrow">Note du vault : ${esc(f.vault)}</div><h3>${esc(f.title)}</h3>${f.html}<p class="retenir"><b>À retenir.</b> ${esc(f.retenir)}</p><h4>Quiz</h4>`;
    f.quiz.forEach((q, i) => {
      const d = done[i];
      s += `<div class="q" data-q="${i}"><p><b>${i + 1}.</b> ${esc(q.q)}</p>${shuffleIdx(q.o.length, f.id + i).map(j => `<label class="qo ${d !== undefined ? (j === q.a ? 'right' : d === j ? 'wrong' : '') : ''}"><input type="radio" name="q${i}" value="${j}" ${d !== undefined ? 'disabled' : ''} ${d === j ? 'checked' : ''}> ${esc(q.o[j])}</label>`).join('')}${d !== undefined ? `<p class="qe ${d === q.a ? 'good' : 'bad'}">${d === q.a ? 'Exact.' : 'Pas tout à fait.'} ${esc(q.e)}</p>` : `<button class="btn small" data-qv="${i}">Valider</button>`}</div>`;
    });
    return s + `</section></div>`;
  };
  modal('Fiches de cours', render(f0), m => {
    const bind = f => {
      m.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { m.querySelector('.mbody').innerHTML = render(FICHE(b.dataset.f)); bind(FICHE(b.dataset.f)); }));
      m.querySelectorAll('[data-qv]').forEach(b => b.addEventListener('click', () => {
        const i = +b.dataset.qv, sel = m.querySelector(`input[name=q${i}]:checked`); if (!sel) return;
        const q = f.quiz[i], ans = +sel.value;
        S.codex.quiz[f.id] = S.codex.quiz[f.id] || {};
        S.codex.quiz[f.id][i] = ans;
        if (ans === q.a) { S.xp += 10; S.money += 60; toast('Bonne réponse : +10 XP, +60 $', 'good'); }
        S.codex.seen[f.id] = true;
        m.querySelector('.mbody').innerHTML = render(f); bind(f); renderTop();
      }));
    };
    bind(f0);
  }, true);
}
function shuffleIdx(n, seed) { const a = [...Array(n).keys()]; let h = hhash(String(seed)); for (let i = n - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function openReport(t) {
  const def = INCIDENTS[t.type], q = def.quiz(t.ctx);
  const block = (name, title, opts) => `<fieldset class="q"><legend><b>${title}</b></legend>${shuffleIdx(opts.length, t.id + name).map(j => `<label class="qo"><input type="radio" name="${name}" value="${j}"> ${esc(opts[j])}</label>`).join('')}</fieldset>`;
  const s = `<p class="muted">Ticket n° ${t.id} · ${esc(def.title)} · ouvert ${clock(t.det).stamp}, corrigé ${clock(t.fixedAt).stamp} (${Math.round(t.fixedAt - t.det)} min).</p>
${block('cause', 'Cause racine', q.cause)}${block('prev', 'Ce qui évite que ça se reproduise', q.prev)}
<div class="btnrow"><button class="btn primary" id="rGo">Clore le ticket</button></div><div id="rOut"></div>`;
  modal("Fiche d'incident", s, m => {
    m.querySelector('#rGo').addEventListener('click', () => {
      const c = m.querySelector('input[name=cause]:checked'), p = m.querySelector('input[name=prev]:checked');
      if (!c || !p) { toast('Réponds aux deux questions.', 'bad'); return; }
      const okC = +c.value === 0, okP = +p.value === 0;
      const fast = t.fixedAt - t.det < 60;
      const xp = 15 + (okC ? 15 : 0) + (okP ? 15 : 0) + (fast ? 10 : 0) - t.hints * 5;
      const cash = (okC ? 150 : 0) + (okP ? 150 : 0);
      S.xp += Math.max(5, xp); S.money += cash; t.closed = true;
      if (t.type === 'ransom' && S.vms.find(v => v.id === t.ctx.vm && v.isolated)) S.xp += 10;
      m.querySelector('#rOut').innerHTML = `<p class="${okC ? 'good' : 'bad'}">Cause : ${okC ? 'exact' : 'non, c’était : ' + esc(q.cause[0])}.</p><p class="${okP ? 'good' : 'bad'}">Prévention : ${okP ? 'exact' : 'la bonne pratique : ' + esc(q.prev[0])}.</p><p>+${Math.max(5, xp)} XP${cash ? `, +${money(cash)}` : ''}${fast ? ' (bonus de rapidité)' : ''}.</p><button class="btn" id="rFiche">Relire la fiche : ${esc(FICHE(def.fiche).title)}</button>`;
      m.querySelector('#rGo').disabled = true;
      m.querySelector('#rFiche').addEventListener('click', () => openFiches(def.fiche));
      logEvent(`Ticket n° ${t.id} clos et documenté.`, 'good');
      touch(); renderAll();
    });
  });
}
function openRecette(cs) {
  derive();
  const def = contractDef(cs.id), R = recetteTests(cs);
  modal(`Recette : ${def.client}`, `<p class="muted">Les tests partent de la place de l'utilisateur et remontent couche par couche. Si tout passe, le contrat est livré.</p><ol class="rtests" id="rt"></ol><div id="rq"></div><div class="btnrow" id="rb"></div>`, mm => {
    const ol = mm.querySelector('#rt');
    let i = 0;
    const step = () => {
      if ($('#modal').hidden) return;
      if (i < R.T.length) {
        const t = R.T[i++];
        const li = document.createElement('li'); li.className = t.ok ? 'ok' : 'ko';
        li.innerHTML = `<span class="who">${esc(t.who)}</span><code>$ ${esc(t.cmd)}</code><span class="res">${t.ok ? '✓' : '✗'} ${esc(t.out)}</span>`;
        ol.appendChild(li); li.scrollIntoView({ block: 'nearest' });
        setTimeout(step, 260);
        return;
      }
      if (!R.T.length) ol.innerHTML = '<li class="ko"><span class="res">Aucune VM déployée pour ce contrat : rien à tester.</span></li>';
      const qn = R.Q.filter(q => q.ok).length;
      mm.querySelector('#rq').innerHTML = `<h4>Recette qualité (${qn} / ${R.Q.length})</h4><ul class="plist">${R.Q.map(q => `<li>${stDot(q.ok ? 'ok' : 'warn')} ${esc(q.label)}</li>`).join('')}</ul><p class="note">La qualité ne bloque pas la livraison, mais chaque point rapporte 10 XP.</p>`;
      const rb = mm.querySelector('#rb');
      if (R.pass && cs.state === 'setup') {
        rb.innerHTML = `<button class="btn primary" id="rDeliver">Signer le procès-verbal et mettre en service</button>`;
        rb.querySelector('#rDeliver').addEventListener('click', () => {
          S.xp += 10 * qn;
          activateContract(cs);
          logEvent(`Recette de ${def.client} réussie (qualité ${qn}/${R.Q.length}).`, 'good');
          closeModal(); derive(); renderAll();
        });
      } else rb.innerHTML = `<p class="warnbox">${R.pass ? 'Ce contrat est déjà en service.' : 'Des tests échouent : corrige, puis relance la recette.'}</p><button class="btn" data-close>Fermer</button>`;
      rb.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
    };
    step();
  }, true);
}
function openHelp(first) {
  const s = `<p>Tu prends en charge une salle de datacenter vide : six rangées, l'électricité secourue et un climatiseur. Tu as ${money(ECO.start)}. Des clients signent des contrats : à toi d'installer les baies et le matériel, de câbler, configurer, tester et maintenir.</p>
<div class="two help"><div><h4>La salle</h4><ul><li>Marche avec les <b>flèches</b> ou <b>ZQSD</b>, ou clique sur le sol.</li><li>Clique un <b>emplacement libre</b> pour installer une baie, une <b>baie</b> pour l'ouvrir.</li><li>Les <b>climatiseurs</b> sont le long des murs, l'<b>électricité</b> dans le local à droite, les <b>opérateurs</b> en salle MMR à gauche.</li><li>Couches <b>Chaleur</b> et <b>Énergie</b> en haut à gauche.</li></ul></div>
<div><h4>Dans une baie</h4><ul><li><b>Face avant</b> : disques, voyants. <b>Face arrière</b> : ports, alimentations, PDU A (rouge) et B (bleu). Touche F.</li><li><b>Double-clique</b> un équipement pour ouvrir sa fenêtre de configuration, que tu peux déplacer et garder ouverte à côté d'autres.</li><li>Clique un <b>port libre</b> puis un second, dans la même baie ou une autre, pour poser un câble.</li><li>Chaque contrat se livre par une <b>recette</b> : une série de tests réels.</li><li>Les pannes arrivent en tickets : définir, collecter (console), corriger, documenter.</li></ul></div></div>
<p class="note">Raccourcis : Échap annule ou revient à la salle, F bascule face avant / arrière, Espace met en pause.</p>
<div class="btnrow">${first ? '<button class="btn primary" id="hGo">Signer le premier contrat : Le Fournil</button>' : ''}<button class="btn" id="hFiche">Ouvrir les fiches</button><button class="btn" data-close>Fermer</button>${first ? '' : '<button class="btn danger" id="hReset">Nouvelle partie</button>'}</div>`;
  modal(first ? 'Bienvenue dans la salle 01' : 'Aide', s, m => {
    const go = m.querySelector('#hGo'); if (go) go.addEventListener('click', () => { actAccept('c1'); UI.tab = 'contracts'; closeModal(); derive(); renderAll(); });
    m.querySelector('#hFiche').addEventListener('click', () => openFiches('baie'));
    const rs = m.querySelector('#hReset');
    if (rs) { let armed = false; rs.addEventListener('click', () => { if (!armed) { armed = true; rs.textContent = 'Confirmer : tout effacer ?'; return; } newState(); UI.sel = null; UI.vb = null; UI.rvb = null; UI.mode = 'room'; UI.rack = null; UI.av = { x: 1.4, y: 15.6, a: -Math.PI / 2 }; closeModal(); derive(); renderAll(); openHelp(true); }); }
  }, true);
}

/* ---------- Console ---------- */
const CONS = { tg: null, hist: {} };
const tgKey = tg => tg.vm ? 'vm:' + tg.vm : 'd:' + tg.d;
function openConsole(tg, cmd) {
  CONS.tg = tg;
  $('#console').hidden = false;
  renderConsole();
  if (cmd) consoleRun(cmd);
  $('#cin').focus();
}
function renderConsole() {
  const tg = CONS.tg; if (!tg) return;
  const opts = [];
  for (const d of Object.values(S.devs)) if (['switch', 'router', 'fw', 'server', 'nas'].includes(kindOf(d))) opts.push(`<option value="d:${d.id}" ${tg.d === d.id ? 'selected' : ''}>${esc(d.host)}</option>`);
  for (const v of S.vms) opts.push(`<option value="vm:${v.id}" ${tg.vm === v.id ? 'selected' : ''}>VM ${esc(v.name)}</option>`);
  $('#ctg').innerHTML = opts.join('');
  $('#cprompt').textContent = promptOf(tg);
  $('#cchips').innerHTML = cmdList(tg).filter(x => x.chip).map(x => `<button class="chip" data-cmd="${esc(x.c)}" title="${esc(x.hint || '')}">${esc(x.c)}</button>`).join('');
  const out = $('#cout');
  out.textContent = (CONS.hist[tgKey(tg)] || [`Connecté à ${tg.vm ? (S.vms.find(v => v.id === tg.vm) || {}).name : dev(tg.d).host}. Tape « help » ou clique une commande.`]).join('\n');
  out.scrollTop = out.scrollHeight;
}
function consoleRun(cmd) {
  const tg = CONS.tg, k = tgKey(tg);
  const res = runCommand(tg, cmd);
  CONS.hist[k] = (CONS.hist[k] || []).concat([`${promptOf(tg)} ${cmd}`, res, '']).slice(-400);
  // une panne silencieuse se découvre en lançant la bonne commande au bon endroit
  const full = matchCommand(tg, cmd) || cmd;
  for (const t of S.tickets) {
    if (t.det || t.closed) continue;
    const def = INCIDENTS[t.type], x = t.ctx;
    const vmT = def.vmTarget && def.vmTarget(x), dT = vmT ? null : (def.target ? def.target(x) : x.d);
    if (def.cmd(x) === full && ((vmT && tg.vm === vmT) || (dT && tg.d === dT))) { detectTicket(t, 'toi, en console'); S.xp += 10; toast('Bien vu : tu as trouvé une panne silencieuse (+10 XP).', 'good'); renderAll(); }
  }
  const out = $('#cout'); out.textContent = CONS.hist[k].join('\n'); out.scrollTop = out.scrollHeight;
}
function onCli(d, lines) {
  if (!d) return;
  if (CONS.tg && CONS.tg.d === d.id && !$('#console').hidden) {
    const k = tgKey(CONS.tg);
    CONS.hist[k] = (CONS.hist[k] || []).concat(['! configuration appliquée depuis l’interface :', ...lines.map(l => (d && ['switch', 'router'].includes(kindOf(d)) ? `${d.host}(config)# ` : '# ') + l), '']);
    renderConsole();
  }
}
$('#cform').addEventListener('submit', e => { e.preventDefault(); const v = $('#cin').value; if (!v.trim()) return; consoleRun(v); $('#cin').value = ''; });
$('#cchips').addEventListener('click', e => { const b = e.target.closest('[data-cmd]'); if (b) consoleRun(b.dataset.cmd); });
$('#ctg').addEventListener('change', e => { const [t, id] = e.target.value.split(':'); CONS.tg = t === 'vm' ? { vm: id } : { d: id }; renderConsole(); });
$('#cclose').addEventListener('click', () => { $('#console').hidden = true; });

/* ---------- Événements du jeu ---------- */
function onTicket(t) { toast(`Ticket n° ${t.id} : ${INCIDENTS[t.type].title}`, 'bad', () => { UI.tab = 'tickets'; UI.openTicket = t.id; renderAll(); }); }
function onTicketFixed(t) { toast(`Ticket n° ${t.id} corrigé : rédige le rapport`, 'good', () => { UI.tab = 'tickets'; renderAll(); openReport(t); }); }
function onFiche(f) { toast(`Nouvelle notion : ${f.title} (ouvrir la fiche)`, 'info', () => openFiches(f.id)); }
const _onContract = onContractActive;
onContractActive = function (cs, def) { _onContract(cs, def); toast(`Contrat ${def.client} en service : +${money(def.bonus)}`, 'gold'); if (def.final) setTimeout(() => modal('Architecte datacenter', `<p>Le contrat de l'hébergeur régional tourne avec deux opérateurs et des services répartis. Tu as monté une salle complète, du câble au service.</p><p>Les contrats continuent d'arriver. Continue à optimiser : PUE, redondance, sécurité.</p><div class="btnrow"><button class="btn primary" data-close>Continuer</button></div>`), 600); };

/* ---------- Sélection et clics ---------- */
/* ---------- Navigation salle / baie ---------- */
function openRack(r) {
  if (!S.racks[r] || S.racks[r].kind === 'inrow') return;
  if (UI.mode !== 'rack' || UI.rack !== r) { UI.vb = null; UI.place = null; }
  UI.mode = 'rack'; UI.rack = r; UI.path = null; UI.arrive = null;
  if (!UI.sel || !UI.sel.d || dev(UI.sel.d) && dev(UI.sel.d).rack !== r) UI.sel = null;
  const fp = frontPoint(r); UI.av.x = fp.x; UI.av.y = fp.y;
  renderAll();
}
function backToRoom() { UI.mode = 'room'; UI.place = null; if (UI.sel && UI.sel.t !== 'rack') UI.sel = UI.rack != null ? { t: 'rack', r: UI.rack } : null; renderAll(); }
function rackNeighbors(r) {
  const k = S.racks[r];
  if (k.row === 'MMR') return { prev: -1, next: -1 };
  let prev = -1, next = -1;
  for (let p = k.pos - 1; p >= 1 && prev < 0; p--) { const i = rackAt(k.row, p); if (i >= 0 && S.racks[i].kind === 'rack') prev = i; }
  for (let p = k.pos + 1; p <= NPOS && next < 0; p++) { const i = rackAt(k.row, p); if (i >= 0 && S.racks[i].kind === 'rack') next = i; }
  return { prev, next };
}
const getVB = () => UI.mode === 'room' ? UI.rvb : UI.vb;
function svgPoint(e) { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return { x: q.x / MU, y: q.y / MU }; }
function select(sel) {
  UI.sel = sel; UI.tab = 'equip';
  if (sel && sel.t !== 'pdu' && sel.t !== 'empty' && sel.t !== 'vm' && sel.d) {
    const d = dev(sel.d);
    if (d && (UI.mode !== 'rack' || UI.rack !== d.rack)) { openRack(d.rack); UI.sel = sel; }
    if (d && UI.vb) {
      const o = devOrigin(d);
      if (o.x < UI.vb.x || o.x + W19 > UI.vb.x + UI.vb.w || o.y < UI.vb.y || o.y > UI.vb.y + UI.vb.h) { UI.vb.x = o.x + W19 / 2 - UI.vb.w / 2; UI.vb.y = o.y - UI.vb.h / 2; }
    }
  }
  renderAll();
}
let pan = null, panMoved = false;
svg.addEventListener('pointerdown', e => {
  panMoved = false;
  const el = e.target.closest('[data-k]');
  if (e.button === 1 || !el || el.dataset.k === 'empty' || el.dataset.k === 'aisle') { pan = { x: e.clientX, y: e.clientY, vb: { ...getVB() } }; svg.setPointerCapture(e.pointerId); }
});
svg.addEventListener('pointermove', e => {
  if (!pan) return;
  const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) panMoved = true;
  if (!panMoved) return;
  const v = getVB(), sc = v.w / svg.clientWidth;
  v.x = pan.vb.x - dx * sc; v.y = pan.vb.y - dy * sc; applyVB(svg);
  svg.classList.add('panning');
});
svg.addEventListener('pointerup', () => { pan = null; svg.classList.remove('panning'); });
svg.addEventListener('wheel', e => {
  e.preventDefault();
  const r = svg.getBoundingClientRect(), f = Math.exp(e.deltaY * 0.0012);
  zoomAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, f);
}, { passive: false });
function zoomAt(fx, fy, f) {
  const v = getVB(); if (!v) return;
  const nw = clampN(v.w * f, 140, 4000), nh = nw * v.h / v.w;
  v.x += (v.w - nw) * fx; v.y += (v.h - nh) * fy; v.w = nw; v.h = nh; applyVB(svg);
}
function roomClick(e, el) {
  const pt = svgPoint(e);
  if (!el) { walkTo(pt); renderView(svg); return; }
  const k = el.dataset.k, ds = el.dataset;
  if (k === 'aisle') { walkTo(pt); UI.sel = { t: 'aisle', id: ds.id }; renderView(svg); if (UI.tab === 'equip') renderSide(); return; }
  if (k === 'rk') {
    const r = +ds.r, fp = frontPoint(r);
    UI.sel = { t: 'rack', r }; UI.tab = 'equip';
    if (Math.hypot(UI.av.x - fp.x, UI.av.y - fp.y) < 1.3) openRack(r);
    else { walkTo(fp, () => openRack(r)); renderAll(); }
    return;
  }
  if (k === 'inrow') { const r = +ds.r; walkTo(frontPoint(r)); select({ t: 'rack', r }); return; }
  if (k === 'eslot') { const row = ds.row, pos = +ds.pos; walkTo(frontOf(row, pos)); select({ t: 'slot', row, pos }); return; }
  if (k === 'crac' || k === 'cracslot') { const slot = +ds.slot, p = CRAC_SLOTS[slot]; walkTo({ x: p.x + CRAC_W / 2, y: p.y < 8 ? p.y + CRAC_H + 0.4 : p.y - 0.4 }); select({ t: k, slot }); return; }
  if (k === 'infra') { const b = INFRA[ds.id]; walkTo({ x: b.x - 0.4, y: b.y + b.h / 2 }); select({ t: 'infra', id: ds.id }); return; }
}
/* ---------- Fenêtres de configuration (double-clic) ---------- */
const WINS = [];
let winZ = 50, winSeq = 0;
function openWin(spec) {
  const key = spec.d ? 'd:' + spec.d : spec.infra ? 'i:' + spec.infra : 'c:' + spec.crac;
  let w = WINS.find(x => x.key === key);
  if (!w) {
    const n = WINS.length, box = $('#view').getBoundingClientRect();
    w = { key, spec, id: 'win' + (++winSeq), view: spec.d ? (spec.p ? { t: 'port', d: spec.d, p: spec.p } : { t: 'dev', d: spec.d }) : null,
      x: Math.max(8, Math.min(box.left + 60 + n * 34, window.innerWidth - 440)), y: Math.max(70, box.top + 50 + n * 30), z: ++winZ };
    WINS.push(w);
    if (WINS.length > 4) WINS.shift();
  } else { w.z = ++winZ; if (spec.p) w.view = { t: 'port', d: spec.d, p: spec.p }; }
  renderWins(true);
  const el = document.getElementById(w.id); if (el) el.querySelector('.x').focus();
}
function closeWin(id) { const i = WINS.findIndex(w => w.id === id); if (i >= 0) { clearLive(id); WINS.splice(i, 1); } renderWins(true); }
function winTitle(w) {
  if (w.spec.infra) return [INFRA[w.spec.infra].label, 'Local électrique'];
  if (w.spec.crac !== undefined) return ['CRAC-' + (w.spec.crac + 1), 'Climatisation de salle'];
  const d = dev(w.spec.d);
  return [nameOf(d), `${CAT[d.type].name} · ${S.racks[d.rack].row === 'MMR' ? 'salle MMR' : 'baie ' + rackName(d.rack)}, U${d.u}`];
}
function winBody(w) {
  if (w.spec.infra) return equipInfra(w.spec.infra);
  if (w.spec.crac !== undefined) return equipCrac(w.spec.crac);
  const v = w.view, d = v.d ? dev(v.d) : null;
  if (v.t === 'port' && d) return equipPort(d, v.p);
  if (v.t === 'disk' && d) return equipDisk(d, v.bay);
  if (v.t === 'psu' && d) return equipPsu(d, v.i);
  if (v.t === 'cable') { const c = S.cables.find(x => x.id === v.c); if (c) return crumb(dev(w.spec.d), 'câble') + equipCable(c); }
  if (v.t === 'vm') { const vm = S.vms.find(x => x.id === v.id); if (vm) return equipVm(vm); }
  return equipDev(dev(w.spec.d));
}
function renderWins(force) {
  const box = $('#windows');
  for (const w of [...WINS]) if (w.spec.d && !dev(w.spec.d)) { clearLive(w.id); WINS.splice(WINS.indexOf(w), 1); }
  box.querySelectorAll('.win').forEach(el => { if (!WINS.some(w => w.id === el.id)) el.remove(); });
  const ae = document.activeElement;
  for (const w of WINS) {
    let el = document.getElementById(w.id);
    if (!el) {
      el = document.createElement('section');
      el.className = 'win'; el.id = w.id; el.setAttribute('role', 'dialog');
      el.innerHTML = `<header><div class="wt"><b></b><span class="muted"></span></div>${w.spec.d ? '<button class="btn small" data-wcons>Console</button>' : ''}<button class="x" aria-label="Fermer la fenêtre">×</button></header><div class="wbody" data-win="${w.id}"></div>`;
      el.querySelector('.x').addEventListener('click', () => closeWin(w.id));
      const cb = el.querySelector('[data-wcons]'); if (cb) cb.addEventListener('click', () => openConsole({ d: w.spec.d }));
      el.addEventListener('pointerdown', () => { if (w.z !== winZ) { w.z = ++winZ; el.style.zIndex = w.z; } });
      dragWin(el, w);
      box.appendChild(el);
    }
    el.style.left = w.x + 'px'; el.style.top = w.y + 'px'; el.style.zIndex = w.z;
    const [t, sub] = winTitle(w);
    el.querySelector('.wt b').textContent = t; el.querySelector('.wt .muted').textContent = sub;
    el.setAttribute('aria-label', 'Configuration de ' + t);
    const body = el.querySelector('.wbody');
    if (!force && body.contains(ae) && /INPUT|SELECT|TEXTAREA/.test(ae.tagName)) continue;
    const sc = body.scrollTop;
    clearLive(w.id); LIVEP = w.id;
    body.innerHTML = winBody(w);
    LIVEP = 's';
    body.scrollTop = sc;
  }
}
function dragWin(el, w) {
  const h = el.querySelector('header');
  let st = null;
  h.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; st = { x: e.clientX, y: e.clientY, wx: w.x, wy: w.y }; h.setPointerCapture(e.pointerId); });
  h.addEventListener('pointermove', e => {
    if (!st) return;
    w.x = clampN(st.wx + e.clientX - st.x, -el.offsetWidth + 80, window.innerWidth - 80);
    w.y = clampN(st.wy + e.clientY - st.y, 0, window.innerHeight - 40);
    el.style.left = w.x + 'px'; el.style.top = w.y + 'px';
  });
  h.addEventListener('pointerup', () => { st = null; });
}
// double-clic détecté à la main : le premier clic redessine la baie
let lastHit = null;
function isDouble(key) {
  const now = performance.now(), dbl = !!(lastHit && lastHit.key === key && now - lastHit.t < 450);
  lastHit = dbl ? null : { key, t: now };
  return dbl;
}

svg.addEventListener('click', e => {
  if (panMoved) { panMoved = false; return; }
  if (UI.mode === 'room') {
    const rel = e.target.closest('[data-k]');
    if (rel && (rel.dataset.k === 'crac' || rel.dataset.k === 'infra') && isDouble(rel.dataset.k + (rel.dataset.slot || rel.dataset.id))) { openWin(rel.dataset.k === 'crac' ? { crac: +rel.dataset.slot } : { infra: rel.dataset.id }); return; }
    roomClick(e, rel); return;
  }
  const el = e.target.closest('[data-k]');
  if (!el) { lastHit = null; if (UI.from) { UI.from = null; renderAll(); } return; }
  const k = el.dataset.k, ds = el.dataset;
  if (ds.d && !UI.place && isDouble('d' + ds.d)) {
    if (k === 'port' && UI.from && UI.from.d === ds.d) UI.from = null;
    openWin(k === 'port' ? { d: ds.d, p: ds.p } : { d: ds.d });
    renderAll(); return;
  }
  if (k === 'slot') {
    const r = +ds.r, u = +ds.u;
    if (UI.place.move) act(() => actMove(UI.place.move, r, u));
    else {
      const res = act(() => actPlace(UI.place.type, r, u));
      if (typeof res !== 'string') {
        UI.place.left = (UI.place.left || 1) - 1;
        if (UI.place.left > 0 && S.money >= CAT[UI.place.type].cost) { renderAll(); return; }
        UI.place = null; select({ t: 'dev', d: res.id }); return;
      }
    }
    UI.place = null; renderAll(); return;
  }
  if (UI.place) return;
  if (k === 'port') {
    const d = dev(ds.d), p = portDef(d, ds.p), cab = portCable(d.id, ds.p);
    if (UI.from) {
      if (UI.from.d === ds.d && UI.from.p === ds.p) { UI.from = null; renderAll(); return; }
      if (!cab && kindOf(d) !== 'rogue') { openCableModal(UI.from, { d: ds.d, p: ds.p }); return; }
      UI.from = null;
    } else if (!cab && kindOf(d) !== 'rogue' && !p.op) UI.from = { d: ds.d, p: ds.p };
    select({ t: 'port', d: ds.d, p: ds.p }); return;
  }
  UI.from = null;
  if (k === 'cable') select({ t: 'cable', c: ds.c });
  else if (k === 'psu') select({ t: 'psu', d: ds.d, i: +ds.i });
  else if (k === 'pdu') select({ t: 'pdu', r: +ds.r, p: ds.p });
  else if (k === 'disk') select({ t: 'disk', d: ds.d, bay: +ds.bay });
  else if (k === 'dev') select({ t: 'dev', d: ds.d });
  else if (k === 'empty') select({ t: 'empty', r: +ds.r, u: +ds.u });
});

/* ---------- Actions du panneau ---------- */
function panelClick(e) {
  const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT' || (b.tagName === 'INPUT' && b.type !== 'button')) return;
  const a = b.dataset.act, id = b.dataset.id;
  // dans une fenêtre, la navigation reste dans la fenêtre
  const wb = b.closest('.wbody');
  if (wb) {
    const w = WINS.find(x => x.id === wb.dataset.win);
    const nav = { selvm: () => ({ t: 'vm', id }), seldev: () => ({ t: 'dev', d: id }), selport: () => ({ t: 'port', d: id, p: b.dataset.p }), selcable: () => ({ t: 'cable', c: id }), seldisk: () => ({ t: 'disk', d: id, bay: +b.dataset.bay }) }[a];
    if (w && nav) {
      const v = nav();
      if (v.d && w.spec.d && v.d !== w.spec.d) openWin({ d: v.d, p: v.p });
      else { w.view = v; renderWins(true); }
      return;
    }
  }
  switch (a) {
    case 'accept': actAccept(id); derive(); renderAll(); break;
    case 'deploy': openDeploy(id, b.dataset.svc); break;
    case 'selvm': select({ t: 'vm', id }); break;
    case 'seldev': select({ t: 'dev', d: id }); break;
    case 'selport': select({ t: 'port', d: id, p: b.dataset.p }); break;
    case 'selcable': select({ t: 'cable', c: id }); break;
    case 'seldisk': UI.face = 'front'; select({ t: 'disk', d: id, bay: +b.dataset.bay }); break;
    case 'prefill': { const f = JSON.parse(b.dataset.f); UI.ruleDraft = { src: f[0], dst: f[1], proto: f[2], port: String(f[3]) }; UI.tab = 'network'; renderAll(); break; }
    case 'tuto': tutoSteps()[+b.dataset.i].go(); renderAll(); break;
    case 'console': openConsole({ d: id }); break;
    case 'vmcons': openConsole({ vm: id }); break;
    case 'move': UI.place = { type: dev(id).type, move: id }; renderAll(); break;
    case 'power': act(() => actPowerToggle(dev(id))); break;
    case 'remove': {
      if (b.dataset.armed) { act(() => actRemove(id)); UI.sel = null; renderAll(); }
      else { b.dataset.armed = '1'; b.textContent = 'Confirmer le retrait'; }
      break;
    }
    case 'plug': act(() => actPlug(dev(id), +b.dataset.i, b.dataset.p)); break;
    case 'unplug': act(() => actUnplug(dev(id), +b.dataset.i)); break;
    case 'psurep': act(() => actReplacePSU(dev(id), +b.dataset.i)); break;
    case 'reset': act(() => actResetBreaker(+b.dataset.r, b.dataset.p)); break;
    case 'ram': act(() => actRam(dev(id))); break;
    case 'mod': act(() => actModule(dev(id), b.dataset.p, b.dataset.m || null)); break;
    case 'modrep': act(() => actReplaceModule(dev(id), b.dataset.p)); break;
    case 'cablerep': act(() => actReplaceCable(id)); break;
    case 'unplugc': act(() => actDisconnect(id)); UI.sel = null; renderAll(); break;
    case 'adddisk': act(() => actAddDisk(dev(id), +b.dataset.bay, b.dataset.t)); break;
    case 'repdisk': act(() => actReplaceDisk(dev(id), +b.dataset.bay)); break;
    case 'rmdisk': act(() => actRemoveDisk(dev(id), +b.dataset.bay)); break;
    case 'vm': {
      const op = b.dataset.op;
      if ((op === 'delete' || op === 'reinstall') && !b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Confirmer'; break; }
      act(() => actVm(id, op)); if (op === 'delete') { UI.sel = null; renderAll(); }
      break;
    }
    case 'quick': { const r = act(() => actPlace(b.dataset.t, +b.dataset.r, +b.dataset.u)); if (typeof r !== 'string') { UI.sel = null; renderAll(); } break; }
    case 'blankall': {
      const r = +b.dataset.r, m = slotMap(r); let n = 0;
      for (let u = 1; u <= RACK_U; u++) if (!m[u] && S.money >= 15) { actPlace('blank', r, u); n++; }
      toast(`${n} obturateur(s) posé(s).`, 'good'); UI.sel = null; derive(); renderAll(); break;
    }
    case 'shop': openShop(); break;
    case 'tab': UI.tab = b.dataset.tab; renderAll(); break;
    case 'fiche': openFiches(id); break;
    case 'tkopen': UI.openTicket = UI.openTicket === +id ? null : +id; renderSide(); break;
    case 'hint': { const t = S.tickets.find(x => x.id === +id); t.hints++; S.xp = Math.max(0, S.xp - 5); renderAll(); break; }
    case 'report': openReport(S.tickets.find(x => x.id === +id)); break;
    case 'runcmd': openConsole(b.dataset.vm ? { vm: b.dataset.vm } : { d: b.dataset.dev }, b.dataset.cmd); break;
    case 'addrule': {
      const port = $('#rPort').value.trim().toLowerCase();
      const r = { src: $('#rSrc').value, dst: $('#rDst').value, proto: $('#rProto').value, port: port === 'any' || port === '' ? 'any' : +port };
      if (r.port !== 'any' && !(r.port >= 1 && r.port <= 65535)) { toast('Port invalide : un nombre de 1 à 65535, ou « any ».', 'bad'); break; }
      UI.ruleDraft = { src: r.src, dst: r.dst, proto: r.proto, port: String(r.port) };
      const res = act(() => actAddRule(r)); if (!res) { const risk = ruleRisk(r); toast(risk ? 'Règle ajoutée, mais : ' + risk : 'Règle ajoutée.', risk ? 'bad' : 'good'); }
      break;
    }
    case 'delrule': act(() => actDelRule(+b.dataset.i)); break;
    case 'scrub': act(() => actFw('scrub')); break;
    case 'block': act(() => actFw('block', b.dataset.ip)); break;
    case 'recette': openRecette(S.contracts.find(c => c.id === id)); break;
    case 'openrack': openRack(+b.dataset.r); break;
    case 'rackbuy': {
      const r = act(() => actInstallRack(b.dataset.row, +b.dataset.pos, b.dataset.kind));
      if (typeof r === 'number') { if (b.dataset.kind === 'rack') { toast(`Baie ${rackName(r)} installée. Ouvre-la pour y poser du matériel.`, 'good', () => openRack(r)); UI.sel = { t: 'rack', r }; } else UI.sel = { t: 'rack', r }; renderAll(); }
      break;
    }
    case 'rowpower': act(() => actRowPower(b.dataset.row)); break;
    case 'pw': act(() => actPower(b.dataset.op)); break;
    case 'upsreset': act(() => actPower('reset', b.dataset.p)); break;
    case 'cracbuy': act(() => actCrac(+b.dataset.slot)); UI.sel = { t: 'crac', slot: +b.dataset.slot }; renderAll(); break;
    case 'cracfix': act(() => actRepairCrac(+b.dataset.slot)); break;
    case 'contain': act(() => actContain(id)); break;
    case 'op2': act(() => actOp2()); break;
    case 'win': openWin({ d: id }); break;
  }
}
$('#sidebody').addEventListener('click', panelClick);
$('#windows').addEventListener('click', panelClick);
function panelChange(e) {
  const b = e.target.closest('[data-act]');
  if (!b && ['rSrc', 'rDst', 'rProto'].includes(e.target.id)) { UI.ruleDraft = { src: $('#rSrc').value, dst: $('#rDst').value, proto: $('#rProto').value, port: $('#rPort').value }; const p = UI.ruleDraft.port; $('#nftprev').textContent = nftLine({ ...UI.ruleDraft, port: p === 'any' ? 'any' : +p || p }); return; }
  if (!b) return;
  const a = b.dataset.act, d = b.dataset.id ? dev(b.dataset.id) : null;
  const done = () => { b.blur(); derive(); renderAll(); };
  if (a === 'pcfg') {
    const f = b.dataset.f; let v = b.type === 'checkbox' ? b.checked : b.value;
    if (f === 'vlan' || f === 'native') v = +v;
    const patch = { [f]: v };
    if (f === 'mode' && v === 'trunk' && !cfg(d, b.dataset.p).allowed.length) { patch.allowed = [10, 20, 99]; patch.native = 999; }
    actPortCfg(d, b.dataset.p, patch); done();
  } else if (a === 'pallow') {
    const c = cfg(d, b.dataset.p), v = +b.dataset.v;
    const allowed = b.checked ? [...new Set([...c.allowed, v])].sort((x, y) => x - y) : c.allowed.filter(x => x !== v);
    actPortCfg(d, b.dataset.p, { allowed }); done();
  } else if (a === 'pdesc') { actPortCfg(d, b.dataset.p, { desc: b.value.trim() }); done(); }
  else if (a === 'raid') { const r = actSetRaid(d, b.value); if (r) toast(r, 'bad'); done(); }
  else if (a === 'cableto') { if (!b.value) return; const [dd, pp] = b.value.split('|'); b.blur(); openCableModal({ d: d.id, p: b.dataset.p }, { d: dd, p: pp }); }
  else if (a === 'vmtog') { actVm(b.dataset.id, b.dataset.op); done(); }
  else if (a === 'syn') { actFw('syn'); done(); }
}
$('#sidebody').addEventListener('change', panelChange);
$('#windows').addEventListener('change', panelChange);
$('#windows').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('tr[data-act]')) e.target.click(); });
$('#sidebody').addEventListener('input', e => {
  if (e.target.id === 'rPort') { const p = e.target.value; UI.ruleDraft.port = p; $('#nftprev').textContent = nftLine({ src: $('#rSrc').value, dst: $('#rDst').value, proto: $('#rProto').value, port: p === 'any' ? 'any' : +p || p }); }
});
$('#sidebody').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('tr[data-act]')) e.target.click(); });
document.querySelectorAll('#tabs [role=tab]').forEach(t => t.addEventListener('click', () => { UI.tab = t.dataset.tab; renderSide(); }));
document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => { S.speed = +b.dataset.speed; renderTop(); }));
$('#faceFront').addEventListener('click', () => { UI.face = 'front'; renderAll(); });
$('#faceRear').addEventListener('click', () => { UI.face = 'rear'; renderAll(); });
$('#zin').addEventListener('click', () => zoomAt(0.5, 0.5, 0.8));
$('#zout').addEventListener('click', () => zoomAt(0.5, 0.5, 1.25));
$('#zfit').addEventListener('click', () => {
  if (UI.mode === 'room') { fitRoom(svg); applyVB(svg); return; }
  UI.fitAll = !UI.fitAll; fitView(svg, UI.fitAll ? 'all' : 'detail'); applyVB(svg);
});
$('#backRoom').addEventListener('click', backToRoom);
$('#rPrev').addEventListener('click', () => { const n = rackNeighbors(UI.rack).prev; if (n >= 0) openRack(n); });
$('#rNext').addEventListener('click', () => { const n = rackNeighbors(UI.rack).next; if (n >= 0) openRack(n); });
document.querySelectorAll('[data-layer]').forEach(b => b.addEventListener('click', () => { UI.layer = b.dataset.layer; renderAll(); }));
const KEYS = new Set();
window.addEventListener('keyup', e => KEYS.delete(e.code));
window.addEventListener('blur', () => KEYS.clear());
$('#btnShop').addEventListener('click', () => openShop());
$('#btnFiches').addEventListener('click', () => openFiches(UI.sel && UI.sel.t === 'disk' ? 'raid' : 'baie'));
$('#btnHelp').addEventListener('click', () => openHelp(false));
window.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select')) { if (e.key === 'Escape') e.target.blur(); return; }
  if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else if (WINS.length && e.target.closest('.win')) closeWin(e.target.closest('.win').id); else if (UI.place || UI.from) { UI.place = null; UI.from = null; renderAll(); } else if (!$('#console').hidden) $('#console').hidden = true; else if (UI.mode === 'rack') backToRoom(); else { UI.sel = null; UI.path = null; renderAll(); } }
  else if (!$('#modal').hidden) return;
  else if (UI.mode === 'room' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) { e.preventDefault(); KEYS.add(e.code); }
  else if ((e.key === 'f' || e.key === 'F') && UI.mode === 'rack') { UI.face = UI.face === 'front' ? 'rear' : 'front'; renderAll(); }
  else if (e.key === ' ') { e.preventDefault(); S.speed = S.speed ? 0 : 1; renderTop(); }
  else if (e.key === '+') zoomAt(0.5, 0.5, 0.8);
  else if (e.key === '-') zoomAt(0.5, 0.5, 1.25);
});

/* ---------- Rendu global, sauvegarde, boucle ---------- */
function renderAll() { renderView(svg); renderTop(); renderSide(); renderWins(); if (!$('#console').hidden) renderConsole(); }
const SAVE_KEY = 'hyperscale-dc-v3';
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
function load(o) {
  if (!o || o.v !== 3 || !o.devs || !o.power) return false;
  S = o;
  S.cli = S.cli || []; S.timers = S.timers || {}; S.flags = S.flags || {}; S.teach = S.teach || [];
  return true;
}
let last = 0, acc = 0, viewT = 0, sideT = 0, liveT = 0, saveT = 0;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000 || 0); last = now;
  acc += dt * S.speed;
  let steps = 0, changed = false;
  while (acc >= 1 && steps < 40) { simStep(1); acc -= 1; steps++; changed = true; }
  if (D.dirty) { derive(); changed = true; }
  if (UI.mode === 'room') { if (moveAvatar(dt, KEYS)) placeAvatar(); }
  else if (KEYS.size) KEYS.clear();
  viewT += dt; sideT += dt; liveT += dt; saveT += dt;
  if (viewT > (changed ? 0.5 : 1.2)) { viewT = 0; renderView(svg); renderTop(); }
  if (liveT > 0.4) { liveT = 0; updateLive(); }
  if (sideT > 2.5) { sideT = 0; renderSide(); renderWins(); }
  if (saveT > 15) { saveT = 0; save(); }
  requestAnimationFrame(frame);
}
function start(data) {
  let fresh = false;
  if (!(data && load(data))) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { }
    if (!load(saved)) { newState(); fresh = true; }
  }
  derive();
  renderAll();
  if (window.ResizeObserver) new ResizeObserver(() => { const v = getVB(); if (v) { const r = svg.getBoundingClientRect(); v.h = v.w * r.height / Math.max(1, r.width); applyVB(svg); } }).observe(svg);
  if (fresh) openHelp(true);
  requestAnimationFrame(t => { last = t; frame(t); });
}
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.claude?.hot?.snapshot?.(() => S);
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? null);
