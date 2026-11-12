'use strict';
/* =========================================================
   Hyperscale — la salle vue de dessus : allées, rangées,
   énergie et froid
   ========================================================= */
const MU = 50;
UI.mode = 'room'; UI.rack = null; UI.layer = 'etat'; UI.rvb = null;

const INFRA = {
  tgbt: { x: 11.8, y: 1.95, w: 2.4, h: 0.9, label: 'TGBT' },
  upsA: { x: 11.8, y: 3.5, w: 1.3, h: 2.3, label: 'Onduleur A', p: 'A' },
  batA: { x: 13.25, y: 3.5, w: 1.0, h: 2.3, label: 'Batteries A', p: 'A' },
  upsB: { x: 11.8, y: 9.4, w: 1.3, h: 2.3, label: 'Onduleur B', p: 'B' },
  batB: { x: 13.25, y: 9.4, w: 1.0, h: 2.3, label: 'Batteries B', p: 'B' },
  gen:  { x: 14.95, y: 11.0, w: 1.2, h: 2.4, label: 'Groupe électrogène' },
};
const WALLS = [
  { x: 0, y: 5.15, w: 2.65, h: 0.15 }, { x: 0, y: 9.95, w: 2.65, h: 0.15 },
  { x: 2.5, y: 5.15, w: 0.15, h: 3.15 }, { x: 2.5, y: 9.3, w: 0.15, h: 0.8 },
  { x: 11.35, y: 1.55, w: 0.15, h: 5.45 }, { x: 11.35, y: 8.2, w: 0.15, h: 6.65 },
  { x: 11.35, y: 1.55, w: 3.25, h: 0.15 }, { x: 11.35, y: 14.7, w: 3.25, h: 0.15 },
];
const CRAC_W = 1.8, CRAC_H = 0.8;

/* ---------- Géométrie ---------- */
function slotRect(row, pos) { return { x: ROW_X0 + (pos - 1) * RACK_W, y: ROW_Y[row], w: RACK_W, h: RACK_D }; }
function rackRect(r) { const k = S.racks[r]; return k.row === 'MMR' ? { x: MMR_RACK.x, y: MMR_RACK.y, w: 1.2, h: 0.6 } : slotRect(k.row, k.pos); }
/* ---------- Couleurs des couches ---------- */
function tempColor(t) { return t > 32 ? '#e5484d' : t > 27 ? '#e09100' : t > 24 ? '#18a058' : '#2b7de9'; }
function rackStatus(r) {
  const list = devsIn(r).filter(d => CAT[d.type].psu);
  if (!list.length) return 'empty';
  if (list.some(d => devAlarm(d)) || (D.temp[r] || 20) > 27) return 'warn';
  return list.some(d => D.powered[d.id]) ? (list.every(d => D.powered[d.id]) ? 'ok' : 'warn') : 'off';
}

const RACK_ST = { ok: 'sous tension', warn: 'en alarme', off: 'hors tension', empty: 'vide' };
// L'état d'une baie se lit à la forme autant qu'à la couleur : rond = tout va bien, triangle = alarme, carré = éteinte, anneau = vide
function statusMark(cx, cy, st, col) {
  if (st === 'warn') return `<path d="M${cx} ${cy - 5.2}L${cx + 5.2} ${cy + 4}H${cx - 5.2}Z" fill="${col}" stroke="#14181c" stroke-width=".8" stroke-linejoin="round" class="pulse"/>`;
  if (st === 'off') return `<rect x="${cx - 4}" y="${cy - 4}" width="8" height="8" rx="1" fill="${col}" stroke="#14181c" stroke-width=".8" class="pulse"/>`;
  if (st === 'empty') return `<circle cx="${cx}" cy="${cy}" r="3.2" fill="none" stroke="${col}" stroke-width="1.6"/>`;
  return `<circle cx="${cx}" cy="${cy}" r="4" fill="${col}" stroke="#14181c" stroke-width=".8"/>`;
}

/* ---------- Rendu ---------- */
const ROOM_DEFS = `<defs>
<pattern id="tiles" width="${0.6 * MU}" height="${0.6 * MU}" patternUnits="userSpaceOnUse"><rect width="${0.6 * MU}" height="${0.6 * MU}" fill="#5f656c"/><rect x=".7" y=".7" width="${0.6 * MU - 1.4}" height="${0.6 * MU - 1.4}" rx="1" fill="#878d94"/><rect x=".7" y=".7" width="${0.6 * MU - 1.4}" height="${0.6 * MU - 1.4}" rx="1" fill="url(#gTileD)"/>${[[5, 7], [13, 20], [22, 9], [9, 25], [26, 24], [18, 4], [3, 16], [24, 15]].map(p => `<circle cx="${p[0]}" cy="${p[1]}" r=".5" fill="#737980" opacity=".7"/>`).join('')}${[[2.4, 2.4], [0.6 * MU - 2.4, 2.4], [2.4, 0.6 * MU - 2.4], [0.6 * MU - 2.4, 0.6 * MU - 2.4]].map(p => `<circle cx="${p[0]}" cy="${p[1]}" r=".8" fill="#555b62"/>`).join('')}</pattern>
<linearGradient id="gTile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#8f99a3" stop-opacity=".18"/></linearGradient>
<linearGradient id="gTileD" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".18"/><stop offset="1" stop-color="#000000" stop-opacity=".12"/></linearGradient>
<pattern id="perf" width="${0.6 * MU}" height="${0.6 * MU}" patternUnits="userSpaceOnUse"><rect width="${0.6 * MU}" height="${0.6 * MU}" fill="#9fb4cc"/><rect x=".7" y=".7" width="${0.6 * MU - 1.4}" height="${0.6 * MU - 1.4}" rx="1" fill="#cfe0f3"/>${[4, 8, 12, 16, 20, 24].map(a => [4, 8, 12, 16, 20, 24].map(b => `<circle cx="${a + 1}" cy="${b + 1}" r="1.25" fill="#5f7fa6"/>`).join('')).join('')}</pattern>
<pattern id="hot" width="${0.6 * MU}" height="${0.6 * MU}" patternUnits="userSpaceOnUse"><rect width="${0.6 * MU}" height="${0.6 * MU}" fill="#d9b9a3"/><rect x=".7" y=".7" width="${0.6 * MU - 1.4}" height="${0.6 * MU - 1.4}" rx="1" fill="#f6dfd0"/><rect x=".7" y=".7" width="${0.6 * MU - 1.4}" height="${0.6 * MU - 1.4}" rx="1" fill="url(#gTile)"/></pattern>
<pattern id="rktop" width="4" height="3.4" patternUnits="userSpaceOnUse"><rect width="4" height="3.4" fill="#343a41"/><circle cx="1" cy=".85" r=".8" fill="#14181c"/><circle cx="3" cy="2.55" r=".8" fill="#14181c"/></pattern>
<pattern id="gravel" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#ece6d6"/><circle cx="3" cy="4" r="1" fill="#d5ccb3"/><circle cx="9" cy="9" r="1.2" fill="#d9d1ba"/></pattern>
<pattern id="tilesW" width="${0.6 * MU}" height="${0.6 * MU}" patternUnits="userSpaceOnUse"><rect width="${0.6 * MU}" height="${0.6 * MU}" fill="#d9cba6"/><rect x=".7" y=".7" width="${0.6 * MU - 1.4}" height="${0.6 * MU - 1.4}" rx="1" fill="#f2e9cf"/><rect x=".7" y=".7" width="${0.6 * MU - 1.4}" height="${0.6 * MU - 1.4}" rx="1" fill="url(#gTile)" opacity=".5"/></pattern>
<pattern id="concrete" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#e4e9ee"/>${[[6, 9, 1], [22, 5, .8], [33, 18, 1.1], [12, 27, .9], [27, 33, 1], [3, 36, .7], [18, 16, .7]].map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]}" fill="#c9d1da"/>`).join('')}<path d="M0 39.5H40M39.5 0V40" stroke="#d3dae2" stroke-width="1"/></pattern>
<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#ffffff"/><rect width="3" height="8" fill="#eef1f4"/></pattern>
</defs>`;
const m = v => (v * MU).toFixed(1);
function rr2(x, y, w, h, extra) { return `<rect x="${m(x)}" y="${m(y)}" width="${m(w)}" height="${m(h)}" ${extra || ''}/>`; }
function renderRoom(svg) {
  let s = ROOM_DEFS;
  // cour et bâtiment
  s += rr2(14.6, 10.6, 1.8, 3.2, 'fill="url(#gravel)" stroke="#cfc6ae"');
  s += `<text x="${m(15.5)}" y="${m(10.45)}" class="rl" text-anchor="middle">Cour</text>`;
  s += rr2(0.1, 0.14, 14.6, 16.4, 'fill="#1c2a3a" opacity=".13" rx="3"');
  s += rr2(0, 0, 14.6, 16.4, 'fill="url(#tiles)" stroke="#3d4248" stroke-width="9"');
  s += rr2(0.15, 5.3, 2.35, 4.65, 'fill="url(#tilesW)"') + rr2(11.5, 1.7, 3.0, 13.0, 'fill="url(#concrete)"');
  for (const w of WALLS) s += rr2(w.x, w.y, w.w, w.h, 'fill="#3d4248"');
  s += rr2(14.5, 11.6, 0.2, 1.0, 'fill="#e9eef4"');
  s += rr2(0.6, 16.3, 1.6, 0.2, 'fill="#e9eef4"');
  s += `<text x="${m(1.4)}" y="${m(16.95)}" class="rl" text-anchor="middle">Entrée</text>`;
  // allées
  for (const a of AISLES) {
    const x0 = ROW_X0 - 0.5, w = NPOS * RACK_W + 1.0;
    s += `<g data-k="aisle" data-id="${a.id}"><title>${a.cold ? 'Allée froide' : 'Allée chaude'} ${a.id}${a.cold && S.cool.contain[a.id] ? ' (confinée)' : ''}</title>`;
    s += rr2(x0, a.y, w, 1.2, a.cold ? 'fill="url(#perf)" stroke="#6f93c0" stroke-width="1.5" rx="2"' : 'fill="url(#hot)" stroke="#c98d6b" stroke-width="1.5" rx="2"');
    s += rr2(x0 + w / 2 - 1.8, a.y + 0.4, 3.6, 0.4, `fill="#ffffff" opacity=".92" rx="1"`);
    s += `<text x="${m(x0 + w / 2)}" y="${m(a.y + 0.68)}" class="${a.cold ? 'acold' : 'ahot'}" text-anchor="middle">${a.cold ? 'ALLÉE FROIDE' : 'ALLÉE CHAUDE'} ${a.id}</text>`;
    if (a.cold && S.cool.contain[a.id]) s += rr2(ROW_X0 - 0.05, a.y - 0.04, NPOS * RACK_W + 0.1, 1.28, 'fill="rgba(70,199,255,.08)" stroke="#46c7ff" stroke-width="2" stroke-dasharray="6 4"') + rr2(ROW_X0 - 0.1, a.y, 0.08, 1.2, 'fill="#46c7ff"') + rr2(ROW_X0 + NPOS * RACK_W + 0.02, a.y, 0.08, 1.2, 'fill="#46c7ff"');
    s += `</g>`;
  }
  // gaines à barres et chemins de câbles (en hauteur)
  for (const row of ROWS) {
    if (!S.power.rows[row]) continue;
    const back = ROW_FRONT[row] > 0 ? ROW_Y[row] - 0.12 : ROW_Y[row] + RACK_D + 0.04;
    s += rr2(ROW_X0 - 0.2, back, NPOS * RACK_W + 0.4, 0.035, 'fill="#e5484d" opacity=".85"') + rr2(ROW_X0 - 0.2, back + 0.05, NPOS * RACK_W + 0.4, 0.035, 'fill="#2b7de9" opacity=".85"');
  }
  for (const row of ROWS) s += rr2(ROW_X0 - 0.7, ROW_Y[row] + 0.55, NPOS * RACK_W + 1.4, 0.1, 'fill="#f2c230" opacity=".22"');
  s += rr2(ROW_X0 - 0.75, ROW_Y.A + 0.55, 0.1, ROW_Y.F - ROW_Y.A + 0.1, 'fill="#f2c230" opacity=".22"');
  s += rr2(2.6, 8.75, ROW_X0 - 0.7 - 2.6 + 0.1, 0.1, 'fill="#f2c230" opacity=".3"');
  // ombres portées des baies
  S.racks.forEach((k, i) => { if (k.row === 'MMR') return; const B = rackRect(i); s += rr2(B.x + 0.05, B.y + 0.08, B.w - 0.04, B.h - 0.04, 'fill="#0b0d10" opacity=".3" rx="3"'); });
  // rangées
  for (const row of ROWS) {
    const powered = !!S.power.rows[row];
    s += `<text x="${m(ROW_X0 - 0.25)}" y="${m(ROW_Y[row] + 0.72)}" class="rowl" text-anchor="end">${row}</text>`;
    const rowEnd = () => !powered ? `<text x="${m(ROW_X0 + NPOS * RACK_W / 2)}" y="${m(ROW_Y[row] + 0.68)}" class="rowoff" text-anchor="middle" pointer-events="none">RANGÉE ${row} NON ÉLECTRIFIÉE</text>` : '';
    for (let pos = 1; pos <= NPOS; pos++) {
      const r = rackAt(row, pos), R = slotRect(row, pos);
      const sel = UI.sel && ((UI.sel.t === 'slot' && UI.sel.row === row && UI.sel.pos === pos) || (UI.sel.t === 'rack' && UI.sel.r === r && r >= 0));
      if (r < 0) {
        s += `<g class="eslot${powered ? '' : ' off'}" data-k="eslot" data-row="${row}" data-pos="${pos}"><title>${row}${String(pos).padStart(2, '0')} : emplacement libre${powered ? '' : ' (rangée non électrifiée)'}</title>${rr2(R.x + 0.03, R.y + 0.03, R.w - 0.06, R.h - 0.06, `fill="${powered ? '#ffffff' : 'url(#hatch)'}" stroke="${sel ? '#e8590c' : '#a9b8c8'}" stroke-width="${sel ? 3 : 1.6}" stroke-dasharray="5 4" rx="2"`)}<text x="${m(R.x + R.w / 2)}" y="${m(R.y + R.h / 2 + 0.07)}" class="plusr" text-anchor="middle">+</text></g>`;
        continue;
      }
      const k = S.racks[r];
      if (k.kind === 'inrow') {
        s += `<g class="rk" data-k="inrow" data-r="${r}"><title>Climatiseur en rangée ${rackName(r)} · ${INROW_KW} kW</title>${rr2(R.x + 0.02, R.y + 0.02, R.w - 0.04, R.h - 0.04, `fill="#2b7de9" stroke="${sel ? '#e8590c' : '#ffffff'}" stroke-width="2" rx="2"`)}<circle cx="${m(R.x + R.w / 2)}" cy="${m(R.y + R.h / 2)}" r="${m(0.2)}" fill="none" stroke="#ffffff" stroke-width="2"/><text x="${m(R.x + R.w / 2)}" y="${m(R.y + R.h / 2 + 0.06)}" class="rkl" text-anchor="middle">IR</text></g>`;
        continue;
      }
      const st = rackStatus(r), t = D.temp[r] || 20, kw = (D.rackW[r] || 0) / 1000;
      const fill = UI.layer === 'chaleur' ? tempColor(t) : UI.layer === 'energie' ? `rgba(255,181,71,${Math.min(0.9, 0.12 + kw / 6)})` : 'url(#rktop)';
      const n = devsIn(r).filter(d => !['blank', 'cm', 'rogue'].includes(kindOf(d))).length;
      const fy = ROW_FRONT[row] > 0 ? R.y + R.h - 0.07 : R.y + 0.02;
      s += `<g class="rk" data-k="rk" data-r="${r}"><title>${esc(`Baie ${rackName(r)} · ${RACK_ST[st]} · ${n} équipement(s) · ${kw.toFixed(2)} kW · ${t.toFixed(1)} °C en entrée`)}</title>`;
      s += rr2(R.x + 0.02, R.y + 0.02, R.w - 0.04, R.h - 0.04, `fill="#2a2f35" stroke="${sel ? '#e8590c' : '#0e1114'}" stroke-width="${sel ? 4 : 1.5}" rx="3"`);
      s += rr2(R.x + 0.05, R.y + 0.05, R.w - 0.1, R.h - 0.1, `fill="${fill}" rx="2"`);
      s += rr2(R.x + 0.05, R.y + 0.36, R.w - 0.1, R.h - 0.72, `fill="#14181c" fill-opacity="${UI.layer === 'chaleur' || UI.layer === 'energie' ? '.72' : '.55'}" rx="2"`);
      s += rr2(R.x + 0.06, fy, R.w - 0.12, 0.05, 'fill="#aab3bc"');
      s += `<text x="${m(R.x + R.w / 2)}" y="${m(R.y + R.h / 2 - 0.05)}" class="rkl" text-anchor="middle">${rackName(r)}</text>`;
      s += `<text x="${m(R.x + R.w / 2)}" y="${m(R.y + R.h / 2 + 0.2)}" class="rks" text-anchor="middle">${UI.layer === 'chaleur' ? t.toFixed(1).replace('.', ',') + '°' : UI.layer === 'energie' ? kw.toFixed(1).replace('.', ',') : n ? n + ' éq.' : 'vide'}</text>`;
      const col = { ok: '#2fe07f', warn: '#ffb020', off: '#ff5a5f', empty: '#c3cfdc' }[st];
      s += statusMark(+m(R.x + R.w / 2), +m(ROW_FRONT[row] > 0 ? R.y + 0.18 : R.y + R.h - 0.18), st, col);
      s += `</g>`;
    }
    s += rowEnd();
  }
  // climatiseurs de salle
  CRAC_SLOTS.forEach((p, i) => {
    const c = S.cool.cracs.find(x => x.slot === i);
    const sel = UI.sel && (UI.sel.t === 'crac' || UI.sel.t === 'cracslot') && UI.sel.slot === i;
    if (c) {
      s += `<g class="rk" data-k="crac" data-slot="${i}"><title>CRAC-${i + 1} · ${CRAC_KW} kW · ${c.ok ? 'en service' : 'EN PANNE'}</title>${rr2(p.x, p.y, CRAC_W, CRAC_H, `fill="${c.ok ? '#eef0ee' : '#f6d5d5'}" stroke="${sel ? '#e8590c' : c.ok ? '#ffffff' : '#e5484d'}" stroke-width="${sel ? 3 : 2}" rx="2" class="${c.ok ? '' : 'pulse'}"`)}`;
      s += `<circle cx="${m(p.x + 0.45)}" cy="${m(p.y + CRAC_H / 2)}" r="${m(0.26)}" fill="#2b7de9"/><g class="${c.ok ? 'spin' : ''}" style="transform-origin:${m(p.x + 0.45)}px ${m(p.y + CRAC_H / 2)}px">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="${m(p.x + 0.45 + 0.12)}" cy="${m(p.y + CRAC_H / 2)}" rx="${m(0.11)}" ry="${m(0.045)}" fill="#ffffff" transform="rotate(${a} ${m(p.x + 0.45)} ${m(p.y + CRAC_H / 2)})"/>`).join('')}</g>`;
      s += `<text x="${m(p.x + 1.25)}" y="${m(p.y + 0.36)}" class="crl" text-anchor="middle">CRAC-${i + 1}</text><text x="${m(p.x + 1.25)}" y="${m(p.y + 0.62)}" class="crs" text-anchor="middle">${c.ok ? CRAC_KW + ' kW' : 'en panne'}</text></g>`;
    } else s += `<g class="eslot" data-k="cracslot" data-slot="${i}"><title>Emplacement pour un climatiseur de salle</title>${rr2(p.x, p.y, CRAC_W, CRAC_H, `fill="transparent" stroke="${sel ? '#e8590c' : '#a9b8c8'}" stroke-width="${sel ? 3 : 1.6}" stroke-dasharray="5 4" rx="2"`)}<text x="${m(p.x + CRAC_W / 2)}" y="${m(p.y + CRAC_H / 2 + 0.07)}" class="plusr" text-anchor="middle">+ CRAC</text></g>`;
  });
  // salle opérateurs
  s += `<text x="${m(1.3)}" y="${m(5.75)}" class="rl" text-anchor="middle">Salle opérateurs</text><text x="${m(1.3)}" y="${m(6.1)}" class="rl" text-anchor="middle">(MMR)</text>`;
  s += `<path d="M0 ${m(7.15)} H${m(MMR_RACK.x)}" stroke="#f2c230" stroke-width="3"/>${S.room.op2 ? `<path d="M0 ${m(7.45)} H${m(MMR_RACK.x)}" stroke="#f2c230" stroke-width="3"/>` : ''}`;
  s += `<text x="${m(0.24)}" y="${m(6.95)}" class="opr">op. 1${S.room.op2 ? ' et 2' : ''}</text>`;
  {
    const R = rackRect(0), sel = UI.sel && UI.sel.t === 'rack' && UI.sel.r === 0;
    s += `<g class="rk" data-k="rk" data-r="0"><title>ODF : arrivée des fibres opérateurs (clique pour l'ouvrir)</title>${rr2(R.x, R.y, R.w, R.h, `fill="#f2b705" stroke="${sel ? '#e8590c' : '#ffffff'}" stroke-width="${sel ? 3 : 2}" rx="3"`)}${rr2(R.x + R.w - 0.06, R.y + 0.05, 0.05, R.h - 0.1, 'fill="#9cd0ff"')}<text x="${m(R.x + R.w / 2)}" y="${m(R.y + 0.38)}" class="odfr" text-anchor="middle">ODF</text></g>`;
  }
  // local électrique
  s += `<text x="${m(13.0)}" y="${m(14.3)}" class="rl" text-anchor="middle">Local électrique</text>`;
  const P = S.power;
  for (const [id, b] of Object.entries(INFRA)) {
    if (id === 'gen' && !P.gen) { s += `<g class="eslot" data-k="infra" data-id="gen"><title>Emplacement du groupe électrogène</title>${rr2(b.x, b.y, b.w, b.h, 'fill="transparent" stroke="#a9b8c8" stroke-width="1.6" stroke-dasharray="5 4" rx="2"')}<text x="${m(b.x + b.w / 2)}" y="${m(b.y + b.h / 2)}" class="plusr" text-anchor="middle">+ GE</text></g>`; continue; }
    const sel = UI.sel && UI.sel.t === 'infra' && UI.sel.id === id;
    let fill = '#f4f4f1', txt = '', sub = '', alarm = false; const sm = b.w < 1.2 ? ' sm' : '';
    if (id === 'tgbt') { txt = P.edf ? 'EDF OK' : 'EDF coupé'; alarm = !P.edf; }
    if (id.startsWith('ups')) { const u = P.ups[b.p], load = (D.ups || {})[b.p] || 0; fill = u.trip ? '#f6d5d5' : '#dcefe3'; txt = u.trip ? 'COUPÉ' : `${Math.round(load / (u.kw * 10))} %`; sub = `de ${u.kw} kW`; alarm = u.trip || !S.feeds[b.p]; if (!S.feeds[b.p]) txt = 'en défaut'; }
    if (id.startsWith('bat')) { fill = '#f5e9c0'; txt = `${Math.round(P.batt)} min`; sub = `sur ${P.battMax}`; alarm = !P.edf && !P.genRun; }
    if (id === 'gen') { fill = P.genRun ? '#dcefe3' : '#f4f4f1'; txt = P.genRun ? 'EN MARCHE' : 'à l’arrêt'; }
    s += rr2(b.x + 0.05, b.y + 0.08, b.w, b.h, 'fill="#1c2a3a" opacity=".16" rx="2"');
    s += `<g class="rk" data-k="infra" data-id="${id}"><title>${b.label}${txt ? ' · ' + txt + (sub ? ' ' + sub : '') : ''}</title>${rr2(b.x, b.y, b.w, b.h, `fill="${fill}" stroke="${sel ? '#e8590c' : alarm ? '#e5484d' : '#7f93a8'}" stroke-width="${sel ? 3 : 1.6}" rx="2" class="${alarm ? 'pulse' : ''}"`)}<circle cx="${m(b.x + b.w - 0.13)}" cy="${m(b.y + 0.13)}" r="3" fill="${alarm ? '#e5484d' : '#2fe07f'}" stroke="#ffffff" stroke-width="1"/>`;
    s += `<text x="${m(b.x + b.w / 2)}" y="${m(b.y + Math.min(b.h / 2, 0.45))}" class="infl${sm}" text-anchor="middle">${b.label}</text><text x="${m(b.x + b.w / 2)}" y="${m(b.y + Math.min(b.h / 2, 0.45) + 0.28)}" class="infs${sm}" text-anchor="middle">${txt}</text>${sub ? `<text x="${m(b.x + b.w / 2)}" y="${m(b.y + Math.min(b.h / 2, 0.45) + 0.52)}" class="infd" text-anchor="middle">${sub}</text>` : ''}</g>`;
  }
  svg.innerHTML = s;
  if (!UI.rvb) fitRoom(svg);
}
function fitRoom(svg) {
  // Cadre la salle dans la zone libre : sous la barre d'outils, au-dessus de l'aide en bas.
  const box = svg.getBoundingClientRect(), W = box.width || 900, H = box.height || 600;
  const hint = document.getElementById('hint');
  const bar = document.getElementById('viewbar');
  const top = Math.max(58, bar ? bar.offsetTop + bar.offsetHeight + 10 : 0), bot = Math.max(hint ? hint.offsetHeight : 0, 36) + 26, side = 14;
  const x0 = -0.3 * MU, y0 = -0.25 * MU, cw = 17.0 * MU, ch = 17.5 * MU;
  const free = Math.max(120, H - top - bot), sc = Math.min((W - 2 * side) / cw, free / ch);
  const w = W / sc, h = H / sc;
  UI.rvb = { x: x0 - (w - cw) / 2, y: y0 - top / sc - (free / sc - ch) / 2, w, h };
}
