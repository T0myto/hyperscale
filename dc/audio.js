'use strict';
/* =========================================================
   Hyperscale — sons d'interface
   Fabriqués par le navigateur (Web Audio) : aucun fichier à charger.
   Un son = un retour sur une action : réussite, refus, alerte, contrat livré.
   ========================================================= */
const SND = (() => {
  const KEY = 'hyperscale-son';
  // Chaque note : [fréquence en Hz, départ en s, durée en s, forme d'onde, volume]
  const BANK = {
    tick: [[1250, 0, 0.03, 'triangle', 0.05]],
    plug: [[196, 0, 0.05, 'square', 0.045], [147, 0.045, 0.07, 'square', 0.04]],
    ok: [[660, 0, 0.08, 'sine', 0.09], [990, 0.07, 0.15, 'sine', 0.08]],
    bad: [[220, 0, 0.11, 'triangle', 0.1], [165, 0.1, 0.19, 'triangle', 0.09]],
    alert: [[880, 0, 0.09, 'square', 0.04], [880, 0.17, 0.09, 'square', 0.04]],
    win: [[523, 0, 0.1, 'sine', 0.09], [659, 0.09, 0.1, 'sine', 0.09], [784, 0.18, 0.1, 'sine', 0.09], [1047, 0.27, 0.3, 'sine', 0.1]],
  };
  // Quand plusieurs sons tombent en même temps, seul le plus important est joué
  const RANK = ['tick', 'plug', 'ok', 'bad', 'alert', 'win'];
  let ctx = null, out = null, on = true, queued = null, timer = 0;
  try { on = localStorage.getItem(KEY) !== '0'; } catch (e) { }

  // Les navigateurs n'autorisent le son qu'après un geste du joueur : on attend le premier clic ou la première touche
  function wake() {
    if (!on) return;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); out = ctx.createGain(); out.gain.value = 0.7; out.connect(ctx.destination); } catch (e) { ctx = null; return; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
  }
  function flush() {
    timer = 0;
    const name = queued; queued = null;
    if (!on || !ctx || ctx.state !== 'running' || !BANK[name]) return;
    const t0 = ctx.currentTime + 0.01;
    for (const [f, at, dur, wave, vol] of BANK[name]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = wave; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.linearRampToValueAtTime(vol, t0 + at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g); g.connect(out);
      o.start(t0 + at); o.stop(t0 + at + dur + 0.03);
    }
  }
  function play(name) {
    if (!on || !ctx) return;
    if (queued === null || RANK.indexOf(name) > RANK.indexOf(queued)) queued = name;
    if (!timer) timer = setTimeout(flush, 30);
  }
  function setOn(v) {
    on = !!v;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { }
    if (on) { wake(); play('ok'); }
    else if (ctx && ctx.state === 'running') ctx.suspend().catch(() => { });
    return on;
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', wake, { capture: true, passive: true });
    window.addEventListener('keydown', wake, { capture: true, passive: true });
  }
  return { play, wake, setOn, get on() { return on; }, get ready() { return !!ctx && ctx.state === 'running'; } };
})();
