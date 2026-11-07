'use strict';
/* =========================================================
   Hyperscale — la salle vue de dessus : allées, rangées,
   énergie, froid, et déplacement du technicien
   ========================================================= */
const MU = 50, WALK = 5;
UI.mode = 'room'; UI.rack = null; UI.av = { x: 1.4, y: 15.6, a: -Math.PI / 2 }; UI.path = null; UI.arrive = null; UI.layer = 'etat'; UI.rvb = null;

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
function frontOf(row, pos) { const R = slotRect(row, pos); return { x: R.x + RACK_W / 2, y: ROW_FRONT[row] > 0 ? R.y + R.h + 0.45 : R.y - 0.45 }; }
function frontPoint(r) { const k = S.racks[r]; return k.row === 'MMR' ? { x: MMR_RACK.x + 1.2 + 0.45, y: MMR_RACK.y + 0.3 } : frontOf(k.row, k.pos); }
function inside(x, y) {
  if (x > 0.15 && x < 14.45 && y > 0.15 && y < 16.25) return true;
  return x > 14.3 && x < 16.3 && y > 10.6 && y < 13.8 && (x > 14.75 || (y > 11.6 && y < 12.6));
}
function obstacles() {
  const o = WALLS.slice();
  S.racks.forEach((_, i) => o.push(rackRect(i)));
  for (const c of S.cool.cracs) o.push({ x: CRAC_SLOTS[c.slot].x, y: CRAC_SLOTS[c.slot].y, w: CRAC_W, h: CRAC_H });
  for (const [k, b] of Object.entries(INFRA)) if (k !== 'gen' || S.power.gen) o.push(b);
  return o;
}
let OBS = null, OBSKEY = '';
function obsList() {
  const key = S.racks.length + ':' + S.cool.cracs.length + ':' + S.power.gen;
  if (key !== OBSKEY) { OBS = obstacles(); OBSKEY = key; GRID = null; }
  return OBS;
}
function free(x, y, rad) {
  if (!inside(x, y)) return false;
  for (const o of obsList()) if (x > o.x - rad && x < o.x + o.w + rad && y > o.y - rad && y < o.y + o.h + rad) return false;
  return true;
}

/* ---------- Chemin le plus court (grille de 20 cm) ---------- */
const CELLM = 0.2, GW = Math.ceil(16.6 / CELLM), GH = Math.ceil(16.6 / CELLM);
let GRID = null;
function grid() {
  obsList();
  if (GRID) return GRID;
  GRID = new Uint8Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) GRID[j * GW + i] = free((i + 0.5) * CELLM, (j + 0.5) * CELLM, 0.2) ? 1 : 0;
  return GRID;
}
const cellOf = p => [Math.min(GW - 1, Math.max(0, Math.floor(p.x / CELLM))), Math.min(GH - 1, Math.max(0, Math.floor(p.y / CELLM)))];
function nearestFree(c) {
  const G = grid();
  if (G[c[1] * GW + c[0]]) return c;
  for (let r = 1; r < 25; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    const i = c[0] + di, j = c[1] + dj;
    if (i >= 0 && j >= 0 && i < GW && j < GH && G[j * GW + i]) return [i, j];
  }
  return null;
}
function lineFree(a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 0.1);
  for (let k = 1; k < n; k++) { const t = k / n; if (!free(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 0.17)) return false; }
  return true;
}
function findPath(from, to) {
  const G = grid(), s = nearestFree(cellOf(from)), g = nearestFree(cellOf(to));
  if (!s || !g) return null;
  const prev = new Int32Array(GW * GH).fill(-1), start = s[1] * GW + s[0], goal = g[1] * GW + g[0];
  const q = [start]; prev[start] = start;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let h = 0; h < q.length; h++) {
    const c = q[h]; if (c === goal) break;
    const ci = c % GW, cj = (c / GW) | 0;
    for (const [di, dj] of dirs) {
      const i = ci + di, j = cj + dj, n = j * GW + i;
      if (i < 0 || j < 0 || i >= GW || j >= GH || !G[n] || prev[n] >= 0) continue;
      if (di && dj && (!G[cj * GW + i] || !G[j * GW + ci])) continue;
      prev[n] = c; q.push(n);
    }
  }
  if (prev[goal] < 0) return null;
  const pts = [];
  for (let c = goal; c !== start; c = prev[c]) pts.unshift({ x: (c % GW + 0.5) * CELLM, y: (((c / GW) | 0) + 0.5) * CELLM });
  pts.push(to);
  // lissage : on saute les points intermédiaires quand la ligne est libre
  const out = []; let cur = { x: from.x, y: from.y }, k = 0;
  while (k < pts.length) {
    let far = k;
    for (let m = pts.length - 1; m > k; m--) if (lineFree(cur, pts[m])) { far = m; break; }
    out.push(pts[far]); cur = pts[far]; k = far + 1;
  }
  return out;
}
function walkTo(p, cb) {
  const path = findPath(UI.av, p);
  if (!path) { if (cb) cb(); return; }
  UI.path = path; UI.arrive = cb || null;
}
function moveAvatar(dt, keys) {
  let vx = 0, vy = 0;
  if (keys.has('ArrowUp') || keys.has('KeyW')) vy -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) vy += 1;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) vx -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) vx += 1;
  const av = UI.av;
  if (vx || vy) {
    UI.path = null; UI.arrive = null;
    const n = Math.hypot(vx, vy), sp = WALK * dt;
    const nx = av.x + vx / n * sp, ny = av.y + vy / n * sp;
    if (free(nx, ny, 0.2)) { av.x = nx; av.y = ny; } else if (free(nx, av.y, 0.2)) av.x = nx; else if (free(av.x, ny, 0.2)) av.y = ny;
    av.a = Math.atan2(vy, vx);
    return true;
  }
  if (!UI.path) return false;
  let rest = WALK * dt;
  while (rest > 0 && UI.path && UI.path.length) {
    const t = UI.path[0], d = Math.hypot(t.x - av.x, t.y - av.y);
    av.a = Math.atan2(t.y - av.y, t.x - av.x);
    if (d <= rest) { av.x = t.x; av.y = t.y; rest -= d; UI.path.shift(); }
    else { av.x += (t.x - av.x) / d * rest; av.y += (t.y - av.y) / d * rest; rest = 0; }
  }
  if (UI.path && !UI.path.length) { UI.path = null; const cb = UI.arrive; UI.arrive = null; if (cb) cb(); }
  return true;
}
function placeAvatar() {
  const g = document.getElementById('avatar');
  if (g) g.setAttribute('transform', `translate(${(UI.av.x * MU).toFixed(1)} ${(UI.av.y * MU).toFixed(1)}) rotate(${(UI.av.a * 180 / Math.PI).toFixed(0)})`);
}

/* ---------- Couleurs des couches ---------- */
function tempColor(t) { return t > 32 ? '#c2412f' : t > 27 ? '#c98a1c' : t > 24 ? '#4f8a52' : '#2d6a8a'; }
function rackStatus(r) {
  const list = devsIn(r).filter(d => CAT[d.type].psu);
  if (!list.length) return 'empty';
  if (list.some(d => devAlarm(d)) || (D.temp[r] || 20) > 27) return 'warn';
  return list.some(d => D.powered[d.id]) ? (list.every(d => D.powered[d.id]) ? 'ok' : 'warn') : 'off';
}

/* ---------- Rendu ---------- */
const ROOM_DEFS = `<defs>
<pattern id="tiles" width="${0.6 * MU}" height="${0.6 * MU}" patternUnits="userSpaceOnUse"><rect width="${0.6 * MU}" height="${0.6 * MU}" fill="#141d23"/><rect x=".8" y=".8" width="${0.6 * MU - 1.6}" height="${0.6 * MU - 1.6}" fill="#18232a"/></pattern>
<pattern id="perf" width="${0.6 * MU}" height="${0.6 * MU}" patternUnits="userSpaceOnUse"><rect width="${0.6 * MU}" height="${0.6 * MU}" fill="#122837"/>${[6, 12, 18, 24].map(a => [6, 12, 18, 24].map(b => `<circle cx="${a}" cy="${b}" r="1.6" fill="#1d4a62"/>`).join('')).join('')}</pattern>
<pattern id="gravel" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#1a1d18"/><circle cx="3" cy="4" r="1" fill="#2a2f27"/><circle cx="9" cy="9" r="1.2" fill="#262a22"/></pattern>
<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#10171c"/><rect width="3" height="8" fill="#1a232a"/></pattern>
</defs>`;
const m = v => (v * MU).toFixed(1);
function rr2(x, y, w, h, extra) { return `<rect x="${m(x)}" y="${m(y)}" width="${m(w)}" height="${m(h)}" ${extra || ''}/>`; }
function renderRoom(svg) {
  let s = ROOM_DEFS;
  s += `<rect x="-60" y="-60" width="${17 * MU + 120}" height="${16.6 * MU + 120}" fill="#05080a"/>`;
  // cour et bâtiment
  s += rr2(14.6, 10.6, 1.8, 3.2, 'fill="url(#gravel)" stroke="#2c3329"');
  s += `<text x="${m(15.5)}" y="${m(10.45)}" class="rl" text-anchor="middle">Cour</text>`;
  s += rr2(0, 0, 14.6, 16.4, 'fill="url(#tiles)" stroke="#55646e" stroke-width="7"');
  s += rr2(14.5, 11.6, 0.2, 1.0, 'fill="#18232a"');
  s += rr2(0.6, 16.3, 1.6, 0.2, 'fill="#18232a"');
  s += `<text x="${m(1.4)}" y="${m(16.95)}" class="rl" text-anchor="middle">Entrée</text>`;
  // allées
  for (const a of AISLES) {
    const x0 = ROW_X0 - 0.5, w = NPOS * RACK_W + 1.0;
    s += `<g data-k="aisle" data-id="${a.id}"><title>${a.cold ? 'Allée froide' : 'Allée chaude'} ${a.id}${a.cold && S.cool.contain[a.id] ? ' (confinée)' : ''}</title>`;
    s += rr2(x0, a.y, w, 1.2, a.cold ? 'fill="url(#perf)"' : 'fill="#2a1d18" opacity=".85"');
    s += `<text x="${m(x0 + w / 2)}" y="${m(a.y + 0.68)}" class="${a.cold ? 'acold' : 'ahot'}" text-anchor="middle">${a.cold ? 'ALLÉE FROIDE' : 'ALLÉE CHAUDE'} ${a.id}</text>`;
    if (a.cold && S.cool.contain[a.id]) s += rr2(ROW_X0 - 0.05, a.y - 0.04, NPOS * RACK_W + 0.1, 1.28, 'fill="rgba(70,199,255,.08)" stroke="#46c7ff" stroke-width="2" stroke-dasharray="6 4"') + rr2(ROW_X0 - 0.1, a.y, 0.08, 1.2, 'fill="#46c7ff"') + rr2(ROW_X0 + NPOS * RACK_W + 0.02, a.y, 0.08, 1.2, 'fill="#46c7ff"');
    s += `</g>`;
  }
  // gaines à barres et chemins de câbles (en hauteur)
  for (const row of ROWS) {
    if (!S.power.rows[row]) continue;
    const back = ROW_FRONT[row] > 0 ? ROW_Y[row] - 0.12 : ROW_Y[row] + RACK_D + 0.04;
    s += rr2(ROW_X0 - 0.2, back, NPOS * RACK_W + 0.4, 0.035, 'fill="#c24848" opacity=".85"') + rr2(ROW_X0 - 0.2, back + 0.05, NPOS * RACK_W + 0.4, 0.035, 'fill="#3c6fc4" opacity=".85"');
  }
  for (const row of ROWS) s += rr2(ROW_X0 - 0.7, ROW_Y[row] + 0.55, NPOS * RACK_W + 1.4, 0.1, 'fill="#f2c230" opacity=".22"');
  s += rr2(ROW_X0 - 0.75, ROW_Y.A + 0.55, 0.1, ROW_Y.F - ROW_Y.A + 0.1, 'fill="#f2c230" opacity=".22"');
  s += rr2(2.6, 8.75, ROW_X0 - 0.7 - 2.6 + 0.1, 0.1, 'fill="#f2c230" opacity=".3"');
  // rangées
  for (const row of ROWS) {
    const powered = !!S.power.rows[row];
    s += `<text x="${m(ROW_X0 - 0.25)}" y="${m(ROW_Y[row] + 0.72)}" class="rowl" text-anchor="end">${row}</text>`;
    const rowEnd = () => !powered ? `<text x="${m(ROW_X0 + NPOS * RACK_W / 2)}" y="${m(ROW_Y[row] + 0.68)}" class="rowoff" text-anchor="middle" pointer-events="none">RANGÉE ${row} NON ÉLECTRIFIÉE</text>` : '';
    for (let pos = 1; pos <= NPOS; pos++) {
      const r = rackAt(row, pos), R = slotRect(row, pos);
      const sel = UI.sel && ((UI.sel.t === 'slot' && UI.sel.row === row && UI.sel.pos === pos) || (UI.sel.t === 'rack' && UI.sel.r === r && r >= 0));
      if (r < 0) {
        s += `<g class="eslot${powered ? '' : ' off'}" data-k="eslot" data-row="${row}" data-pos="${pos}"><title>${row}${String(pos).padStart(2, '0')} : emplacement libre${powered ? '' : ' (rangée non électrifiée)'}</title>${rr2(R.x + 0.03, R.y + 0.03, R.w - 0.06, R.h - 0.06, `fill="${powered ? 'transparent' : 'url(#hatch)'}" stroke="${sel ? '#ffb547' : '#33434d'}" stroke-width="${sel ? 3 : 1.4}" stroke-dasharray="5 4"`)}<text x="${m(R.x + R.w / 2)}" y="${m(R.y + R.h / 2 + 0.07)}" class="plusr" text-anchor="middle">+</text></g>`;
        continue;
      }
      const k = S.racks[r];
      if (k.kind === 'inrow') {
        s += `<g class="rk" data-k="inrow" data-r="${r}"><title>Climatiseur en rangée ${rackName(r)} · ${INROW_KW} kW</title>${rr2(R.x + 0.02, R.y + 0.02, R.w - 0.04, R.h - 0.04, `fill="#1d3a4f" stroke="${sel ? '#ffb547' : '#46c7ff'}" stroke-width="2"`)}<circle cx="${m(R.x + R.w / 2)}" cy="${m(R.y + R.h / 2)}" r="${m(0.2)}" fill="none" stroke="#9fe0ff" stroke-width="2"/><text x="${m(R.x + R.w / 2)}" y="${m(R.y + R.h / 2 + 0.06)}" class="rkl" text-anchor="middle">IR</text></g>`;
        continue;
      }
      const st = rackStatus(r), t = D.temp[r] || 20, kw = (D.rackW[r] || 0) / 1000;
      const fill = UI.layer === 'chaleur' ? tempColor(t) : UI.layer === 'energie' ? `rgba(255,181,71,${Math.min(0.9, 0.12 + kw / 6)})` : '#1f2a31';
      const n = devsIn(r).filter(d => !['blank', 'cm', 'rogue'].includes(kindOf(d))).length;
      const fy = ROW_FRONT[row] > 0 ? R.y + R.h - 0.07 : R.y + 0.02;
      s += `<g class="rk" data-k="rk" data-r="${r}"><title>${esc(`Baie ${rackName(r)} · ${n} équipement(s) · ${kw.toFixed(2)} kW · ${t.toFixed(1)} °C en entrée`)}</title>`;
      s += rr2(R.x + 0.02, R.y + 0.02, R.w - 0.04, R.h - 0.04, `fill="${fill}" stroke="${sel ? '#ffb547' : '#4a5d69'}" stroke-width="${sel ? 3 : 1.6}" rx="3"`);
      s += rr2(R.x + 0.06, fy, R.w - 0.12, 0.05, 'fill="#7fd6ff"');
      s += `<text x="${m(R.x + R.w / 2)}" y="${m(R.y + R.h / 2 - 0.05)}" class="rkl" text-anchor="middle">${rackName(r)}</text>`;
      s += `<text x="${m(R.x + R.w / 2)}" y="${m(R.y + R.h / 2 + 0.2)}" class="rks" text-anchor="middle">${n ? n + ' éq.' : 'vide'}</text>`;
      const col = { ok: '#3ce07a', warn: '#ffb547', off: '#ff6b5d', empty: '#56636b' }[st];
      s += `<circle cx="${m(R.x + R.w / 2)}" cy="${m(ROW_FRONT[row] > 0 ? R.y + 0.18 : R.y + R.h - 0.18)}" r="4" fill="${col}" class="${st === 'off' || st === 'warn' ? 'pulse' : ''}"/>`;
      s += `</g>`;
    }
    s += rowEnd();
  }
  // climatiseurs de salle
  CRAC_SLOTS.forEach((p, i) => {
    const c = S.cool.cracs.find(x => x.slot === i);
    const sel = UI.sel && (UI.sel.t === 'crac' || UI.sel.t === 'cracslot') && UI.sel.slot === i;
    if (c) {
      s += `<g class="rk" data-k="crac" data-slot="${i}"><title>CRAC-${i + 1} · ${CRAC_KW} kW · ${c.ok ? 'en service' : 'EN PANNE'}</title>${rr2(p.x, p.y, CRAC_W, CRAC_H, `fill="${c.ok ? '#c9d6dc' : '#5a3a36'}" stroke="${sel ? '#ffb547' : c.ok ? '#7d8d96' : '#ff6b5d'}" stroke-width="${sel ? 3 : 2}" rx="4" class="${c.ok ? '' : 'pulse'}"`)}`;
      s += `<circle cx="${m(p.x + 0.45)}" cy="${m(p.y + CRAC_H / 2)}" r="${m(0.26)}" fill="#2a343a"/><g class="${c.ok ? 'spin' : ''}" style="transform-origin:${m(p.x + 0.45)}px ${m(p.y + CRAC_H / 2)}px">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="${m(p.x + 0.45 + 0.12)}" cy="${m(p.y + CRAC_H / 2)}" rx="${m(0.11)}" ry="${m(0.045)}" fill="#cfdbe1" transform="rotate(${a} ${m(p.x + 0.45)} ${m(p.y + CRAC_H / 2)})"/>`).join('')}</g>`;
      s += `<text x="${m(p.x + 1.25)}" y="${m(p.y + 0.36)}" class="crl" text-anchor="middle">CRAC-${i + 1}</text><text x="${m(p.x + 1.25)}" y="${m(p.y + 0.62)}" class="crs" text-anchor="middle">${c.ok ? CRAC_KW + ' kW' : 'en panne'}</text></g>`;
    } else s += `<g class="eslot" data-k="cracslot" data-slot="${i}"><title>Emplacement pour un climatiseur de salle</title>${rr2(p.x, p.y, CRAC_W, CRAC_H, `fill="transparent" stroke="${sel ? '#ffb547' : '#33434d'}" stroke-width="${sel ? 3 : 1.4}" stroke-dasharray="5 4" rx="4"`)}<text x="${m(p.x + CRAC_W / 2)}" y="${m(p.y + CRAC_H / 2 + 0.07)}" class="plusr" text-anchor="middle">+ CRAC</text></g>`;
  });
  // salle opérateurs
  s += rr2(0.15, 5.3, 2.35, 4.65, 'fill="#101b22"');
  s += `<text x="${m(1.3)}" y="${m(5.75)}" class="rl" text-anchor="middle">Salle opérateurs</text><text x="${m(1.3)}" y="${m(6.1)}" class="rl" text-anchor="middle">(MMR)</text>`;
  s += `<path d="M0 ${m(7.15)} H${m(MMR_RACK.x)}" stroke="#f2c230" stroke-width="3"/>${S.room.op2 ? `<path d="M0 ${m(7.45)} H${m(MMR_RACK.x)}" stroke="#f2c230" stroke-width="3"/>` : ''}`;
  s += `<text x="${m(0.08)}" y="${m(6.95)}" class="opr">op. 1${S.room.op2 ? ' et 2' : ''}</text>`;
  {
    const R = rackRect(0), sel = UI.sel && UI.sel.t === 'rack' && UI.sel.r === 0;
    s += `<g class="rk" data-k="rk" data-r="0"><title>ODF : arrivée des fibres opérateurs (clique pour l'ouvrir)</title>${rr2(R.x, R.y, R.w, R.h, `fill="#c9d1d6" stroke="${sel ? '#ffb547' : '#7d8890'}" stroke-width="${sel ? 3 : 2}" rx="3"`)}${rr2(R.x + R.w - 0.06, R.y + 0.05, 0.05, R.h - 0.1, 'fill="#7fd6ff"')}<text x="${m(R.x + R.w / 2)}" y="${m(R.y + 0.38)}" class="odfr" text-anchor="middle">ODF</text></g>`;
  }
  // local électrique
  s += rr2(11.5, 1.7, 3.0, 13.0, 'fill="#14191d"');
  s += `<text x="${m(13.0)}" y="${m(14.3)}" class="rl" text-anchor="middle">Local électrique</text>`;
  const P = S.power;
  for (const [id, b] of Object.entries(INFRA)) {
    if (id === 'gen' && !P.gen) { s += `<g class="eslot" data-k="infra" data-id="gen"><title>Emplacement du groupe électrogène</title>${rr2(b.x, b.y, b.w, b.h, 'fill="transparent" stroke="#4a5530" stroke-width="1.6" stroke-dasharray="5 4" rx="4"')}<text x="${m(b.x + b.w / 2)}" y="${m(b.y + b.h / 2)}" class="plusr" text-anchor="middle">+ GE</text></g>`; continue; }
    const sel = UI.sel && UI.sel.t === 'infra' && UI.sel.id === id;
    let fill = '#2a343a', txt = '', alarm = false;
    if (id === 'tgbt') { fill = '#3a4046'; txt = P.edf ? 'EDF OK' : 'EDF coupé'; alarm = !P.edf; }
    if (id.startsWith('ups')) { const u = P.ups[b.p], load = (D.ups || {})[b.p] || 0; fill = u.trip ? '#5a2a2a' : '#2b3a2f'; txt = u.trip ? 'COUPÉ' : `${Math.round(load / (u.kw * 10))} % de ${u.kw} kW`; alarm = u.trip || !S.feeds[b.p]; if (!S.feeds[b.p]) txt = 'en défaut'; }
    if (id.startsWith('bat')) { fill = '#23292e'; txt = `${Math.round(P.batt)} / ${P.battMax} min`; alarm = !P.edf && !P.genRun; }
    if (id === 'gen') { fill = P.genRun ? '#3e5a2a' : '#2f3820'; txt = P.genRun ? 'EN MARCHE' : 'à l’arrêt'; }
    s += `<g class="rk" data-k="infra" data-id="${id}"><title>${b.label}${txt ? ' · ' + txt : ''}</title>${rr2(b.x, b.y, b.w, b.h, `fill="${fill}" stroke="${sel ? '#ffb547' : alarm ? '#ff6b5d' : '#5d6a72'}" stroke-width="${sel ? 3 : 2}" rx="4" class="${alarm ? 'pulse' : ''}"`)}`;
    s += `<text x="${m(b.x + b.w / 2)}" y="${m(b.y + Math.min(b.h / 2, 0.45))}" class="infl" text-anchor="middle">${b.label}</text><text x="${m(b.x + b.w / 2)}" y="${m(b.y + Math.min(b.h / 2, 0.45) + 0.28)}" class="infs" text-anchor="middle">${txt}</text></g>`;
  }
  // technicien
  s += `<g id="avatar" pointer-events="none"><circle r="${m(0.24)}" fill="#ffb547" stroke="#1b1306" stroke-width="3"/><path d="M${m(0.12)} -${m(0.1)} L${m(0.3)} 0 L${m(0.12)} ${m(0.1)} Z" fill="#1b1306"/><circle r="${m(0.1)}" fill="#fff6e0"/></g>`;
  if (UI.path && UI.path.length) s += `<path d="M${m(UI.av.x)} ${m(UI.av.y)} ${UI.path.map(p => `L${m(p.x)} ${m(p.y)}`).join(' ')}" fill="none" stroke="#ffb547" stroke-width="2" stroke-dasharray="4 6" opacity=".6" pointer-events="none"/>`;
  svg.innerHTML = s;
  if (!UI.rvb) fitRoom(svg);
  placeAvatar();
}
function fitRoom(svg) {
  const box = svg.getBoundingClientRect(), aspect = (box.width || 900) / (box.height || 600);
  const tw = 16.8 * MU, th = 19.4 * MU;
  let w = tw, h = th;
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  UI.rvb = { x: -0.2 * MU - (w - tw) / 2, y: -1.1 * MU - (h - th) / 2, w, h };
}
