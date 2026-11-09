'use strict';
/* =========================================================
   Hyperscale — vue face à la baie (SVG)
   ========================================================= */
const RW = 320, GAP = 46, TOPY = 34, RH = RACK_U * U_PX, X19 = 34, W19 = 232;
const rackX = () => 0; // une seule baie affichée à la fois
const uTop = (u, h) => TOPY + (RACK_U - (u + h - 1)) * U_PX;
const PORT_SZ = { rj45: [9, 7], sfp: [12, 6], qsfp: [16, 8] };
const UI = { face: 'rear', sel: null, place: null, from: null, vb: null };
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/* ---------- Disposition des ports (face arrière) ---------- */
const layoutCache = {};
function rearLayout(type) {
  if (layoutCache[type]) return layoutCache[type];
  const L = {};
  const put = (id, x, y, t) => { const [w, h] = PORT_SZ[t]; L[id] = { x, y, w, h, t }; };
  const H = CAT[type].u * U_PX, cy = H / 2;
  switch (type) {
    case 'sw24':
      for (let n = 1; n <= 24; n++) put('Gi1/0/' + n, 8 + Math.floor((n - 1) / 2) * 10.8, (n - 1) % 2 ? 12 : 3, 'rj45');
      for (let n = 1; n <= 4; n++) put('Te1/1/' + n, 142 + Math.floor((n - 1) / 2) * 15, (n - 1) % 2 ? 12.5 : 3, 'sfp');
      break;
    case 'leaf':
      for (let n = 1; n <= 24; n++) put('Te1/0/' + n, 6 + Math.floor((n - 1) / 2) * 12.6, (n - 1) % 2 ? 12.5 : 3, 'sfp');
      put('Fo1/0/25', 160, 2.5, 'qsfp'); put('Fo1/0/26', 160, 12, 'qsfp');
      put('mgmt0', 181, 7.5, 'rj45');
      break;
    case 'spine':
      for (let n = 1; n <= 12; n++) put('Fo1/0/' + n, 6 + Math.floor((n - 1) / 2) * 20, (n - 1) % 2 ? 12 : 2.5, 'qsfp');
      put('mgmt0', 136, 7.5, 'rj45');
      break;
    case 'router':
      put('Te0/0/0', 8, 8, 'sfp'); put('Te0/0/1', 24, 8, 'sfp'); put('Te0/1/0', 54, 8, 'sfp'); put('Te0/1/1', 70, 8, 'sfp'); put('Gi0', 98, 7.5, 'rj45');
      break;
    case 'fw':
      put('port1', 8, 8, 'sfp'); put('port2', 32, 8, 'sfp'); put('port3', 48, 8, 'sfp'); put('port4', 70, 7.5, 'rj45'); put('mgmt', 92, 7.5, 'rj45');
      break;
    case 'srv1': case 'srv2':
      put('idrac', 6, cy - 3.5, 'rj45'); put('eno1', 26, cy - 3.5, 'rj45'); put('eno2', 37, cy - 3.5, 'rj45');
      put('ens1f0', 62, cy - 3, 'sfp'); put('ens1f1', 77, cy - 3, 'sfp');
      break;
    case 'nas':
      put('mgmt', 6, cy - 3.5, 'rj45'); put('eth0', 32, cy - 3, 'sfp'); put('eth1', 47, cy - 3, 'sfp');
      break;
    case 'odf':
      put('OP1', 60, 8, 'sfp'); put('OP2', 80, 8, 'sfp');
      break;
    case 'rogue':
      put('p1', 4, 4, 'rj45');
      break;
  }
  return (layoutCache[type] = L);
}
function psuLayout(d) {
  const c = CAT[d.type], H = c.u * U_PX;
  if (!c.psu || c.kind === 'rogue') return [];
  if (c.psu === 1) return [{ x: 200, y: 2, w: 30, h: H - 4 }];
  if (c.u === 1) return [{ x: 198, y: 2, w: 15.5, h: H - 4 }, { x: 215, y: 2, w: 15.5, h: H - 4 }];
  return [{ x: 196, y: 3, w: 34, h: H / 2 - 4 }, { x: 196, y: H / 2 + 1, w: 34, h: H / 2 - 4 }];
}
function devOrigin(d) {
  if (kindOf(d) === 'rogue') return { x: rackX(d.rack) + 46, y: TOPY + RH + 30 };
  return { x: rackX(d.rack) + X19, y: uTop(d.u, CAT[d.type].u) };
}
function portXY(e) {
  const d = dev(e.d), o = devOrigin(d), L = rearLayout(d.type)[e.p];
  if (!L) return { x: o.x, y: o.y };
  return { x: o.x + L.x + L.w / 2, y: o.y + L.y + L.h / 2 };
}
function outletXY(r, pdu, i) {
  const x = rackX(r) + (pdu === 'A' ? 291 : 309);
  return { x, y: TOPY + RH - (i + 0.5) * (RH / 24) };
}

/* ---------- Routage des cordons ---------- */
function roundPoly(pts, rad) {
  rad = rad || 5;
  let s = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const d1 = Math.hypot(x1 - x0, y1 - y0), d2 = Math.hypot(x2 - x1, y2 - y1);
    if (d1 < 0.01 || d2 < 0.01) continue;
    const r = Math.min(rad, d1 / 2, d2 / 2);
    s += ` L${(x1 - (x1 - x0) / d1 * r).toFixed(1)},${(y1 - (y1 - y0) / d1 * r).toFixed(1)} Q${x1.toFixed(1)},${y1.toFixed(1)} ${(x1 + (x2 - x1) / d2 * r).toFixed(1)},${(y1 + (y2 - y1) / d2 * r).toFixed(1)}`;
  }
  const l = pts[pts.length - 1];
  return s + ` L${l[0].toFixed(1)},${l[1].toFixed(1)}`;
}
function cablePath(c, R) {
  const ra = dev(c.a.d).rack, rb = dev(c.b.d).rack;
  const off = (hhash(c.id) % 9) * 1.4, lane = 7 + off;
  if (ra === rb) {
    const A = portXY(c.a), B = portXY(c.b);
    if (Math.abs(A.y - B.y) < 2) return { d: `M${A.x},${A.y} C${A.x},${A.y + 16} ${B.x},${B.y + 16} ${B.x},${B.y}` };
    return { d: roundPoly([[A.x, A.y], [A.x, A.y + 4], [lane, A.y + 4], [lane, B.y + 4], [B.x, B.y + 4], [B.x, B.y]]) };
  }
  // câble vers une autre baie : il monte dans le chemin de câbles
  const here = ra === R ? c.a : c.b, there = ra === R ? c.b : c.a;
  const A = portXY(here), ty = -44 - off, end = lane + 26 + (hhash(c.id + 'x') % 6) * 34;
  return { d: roundPoly([[A.x, A.y], [A.x, A.y + 4], [lane, A.y + 4], [lane, ty], [end, ty]]), label: { x: end + 2, y: ty + 1.6, txt: `→ ${rackName(dev(there.d).rack)} · ${nameOf(dev(there.d))} ${there.p}` } };
}

/* ---------- Petits éléments ---------- */
const led = (x, y, col, cls) => `<circle cx="${x}" cy="${y}" r="1.5" fill="${col}" class="${cls || ''}"/>`;
function devAlarm(d) {
  if (d.psus.some(p => !p.ok)) return true;
  if ((d.disks || []).some(x => x && x.st === 'failed')) return true;
  if (d.thermalOff) return true;
  return false;
}
function portClass(d, p) {
  const c = portCable(d.id, p.id), k = hasCfg(d, p) ? cfg(d, p.id) : null;
  let cls = '';
  if (k && k.err) cls = 'err';
  else if (k && !k.admin) cls = 'shut';
  else if (c) { const L = D.link[c.id]; cls = L && L.up ? (L.dmg || L.mismatch ? 'warn' : 'up') : 'down'; }
  if (UI.sel && UI.sel.t === 'port' && UI.sel.d === d.id && UI.sel.p === p.id) cls += ' sel';
  if (UI.from) {
    if (UI.from.d === d.id && UI.from.p === p.id) cls += ' sel';
    else if (!c && p.t === portDef(dev(UI.from.d), UI.from.p).t && kindOf(d) !== 'rogue') cls += ' cand';
  }
  return cls;
}
function portSVG(d, p, o) {
  const L = rearLayout(d.type)[p.id]; if (!L) return '';
  const x = o.x + L.x, y = o.y + L.y, cab = portCable(d.id, p.id);
  const peer = cab ? otherEnd(cab, d.id, p.id) : null;
  const tip = `${nameOf(d)} ${p.id} · ${portTypeName(p.t)} ${speedName(p.speed)}${peer ? ' → ' + nameOf(dev(peer.d)) + ' ' + peer.p : ' · libre'}`;
  let s = `<g class="pt ${portClass(d, p)}" data-k="port" data-d="${d.id}" data-p="${esc(p.id)}"><title>${esc(tip)}</title>`;
  s += `<rect class="hitp" x="${x - 1.5}" y="${y - 1.5}" width="${L.w + 3}" height="${L.h + 3}"/>`;
  if (p.t === 'rj45') {
    s += `<rect class="rj" x="${x}" y="${y}" width="${L.w}" height="${L.h}" rx="0.6"/><rect class="rjin" x="${x + 1.5}" y="${y + 1.4}" width="${L.w - 3}" height="${L.h - 2.6}"/>`;
    s += `<rect class="lk" x="${x + 0.6}" y="${y + 0.5}" width="1.6" height="1.2"/>`;
  } else {
    s += `<rect class="cage" x="${x}" y="${y}" width="${L.w}" height="${L.h}" rx="0.5"/>`;
    const m = d.mods[p.id];
    if (cab && CABLES[cab.type].noModule) s += `<rect x="${x + 1}" y="${y + 1}" width="${L.w - 2}" height="${L.h - 2}" fill="#111518"/>`;
    else if (m) s += `<rect x="${x + 1}" y="${y + 1}" width="${L.w - 2}" height="${L.h - 2}" fill="#c3ccd2"/><rect x="${x + 1}" y="${y + L.h - 2.4}" width="${L.w - 2}" height="1.6" fill="${MODULES[m].tab}"/>${d.modFail[p.id] ? `<rect x="${x + 1}" y="${y + 1}" width="${L.w - 2}" height="${L.h - 2}" fill="#ff9f1c" opacity=".45" class="pulse"/>` : ''}`;
    else s += `<rect x="${x + 1.2}" y="${y + 1.2}" width="${L.w - 2.4}" height="${L.h - 2.4}" fill="#07090b"/>`;
    s += `<rect class="lk" x="${x + L.w - 2.2}" y="${y - 1.6}" width="1.8" height="1.1"/>`;
  }
  return s + '</g>';
}
function psuSVG(d, o) {
  return psuLayout(d).map((L, i) => {
    const p = d.psus[i], live = p.out && pduLive(d.rack, p.out.pdu);
    const col = !p.ok ? '#ffb020' : live ? '#2fe07f' : '#8a99aa';
    const sel = UI.sel && UI.sel.t === 'psu' && UI.sel.d === d.id && UI.sel.i === i;
    const tip = `${nameOf(d)} PSU${i + 1} · ${!p.ok ? 'EN PANNE' : p.out ? 'branchée sur PDU ' + p.out.pdu + (live ? '' : ' (sans courant)') : 'non branchée'}`;
    const x = o.x + L.x, y = o.y + L.y;
    return `<g class="psu${sel ? ' sel' : ''}" data-k="psu" data-d="${d.id}" data-i="${i}"><title>${esc(tip)}</title>
<rect x="${x}" y="${y}" width="${L.w}" height="${L.h}" rx="1.5" fill="#46566a" stroke="${sel ? '#ff7a1a' : '#ffffff'}" stroke-width="${sel ? 1.2 : 0.5}"/>
${Array.from({ length: Math.floor(L.w / 3) }, (_, k) => `<rect x="${x + 1.5 + k * 3}" y="${y + 1.5}" width="1.4" height="${L.h - 3}" rx=".5" fill="#33414f"/>`).join('')}
<rect x="${x + L.w - 6}" y="${y + L.h / 2 - 2.5}" width="4.5" height="5" rx="0.8" fill="#1c2a3a" stroke="#ffffff" stroke-width="0.3"/>
${led(x + 2.5, y + L.h - 2.5, col, !p.ok ? 'pulse' : '')}</g>`;
  }).join('');
}

/* ---------- Façades ---------- */
// Une couleur par type d'équipement, la même partout (baie, fenêtres, catalogue)
const KIND_COL = { server: '#18a058', nas: '#8b5cf6', switch: '#2b7de9', router: '#ff8a1f', fw: '#e5484d', odf: '#f2b705', cm: '#7d8ea1', blank: '#b8c4d0', rogue: '#e5484d' };
const KIND_NAME = { server: 'SERVEUR', nas: 'STOCKAGE', switch: 'SWITCH', router: 'ROUTEUR', fw: 'PARE-FEU' };
const kindCol = d => KIND_COL[kindOf(d)] || '#7d8ea1';
const body = (x, y, w, h, col, extra) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${col}" stroke="#1c2a3a" stroke-opacity=".25" stroke-width="0.6" ${extra || ''}/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="url(#gGloss)" pointer-events="none"/>`;
function frontSVG(d) {
  const c = CAT[d.type], k = c.kind, o = devOrigin(d), x = o.x, y = o.y, w = W19, h = c.u * U_PX - 1;
  const on = D.powered[d.id], alarm = devAlarm(d), selD = UI.sel && UI.sel.t === 'dev' && UI.sel.d === d.id;
  let s = `<g class="dev" data-k="dev" data-d="${d.id}"><title>${esc(nameOf(d) + ' · ' + c.name + ' · U' + d.u)}</title>`;
  const ears = `<rect x="${x - 3}" y="${y + 1}" width="4" height="${h - 2}" rx="0.8" fill="#b8c4d0"/><rect x="${x + w - 1}" y="${y + 1}" width="4" height="${h - 2}" rx="0.8" fill="#b8c4d0"/>`;
  const sticker = d.host ? `<rect x="${x + 162}" y="${y + 3}" width="50" height="7.5" rx="2" fill="#ffffff"/><text x="${x + 164}" y="${y + 8.6}" class="lbl">${esc(d.host)}</text>` : '';
  const leds = `${led(x + 218, y + h - 5, on ? '#2fe07f' : '#00000040')}${led(x + 225, y + h - 5, alarm ? '#ffb020' : '#00000040', alarm ? 'pulse' : '')}`;
  if (k === 'server' || k === 'nas') {
    s += body(x, y, w, h, kindCol(d)) + ears;
    const bays = d.disks.length, rows = c.u === 2 ? 2 : 1, per = Math.ceil(bays / rows), bw = (152 - (per - 1) * 2) / per, bh = (h - 4) / rows - 1.5;
    d.disks.forEach((dk, i) => {
      const bx = x + 5 + (i % per) * (bw + 2), by = y + 2 + Math.floor(i / per) * ((h - 4) / rows);
      const sel = UI.sel && UI.sel.t === 'disk' && UI.sel.d === d.id && UI.sel.bay === i;
      s += `<g class="bay${sel ? ' sel' : ''}" data-k="disk" data-d="${d.id}" data-bay="${i}"><title>${esc(`Baie ${i} · ${dk ? DISKS[dk.type].name + ' · ' + ({ ok: 'en service', failed: 'EN PANNE', rebuild: 'reconstruction ' + Math.round(dk.rb * 100) + ' %' })[dk.st] : 'vide'}`)}</title>`;
      if (dk) {
        s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="1.2" fill="#ffffff" stroke="${sel ? '#ff7a1a' : '#1c2a3a'}" stroke-opacity="${sel ? 1 : 0.25}" stroke-width="${sel ? 1.2 : 0.5}"/>`;
        for (let g = 0; g < 4; g++) s += `<rect x="${bx + 2 + g * 2.4}" y="${by + 2}" width="1.2" height="${bh - 4}" rx=".5" fill="#d3deeb"/>`;
        s += `<rect x="${bx + bw - 5}" y="${by + 1.5}" width="1.6" height="${bh - 3}" rx=".6" fill="${dk.type === 'ssd' ? '#2b7de9' : '#ff8a1f'}"/>`;
        s += led(bx + bw - 2.2, by + bh - 2.2, dk.st === 'failed' ? '#e5484d' : on ? '#18a058' : '#c9d3de', dk.st === 'failed' ? 'pulse' : dk.st === 'rebuild' ? 'blink' : '');
      } else s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="1.2" fill="#00000026" stroke="${sel ? '#ff7a1a' : '#ffffff'}" stroke-opacity="${sel ? 1 : 0.4}" stroke-width="${sel ? 1.2 : 0.5}" stroke-dasharray="${sel ? '' : '1.5 1'}"/><text x="${bx + bw / 2}" y="${by + bh / 2 + 2}" class="plus" fill="#ffffff">+</text>`;
      s += '</g>';
    });
    s += sticker + leds;
  } else if (k === 'switch' || k === 'router' || k === 'fw') {
    s += body(x, y, w, h, kindCol(d)) + ears;
    for (let i = 0; i < 12; i++) s += `<rect x="${x + 50 + i * 7}" y="${y + 5}" width="3.5" height="${h - 10}" rx="1.5" fill="#ffffff" opacity=".22"/>`;
    s += `<text x="${x + 8}" y="${y + h / 2 + 2.5}" class="model">${KIND_NAME[k]}</text><text x="${x + 138}" y="${y + h / 2 + 2.5}" class="model" opacity=".8">${esc(c.short)}</text>` + sticker + leds;
  } else if (k === 'odf') {
    s += body(x, y, w, h, KIND_COL.odf) + ears + `<text x="${x + 8}" y="${y + h / 2 + 2}" class="odfl">ODF · ARRIVÉE OPÉRATEURS</text>`;
    s += `<rect x="${x + 150}" y="${y + 6}" width="8" height="8" rx="1.5" fill="#ffffff"/><rect x="${x + 162}" y="${y + 6}" width="8" height="8" rx="1.5" fill="${S.room.op2 ? '#ffffff' : '#00000030'}"/>`;
  } else if (k === 'cm') {
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#dfe7f0" stroke="#9fb0c2" stroke-width=".6"/>${ears}`;
    for (let i = 0; i < 5; i++) s += `<rect x="${x + 14 + i * 44}" y="${y + 3}" width="26" height="${h - 6}" rx="3" fill="none" stroke="#7d8ea1" stroke-width="1.6"/>`;
  } else if (k === 'blank') {
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#eef3f8" stroke="#c3cfdc" stroke-width=".6"/>${ears}<circle cx="${x + 1}" cy="${y + h / 2}" r="1.2" fill="#8a99aa"/><circle cx="${x + w - 1}" cy="${y + h / 2}" r="1.2" fill="#8a99aa"/>`;
  }
  if (selD) s += `<rect x="${x - 4}" y="${y - 1}" width="${w + 8}" height="${h + 2}" rx="2" class="dsel"/>`;
  return s + '</g>';
}
function rearSVG(d) {
  const c = CAT[d.type], k = c.kind, o = devOrigin(d), x = o.x, y = o.y, h = (c.u || 1) * U_PX - 1;
  const selD = UI.sel && UI.sel.t === 'dev' && UI.sel.d === d.id;
  let s = `<g class="dev" data-k="dev" data-d="${d.id}"><title>${esc(nameOf(d) + ' · ' + c.name)}</title>`;
  if (k === 'rogue') {
    s += `<rect x="${x}" y="${y}" width="44" height="16" rx="3" fill="#ffe1e2" stroke="#e5484d" stroke-width="1.2" class="pulse"/><text x="${x + 15}" y="${y + 11}" class="model" fill="#b42328">???</text>`;
    s += `<line x1="${x + 22}" y1="${y}" x2="${x + 22}" y2="${TOPY + RH}" stroke="#e5484d" stroke-dasharray="2 2" stroke-width=".8"/>`;
  } else if (k === 'blank') s += `<rect x="${x}" y="${y}" width="${W19}" height="${h}" rx="2" fill="#eef3f8" opacity=".8"/>`;
  else if (k === 'cm') {
    s += `<rect x="${x}" y="${y}" width="${W19}" height="${h}" rx="2" fill="#dfe7f0" stroke="#9fb0c2" stroke-width=".6"/>`;
    for (let i = 0; i < 5; i++) s += `<rect x="${x + 14 + i * 44}" y="${y + 3}" width="26" height="${h - 6}" rx="3" fill="none" stroke="#7d8ea1" stroke-width="1.6"/>`;
  } else {
    s += body(x, y, W19, h, kindCol(d)) + `<rect x="${x}" y="${y}" width="${W19}" height="${h}" rx="2" fill="#1c2a3a" opacity=".12" pointer-events="none"/>`;
    if (k === 'server') s += `<rect x="${x + 56}" y="${y + 2}" width="36" height="${h - 4}" rx="1.5" fill="none" stroke="#ffffff" stroke-opacity=".55" stroke-width=".6"/><text x="${x + 58}" y="${y + 6}" class="tiny">PCIe 10G</text>`;
    if (d.host && k !== 'odf') s += `<text x="${x + 120}" y="${y + h / 2 + 2}" class="rlbl">${esc(d.host)}</text>`;
    if (k === 'odf') s += `<text x="${x + 8}" y="${y + h / 2 + 2}" class="odfl">ODF</text>`;
  }
  s += CAT[d.type].ports.map(p => portSVG(d, p, o)).join('');
  if (k !== 'rogue') s += psuSVG(d, o);
  if (selD) s += `<rect x="${x - 4}" y="${y - 1}" width="${W19 + 8}" height="${h + 2}" rx="2" class="dsel"/>`;
  return s + '</g>';
}

/* ---------- Baie ---------- */
function rackSVG(r) {
  const x = rackX(r), T = D.temp[r] || 20, W = (D.rackW[r] || 0) / 1000;
  const tcol = T > 32 ? '#e5484d' : T > 27 ? '#e09100' : '#18a058';
  let s = `<g class="rack">`;
  s += `<rect x="${x + 2}" y="4" width="${RW}" height="${TOPY + RH + 22}" rx="10" fill="#1c2a3a" opacity=".08"/>`;
  s += `<rect x="${x}" y="0" width="${RW}" height="${TOPY + RH + 22}" rx="10" fill="#ffffff" stroke="#c3cfdc" stroke-width="1.5"/>`;
  s += `<rect x="${x + 1}" y="1" width="${RW - 2}" height="${TOPY - 6}" rx="9" fill="#f4f8fd"/>`;
  s += `<text x="${x + 12}" y="18" class="rname">${S.racks[r].row === 'MMR' ? 'Salle MMR · ODF' : 'Baie ' + rackName(r)}</text>`;
  s += `<text x="${x + (S.racks[r].row === 'MMR' ? 150 : 96)}" y="18" class="rinfo">${W.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kW · <tspan fill="${tcol}">${T.toFixed(1)} °C</tspan> en entrée</text>`;
  for (const side of [x + 20, x + 266]) {
    s += `<rect x="${side}" y="${TOPY}" width="14" height="${RH}" rx="2" fill="#e6eef8"/>`;
    for (let u = 1; u <= RACK_U; u++) {
      const yy = uTop(u, 1);
      s += `<rect x="${side + 4.5}" y="${yy + 9}" width="5" height="4" rx="1" fill="#c3cfdc"/>`;
      if (side === x + 20 && (u % 2 === 1 || UI.face === 'front')) s += `<text x="${side + 7}" y="${yy + 7}" class="unum">${u}</text>`;
    }
  }
  // unités vides
  const m = slotMap(r);
  for (let u = 1; u <= RACK_U; u++) if (!m[u]) {
    const yy = uTop(u, 1);
    s += `<rect class="emptyu" data-k="empty" data-r="${r}" data-u="${u}" x="${x + X19}" y="${yy + 0.5}" width="${W19}" height="${U_PX - 1}"><title>Baie ${rackName(r)}, U${u} : vide${UI.face === 'front' ? ' (clic : poser un obturateur ou un équipement)' : ''}</title></rect>`;
  }
  // PDU
  if (UI.face === 'rear') {
    for (const p of ['A', 'B']) {
      const px = x + (p === 'A' ? 284 : 302), live = pduLive(r, p), load = (D.pdu[r] || {})[p] || 0, pct = load / PDU_CAP;
      const selP = UI.sel && UI.sel.t === 'pdu' && UI.sel.r === r && UI.sel.p === p;
      s += `<g class="pdu${selP ? ' sel' : ''}" data-k="pdu" data-r="${r}" data-p="${p}"><title>${esc(`PDU ${p} (voie ${p}) · ${Math.round(load)} W sur ${PDU_CAP} W · ${(load / 230).toFixed(1)} A${S.racks[r].trip[p] ? ' · DISJONCTÉ' : !S.feeds[p] ? ' · voie coupée' : ''}`)}</title>`;
      s += `<rect x="${px}" y="${TOPY}" width="14" height="${RH}" rx="3" fill="${p === 'A' ? '#ffe1e2' : '#dde9fd'}" stroke="${selP ? '#ff7a1a' : p === 'A' ? '#e5484d' : '#2b7de9'}" stroke-width="${selP ? 1.6 : 1}"/>`;
      s += `<text x="${px + 7}" y="${TOPY - 3}" class="pdul" fill="${p === 'A' ? '#e5484d' : '#2b7de9'}">${p}</text>`;
      s += `<rect x="${px + 2}" y="${TOPY + RH - 4 - (RH - 8) * Math.min(1, pct)}" width="2" height="${(RH - 8) * Math.min(1, pct)}" rx="1" fill="${pct > 1 ? '#e5484d' : pct > 0.5 ? '#e09100' : '#18a058'}"/>`;
      for (let i = 0; i < 24; i++) { const o = outletXY(r, p, i); s += `<rect x="${o.x - 3}" y="${o.y - 3.5}" width="7" height="7" rx="1.5" fill="#ffffff" stroke="#8a99aa" stroke-width=".5"/>`; }
      if (!live) s += `<rect x="${px}" y="${TOPY}" width="14" height="${RH}" rx="3" fill="#1c2a3a" opacity=".6"/><text x="${px + 7}" y="${TOPY + RH / 2}" class="vtxt" transform="rotate(-90 ${px + 7} ${TOPY + RH / 2})">${S.racks[r].trip[p] ? 'DISJONCTÉ' : 'VOIE COUPÉE'}</text>`;
      s += '</g>';
    }
  }
  return s + '</g>';
}

/* ---------- Rendu complet ---------- */
const DEFS = `<defs>
<linearGradient id="gGloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".28"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".05"/><stop offset="1" stop-color="#000000" stop-opacity=".08"/></linearGradient>
<pattern id="mesh" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#f4f8fd"/><path d="M0 0L6 6M6 0L0 6" stroke="#c3cfdc" stroke-width=".5"/></pattern>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;
function renderView(svg) {
  if (UI.mode === 'room') { renderRoom(svg); applyVB(svg); return; }
  const R = UI.rack;
  let s = DEFS;
  s += `<rect x="-20" y="-62" width="${RW + 380}" height="22" rx="3" rx="5" fill="url(#mesh)" stroke="#9fb0c2" stroke-width="1"/><text x="-14" y="-66" class="tray">Chemin de câbles en hauteur, vers les autres baies</text>`;
  s += rackSVG(R);
  const devs = devsIn(R);
  // placement
  if (UI.place && S.racks[R].kind === 'rack') {
    const type = UI.place.type, h = CAT[type].u;
    for (let u = 1; u <= RACK_U - h + 1; u++) if (fits(type, R, u, UI.place.move)) {
      s += `<rect class="slot" data-k="slot" data-r="${R}" data-u="${u}" x="${X19}" y="${uTop(u, h) + 0.5}" width="${W19}" height="${h * U_PX - 1}"><title>Installer ici : baie ${rackName(R)}, U${u}${h > 1 ? '–' + (u + h - 1) : ''}</title></rect>`;
    }
  }
  if (UI.face === 'front') {
    for (const d of devs) if (kindOf(d) !== 'rogue') s += frontSVG(d);
  } else {
    for (const d of devs) s += rearSVG(d);
    // fibres opérateurs
    for (const d of devs.filter(x => kindOf(x) === 'odf')) {
      for (const p of ['OP1', 'OP2']) {
        if (p === 'OP2' && !S.room.op2) continue;
        const a = portXY({ d: d.id, p }), lane = rackX(d.rack) + 2 + (p === 'OP2' ? 2 : 0);
        const dead = (p === 'OP1' && S.flags.op1down) || (p === 'OP2' && S.flags.op2down);
        s += `<path d="${roundPoly([[a.x, a.y], [a.x, a.y - 5], [lane, a.y - 5], [lane, -54 + (p === 'OP2' ? 3 : 0)], [-60, -54 + (p === 'OP2' ? 3 : 0)]])}" fill="none" stroke="#f2b705" stroke-width="2.4" ${dead ? 'stroke-dasharray="3 3" opacity=".5"' : ''}/>`;
        s += `<text x="-62" y="${-58 + (p === 'OP2' ? 12 : 0)}" class="opl" text-anchor="end">Opérateur ${p.slice(2)}${dead ? ' (coupé)' : ''}</text>`;
      }
    }
    // cordons d'alimentation
    for (const d of devs) {
      const o = devOrigin(d);
      psuLayout(d).forEach((L, i) => {
        const p = d.psus[i]; if (!p.out) return;
        const a = { x: o.x + L.x + L.w - 3.7, y: o.y + L.y + L.h / 2 }, b = outletXY(d.rack, p.out.pdu, p.out.i);
        const col = p.out.pdu === 'A' ? '#e5484d' : '#2b7de9';
        const path = roundPoly([[a.x, a.y], [a.x + 6, a.y], [b.x - 6 + (p.out.pdu === 'A' ? -2 : 0), a.y], [b.x - 6, b.y], [b.x, b.y]], 4);
        s += `<path d="${path}" fill="none" stroke="#ffffff" stroke-width="2.8"/><path d="${path}" fill="none" stroke="${col}" stroke-width="1.5"/>`;
        s += `<rect x="${b.x - 2.5}" y="${b.y - 2.5}" width="5" height="5" rx=".8" fill="${col}"/>`;
      });
    }
    // cordons réseau
    for (const c of S.cables) {
      if (dev(c.a.d).rack !== R && dev(c.b.d).rack !== R) continue;
      const P = cablePath(c, R), path = P.d, L = D.link[c.id] || {}, ct = CABLES[c.type];
      const sel = UI.sel && UI.sel.t === 'cable' && UI.sel.c === c.id;
      const dash = !L.up ? 'stroke-dasharray="4 3"' : '';
      s += `<g class="cab${sel ? ' sel' : ''}" data-k="cable" data-c="${c.id}"><title>${esc(`${ct.name} ${fmtLen(c.len)} · ${nameOf(dev(c.a.d))} ${c.a.p} ↔ ${nameOf(dev(c.b.d))} ${c.b.p} · ${L.up ? speedName(L.speed) : 'lien coupé : ' + L.why}`)}</title>`;
      s += `<path d="${path}" class="chit"/><path d="${path}" fill="none" stroke="#ffffff" stroke-width="${sel ? 4.8 : 3.6}"/>`;
      s += `<path d="${path}" fill="none" stroke="${ct.color}" stroke-width="${sel ? 3 : 2}" ${dash} ${sel ? 'filter="url(#glow)"' : ''}/>`;
      if (c.dmg) s += `<path d="${path}" fill="none" stroke="#ff9f1c" stroke-width="1" stroke-dasharray="1 5" class="pulse"/>`;
      if (P.label) s += `<text x="${P.label.x}" y="${P.label.y}" class="clab">${esc(P.label.txt)}</text>`;
      s += '</g>';
    }
  }
  svg.innerHTML = s;
  if (!UI.vb) fitView(svg);
  applyVB(svg);
}
function applyVB(svg) { const v = UI.mode === 'room' ? UI.rvb : UI.vb; if (v) svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); }
function fitView(svg, mode) {
  const box = svg.getBoundingClientRect();
  const bw = box.width || 900, bh = box.height || 600, aspect = bw / bh;
  if (mode === 'all') {
    const tw = RW + 200, th = RH + 150;
    let w = tw, h = th;
    if (w / h > aspect) h = w / aspect; else w = h * aspect;
    UI.vb = { x: -80 - (w - tw) / 2, y: -86, w, h };
    return;
  }
  // vue de détail : environ 1,15 pixel par unité, calée sur le haut des baies
  const sc = Math.max(0.75, Math.min(1.4, bw / (RW + 140)));
  const w = bw / Math.min(sc, 1.15), h = w / aspect;
  UI.vb = { x: -70, y: -86, w, h };
}
