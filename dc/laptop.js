'use strict';
/* =========================================================
   Hyperscale — PC portable (fenêtre), panneaux en lecture seule
   Le portable est le seul endroit où l'on configure : PuTTY (console
   ou SSH), invite de commandes, carte réseau, navigateur.
   Les panneaux et les fenêtres ne gardent que les gestes matériels.
   ========================================================= */
UI.pc = {
  sess: null, out: [], cmd: ['Microsoft Windows [version 10.0.19045.4651]', '(c) Microsoft Corporation. Tous droits réservés.', ''],
  hist: [], hi: -1, putty: { kind: 'serial', host: '', port: '22' }, err: '', url: '', page: null, netErr: '',
};
const PC_TABS = [['desk', 'Bureau'], ['putty', 'PuTTY'], ['cmd', 'Invite de commandes'], ['net', 'Carte réseau'], ['web', 'Navigateur']];
const PC_APPS = {
  putty: { name: 'PuTTY', key: 'pc', desc: 'Console (câble) ou SSH (réseau) vers un appareil', ic: '<rect x="3" y="5" width="26" height="18" rx="2"/><path d="M8 11l4 3-4 3M15 17h6M11 27h10"/>' },
  cmd: { name: 'Invite de commandes', key: 'cmd', desc: 'ping, ipconfig, tracert', ic: '<rect x="3" y="5" width="26" height="22" rx="2"/><path d="M3 10h26M8 15l3 2.5L8 20M14 20h5"/>' },
  net: { name: 'Carte réseau', key: 'cmd', desc: 'Adresse IP du portable', ic: '<rect x="6" y="14" width="20" height="12" rx="1.5"/><path d="M10 14V9h12v5M11 20h2M15 20h2M19 20h2"/>' },
  web: { name: 'Navigateur', key: 'web', desc: 'Ouvrir le site d’un client', ic: '<circle cx="16" cy="16" r="11.5"/><path d="M4.5 16h23M16 4.5c4 4 4 19 0 23M16 4.5c-4 4-4 19 0 23"/>' },
};
// Qui débloque une fonction : « Débloqué à l'exercice … »
function lockInfo(key) {
  const c = CONTRACTS.find(x => (x.unlock || []).includes(key));
  return c ? `Débloqué à l’exercice « ${c.client} ».` : 'Débloqué plus tard dans le parcours.';
}
const pcUnlocked = app => unlocked(PC_APPS[app].key);

/* ---------- Panneaux et fenêtres sans réglage ---------- */
const CFG_ACTS = ['deploy', 'block', 'prefill', 'console', 'vmcons', 'quick', 'runcmd', 'raid', 'pcfg', 'pallow', 'pdesc', 'pw', 'vty', 'cfgport', 'addrule', 'delrule', 'syn', 'scrub', 'vm', 'vmtog', 'aclsel', 'aclnew', 'aclnewstd', 'aclmv', 'acldel', 'acladd', 'aclapply', 'wchip'];
const CFG_RE = (() => {
  const a = CFG_ACTS.join('|');
  return {
    label: new RegExp(`<label class="(?:fld|chipc)[^"]*">(?:(?!</label>)[\\s\\S])*?data-act="(?:${a})"(?:(?!</label>)[\\s\\S])*?</label>`, 'g'),
    button: new RegExp(`<button([^>]*)data-act="(?:${a})"[^>]*>((?:(?!</button>)[\\s\\S])*?)</button>`, 'g'),
    select: new RegExp(`<select[^>]*data-act="(?:${a})"[^>]*>(?:(?!</select>)[\\s\\S])*?</select>`, 'g'),
  };
})();
// Retire d'un morceau d'interface tout ce qui règle un appareil : cela se fait au terminal du portable
function noCfg(html) {
  return html.replace(CFG_RE.label, '').replace(CFG_RE.select, '')
    .replace(CFG_RE.button, (m, attrs, inner) => /class="[^"]*\b(link|vmrow)\b/.test(attrs) ? `<span class="mono">${inner}</span>` : '')
    .replace(/<tr data-act="cfgport"[^>]*>/g, '<tr>');
}
const TERM_NOTE = `<p class="note">Pour modifier : ouvre le <button class="link" data-pc="open">PC portable</button>, lance PuTTY et connecte-toi à l’appareil (console ou SSH).</p>`;
function unsavedNote(d) {
  return isIOS(d) && iosDirty(d) ? `<p class="warnbox"><b>Configuration non enregistrée.</b> Si ${esc(d.host)} redémarre, les derniers réglages sont perdus. Dans son terminal : <span class="mono">write memory</span>.</p>` : '';
}
// Carte « Port console » de la fenêtre d'un appareil : on y branche le câble du portable
function consoleCard(d) {
  if (!CAT[d.type].psu || kindOf(d) === 'rogue') return '';
  const on = S.pc.con === d.id, other = S.pc.con && !on ? dev(S.pc.con) : null;
  if (!unlocked('pc')) return `<article class="card"><h4>Port console</h4><p class="lock">${lockInfo('pc')}</p></article>`;
  let s = `<article class="card"><h4>Port console</h4><p class="muted">${on ? 'Le câble console du portable est branché ici.' : other ? `Le câble console du portable est branché sur ${esc(other.host)}.` : 'Le câble console du portable n’est branché nulle part.'} C’est l’accès de secours : il marche même sans réseau.</p><div class="btnrow">`;
  s += on ? `<button class="btn primary" data-pc="putty">Ouvrir PuTTY</button><button class="btn" data-pc="con" data-id="">Débrancher le câble console</button>` : `<button class="btn primary" data-pc="con" data-id="${d.id}">Brancher le câble console du portable</button>`;
  return s + `</div></article>`;
}
// Bouton « brancher le portable ici » sur un port cuivre libre d'un switch
function ethButton(d, pid) {
  const pd = portDef(d, pid);
  if (kindOf(d) !== 'switch' || !pd || pd.t !== 'rj45' || !unlocked('cmd')) return '';
  const here = S.pc.eth && S.pc.eth.d === d.id && S.pc.eth.p === pid;
  if (here) return `<p class="infobox">Le câble réseau du portable est branché sur ce port.</p><div class="btnrow"><button class="btn" data-pc="eth" data-id="">Débrancher le portable</button></div>`;
  if (portCable(d.id, pid)) return '';
  return `<div class="btnrow"><button class="btn" data-pc="eth" data-id="${d.id}" data-p="${esc(pid)}">Brancher le câble réseau du portable ici</button></div>`;
}

/* ---------- Onglet « État » : ce qui est réglé, sans rien pouvoir changer ---------- */
function rulesReadonly() {
  let s = `<article class="card"><h4>Règles du pare-feu</h4><p class="muted">Politique par défaut : tout refuser. Les réponses reviennent seules (pare-feu avec état).</p><table class="ptable rules"><thead><tr><th>N°</th><th>Source</th><th>Destination</th><th>Port</th></tr></thead><tbody>`;
  S.rules.forEach((r, i) => { const risk = ruleRisk(r); s += `<tr class="${risk ? 'risky' : ''}"><td class="mono">${i + 4}</td><td>${r.src}</td><td>${r.dst}</td><td class="mono">${String(r.proto).toUpperCase()} ${r.port}</td></tr>${risk ? `<tr class="risky"><td colspan="4">${esc(risk)}</td></tr>` : ''}`; });
  if (!S.rules.length) s += `<tr><td colspan="4" class="muted">Aucune règle : tout est refusé.</td></tr>`;
  s += `</tbody></table><div class="kv"><span>Limite des SYN</span><b>${S.fwopt.syn ? 'active' : 'absente'}</b><span>Adresses bloquées</span><b>${S.fwopt.block.length ? S.fwopt.block.join(', ') : 'aucune'}</b><span>Filtrage chez l’opérateur</span><b>${S.fwopt.scrub ? 'actif' : 'non'}</b></div>`;
  return s + `<p class="note">Sur le pare-feu : <span class="mono">nft -a list ruleset</span> pour voir, <span class="mono">nft add rule …</span> pour ajouter, <span class="mono">nft delete rule … handle N</span> pour retirer.</p></article>`;
}
function ifaceTable(d) {
  const ports = CAT[d.type].ports.filter(p => hasCfg(d, p));
  let s = `<article class="card"><h4>Interfaces</h4><div class="tscroll"><table class="ptable"><thead><tr><th>Port</th><th>Relié à</th><th>Mode</th><th>État</th></tr></thead><tbody>`;
  for (const p of ports) {
    const kc = cfg(d, p.id), cb = portCable(d.id, p.id), peer = cb ? otherEnd(cb, d.id, p.id) : null, pc = S.pc.eth && S.pc.eth.d === d.id && S.pc.eth.p === p.id;
    const mode = kc.mode === 'access' ? `<i class="vl" style="background:${(VLANS[kc.vlan] || {}).color || '#b8c4d0'}"></i>VLAN ${kc.vlan}` : `trunk ${kc.allowed.join(',') || '—'}`;
    s += `<tr><td><b>${esc(p.id)}</b></td><td>${pc ? 'PC portable' : peer ? esc(nameOf(dev(peer.d))) : '<span class="muted">—</span>'}</td><td>${mode}</td><td>${kc.err ? stDot('bad') + ' err' : kc.admin ? stDot(cb || pc ? 'ok' : 'off') + ' on' : stDot('down') + ' off'}</td></tr>`;
  }
  return s + `</tbody></table></div></article>`;
}
function accessCard(d) {
  const os = osOf(d);
  let rows;
  if (isIOS(d)) {
    const why = iosSshWhy(d), ip = os.svi && os.svi.ip;
    rows = [['Adresse de gestion', kindOf(d) === 'switch' ? (ip ? `${ip} (Vlan${os.svi.vlan}${os.svi.up ? '' : ', éteinte'})` : 'aucune') : 'par ses interfaces'], ['Mot de passe « enable »', os.secret ? 'posé' : 'aucun'], ['Comptes locaux', Object.keys(os.users).join(', ') || 'aucun'], ['SSH', why ? 'fermé : ' + why : 'ouvert'], ['Configuration', iosDirty(d) ? 'modifiée, non enregistrée' : 'enregistrée']];
  } else rows = [['Adresse de gestion', kindOf(d) === 'fw' ? 'la passerelle de chaque VLAN routé (ex. 10.99.0.1)' : os.ip ? `${os.ip} (${os.dev})` : 'aucune'], ['SSH', kindOf(d) === 'fw' ? 'ouvert (par clé)' : os.pw ? 'ouvert (root)' : 'fermé : root n’a pas de mot de passe']];
  return `<article class="card"><h4>Accès</h4><div class="kv">${rows.map(r => `<span>${r[0]}</span><b>${esc(r[1])}</b>`).join('')}</div></article>`;
}
function winState(w, d) {
  const k = kindOf(d);
  let s = unsavedNote(d) + accessCard(d);
  if (k === 'switch') {
    const vdb = osOf(d).vdb;
    s += `<article class="card"><h4>VLAN créés</h4><p>${Object.keys(vdb).map(v => `<span class="chipc"><i class="vl" style="background:${(VLANS[v] || {}).color || '#b8c4d0'}"></i>${v} ${esc(vdb[v])}</span>`).join(' ')}</p></article>` + ifaceTable(d);
  } else if (k === 'fw') s += ifaceTable(d) + rulesReadonly();
  else if (k === 'server') s += serverSections(d);
  else if (k === 'nas') s += storageSection(d) + `<article class="card"><h4>VM stockées ici</h4>${S.vms.filter(v => v.sto === d.id).map(v => `<p>${stDot(D.vm[v.id] ? D.vm[v.id].st : 'down')} ${esc(v.name)}</p>`).join('') || '<p class="muted">Aucune pour l’instant.</p>'}</article>`;
  else if (k === 'router') {
    s += `<article class="card"><h4>Opérateurs</h4><div class="kv"><span>Accès Internet</span><b>${D.inet.ok ? `${D.inet.ops} lien(s), ${speedName(D.inet.cap)}` : 'coupé'}</b></div>${D.inet.ok ? '' : `<p class="warnbox">${esc(D.inet.why)}</p>`}</article>`;
    s += `<article class="card"><h4>Listes de contrôle d’accès</h4><pre class="cli">${esc(runCommand({ d: d.id }, 'show access-lists'))}</pre></article>`;
  }
  return s + TERM_NOTE;
}

/* ---------- Panneau de droite : un résumé et un bouton pour ouvrir la fenêtre ---------- */
const BRIEF_T = ['dev', 'port', 'cable', 'psu', 'disk', 'vm', 'crac', 'pdu'];
function selWinSpec(s) {
  if (s.t === 'crac') return { crac: s.slot };
  if (s.t === 'infra') return { infra: s.id };
  if (s.t === 'pdu') return { x: s };
  if (s.t === 'vm') { const v = S.vms.find(x => x.id === s.id); return v ? { d: v.host, view: { t: 'vm', id: v.id } } : null; }
  if (s.t === 'cable') { const c = S.cables.find(x => x.id === s.c); return c ? { d: c.a.d, view: { t: 'cable', c: c.id } } : null; }
  if (s.t === 'port') return { d: s.d, view: { t: 'port', d: s.d, p: s.p } };
  if (s.t === 'psu') return { d: s.d, view: { t: 'psu', d: s.d, i: s.i } };
  if (s.t === 'disk') return { d: s.d, view: { t: 'disk', d: s.d, bay: s.bay } };
  return s.d ? { d: s.d } : null;
}
function equipBrief(s) {
  const open = `<button class="btn primary" data-act="xwin">Ouvrir la fenêtre</button>`;
  if (s.t === 'crac') { const c = S.cool.cracs.find(x => x.slot === s.slot); return `<article class="card"><header><div><div class="eyebrow">Climatisation de salle</div><h3>CRAC-${s.slot + 1}</h3></div>${pill(c && c.ok ? 'ok' : 'bad', c && c.ok ? CRAC_KW + ' kW' : 'En panne')}</header>${open}</article>`; }
  if (s.t === 'pdu') return `<article class="card"><header><div><div class="eyebrow">Baie ${rackName(s.r)}</div><h3>PDU ${s.p}</h3></div>${pill(pduLive(s.r, s.p) ? 'ok' : 'bad', pduLive(s.r, s.p) ? 'Sous tension' : 'Sans courant')}</header>${open}</article>`;
  if (s.t === 'vm') { const v = S.vms.find(x => x.id === s.id); if (!v) return equipSummary(); const r = D.vm[v.id] || { st: 'down' }; return `<article class="card"><header><div><div class="eyebrow">VM ${v.vmid} · ${esc(SVC[v.svc].soft)}</div><h3>${esc(v.name)}</h3></div>${pill(r.st === 'ok' ? 'ok' : r.st === 'deg' ? 'warn' : 'bad', r.st === 'ok' ? 'Opérationnelle' : r.st === 'deg' ? 'Dégradée' : 'En panne')}</header><div class="kv"><span>Réseau</span><b>VLAN ${v.vlan} · ${v.ip}</b><span>Hôte</span><b>${esc(nameOf(dev(v.host)))}</b></div>${open}</article>`; }
  const d = s.t === 'cable' ? (() => { const c = S.cables.find(x => x.id === s.c); return c ? dev(c.a.d) : null; })() : dev(s.d);
  if (!d) return equipSummary();
  const c = CAT[d.type];
  let h = `<article class="card"><header><div><div class="eyebrow">${esc(c.name)} · baie ${rackName(d.rack)}, U${d.u}</div><h3>${esc(nameOf(d))}${s.t === 'port' ? ' · ' + esc(s.p) : s.t === 'psu' ? ' · PSU' + (s.i + 1) : s.t === 'disk' ? ' · baie ' + s.bay : s.t === 'cable' ? ' · câble' : ''}</h3></div>`;
  h += c.psu ? (D.powered[d.id] ? pill(devAlarm(d) ? 'warn' : 'ok', devAlarm(d) ? 'Alarme' : 'Sous tension') : pill('bad', d.thermalOff ? 'Arrêt thermique' : 'Hors tension')) : pill('offer', 'Passif');
  h += `</header>${devThumb(d.type)}`;
  if (c.psu) h += `<div class="kv"><span>Consommation</span><b>${live(() => Math.round(D.draw[d.id] || 0) + ' W')}</b><span>Charge</span><b>${live(() => Math.round((D.util[d.id] || 0) * 100) + ' %')}</b></div>`;
  h += unsavedNote(d);
  return h + open + `<p class="note">Double-clic sur l’équipement : même fenêtre. Le matériel s’y manipule ; les réglages se font au terminal du portable.</p></article>`;
}

/* ---------- Fenêtre du portable ---------- */
const pcSay = (arr, text) => { if (text === '' || text === undefined || text === null) return; for (const l of String(text).split('\n')) arr.push(l); if (arr.length > 600) arr.splice(0, arr.length - 600); };
function pcCables() {
  const con = S.pc.con && dev(S.pc.con), eth = S.pc.eth && dev(S.pc.eth.d);
  return `<div class="kv"><span>Câble console</span><b>${con ? 'sur ' + esc(con.host) : 'non branché'}</b><span>Câble réseau</span><b>${eth ? `sur ${esc(eth.host)} ${esc(S.pc.eth.p)}` : 'non branché'}</b><span>Adresse du portable</span><b>${S.pc.dhcp ? 'automatique (DHCP)' : esc(S.pc.ip || 'aucune')}</b></div>`;
}
function pcBody(w) {
  const P = UI.pc, app = w.tab;
  if (app !== 'desk' && !pcUnlocked(app)) return `<article class="card"><h4>${PC_APPS[app].name}</h4><p class="lock">${lockInfo(PC_APPS[app].key)}</p></article>`;
  if (app === 'desk') {
    let s = `<div class="pcdesk">`;
    for (const [id, a] of Object.entries(PC_APPS)) {
      const ok = pcUnlocked(id);
      s += `<button class="pcapp ${ok ? '' : 'locked'}" data-pc="app" data-app="${id}" ${ok ? '' : 'disabled'}><svg viewBox="0 0 32 32" aria-hidden="true">${a.ic}</svg><b>${a.name}</b><span>${ok ? a.desc : lockInfo(a.key)}</span></button>`;
    }
    return s + `</div><article class="card"><h4>Câbles du portable</h4>${pcCables()}<p class="note">Le câble console se branche dans la fenêtre d’un appareil (onglet Physique, carte « Port console »). Le câble réseau se branche sur un port cuivre libre d’un switch.</p></article>`;
  }
  if (app === 'putty') {
    if (P.sess) {
      const s = P.sess, d = dev(s.d), secret = sessSecret(s);
      const title = s.via === 'serial' ? 'COM1 - PuTTY' : `${sessHost(s)} - PuTTY`;
      return `<div class="pcbar"><b>${esc(title)}</b><span class="muted">${s.via === 'serial' ? 'console de ' : 'SSH vers '}${esc(d ? d.host : '?')}</span><button class="btn small" data-pc="close">Fermer la session</button></div>${d ? unsavedNote(d) : ''}
<div class="wterm pcterm"><pre class="wout">${esc(P.out.join('\n'))}</pre><form class="wcli pcform" data-form="term" autocomplete="off"><span class="wprompt">${esc(sessPrompt(s))}</span><input ${secret ? 'type="password"' : ''} aria-label="Commande" spellcheck="false" autocapitalize="off"></form></div>
<p class="note">« ? » liste les commandes possibles. Flèches haut et bas : commandes déjà tapées.</p>`;
    }
    const k = P.putty.kind;
    let s = `<article class="card putty"><h4>PuTTY Configuration</h4><p class="muted">Choisis la destination à laquelle te connecter.</p>
<fieldset class="fld"><legend>Connection type</legend><div class="btnrow"><label class="chipc"><input type="radio" name="pk" data-pc="kind" value="serial" ${k === 'serial' ? 'checked' : ''}> Serial (câble console)</label><label class="chipc ${unlocked('ssh') ? '' : 'locked'}"><input type="radio" name="pk" data-pc="kind" value="ssh" ${k === 'ssh' ? 'checked' : ''} ${unlocked('ssh') ? '' : 'disabled'}> SSH (réseau)</label></div></fieldset>`;
    if (!unlocked('ssh')) s += `<p class="lock">SSH : ${lockInfo('ssh')}</p>`;
    s += `<form class="pcform puttyform" data-form="putty" autocomplete="off">`;
    if (k === 'serial') s += `<div class="two"><label class="fld">Serial line<input type="text" value="COM1" readonly></label><label class="fld">Speed<input type="text" value="9600" readonly></label></div>`;
    else s += `<div class="two"><label class="fld">Host Name (or IP address)<input type="text" class="p-host" value="${esc(P.putty.host)}" placeholder="10.99.0.2" spellcheck="false"></label><label class="fld">Port<input type="text" class="p-port" value="${esc(P.putty.port)}"></label></div>`;
    s += `<div class="btnrow"><button class="btn primary" type="submit">Open</button></div></form>`;
    if (P.err) s += `<p class="warnbox">${esc(P.err).replace(/\n/g, '<br>')}</p>`;
    return s + `</article><article class="card"><h4>Câbles du portable</h4>${pcCables()}</article>`;
  }
  if (app === 'cmd') return `<div class="wterm pcterm cmd"><pre class="wout">${esc(P.cmd.join('\n'))}</pre><form class="wcli pcform" data-form="cmd" autocomplete="off"><span class="wprompt">C:\\Users\\tech&gt;</span><input aria-label="Commande" spellcheck="false" autocapitalize="off"></form></div><p class="note">Commandes : <span class="mono">ipconfig</span>, <span class="mono">ping ADRESSE</span>, <span class="mono">tracert ADRESSE</span>, <span class="mono">arp -a</span>.</p>`;
  if (app === 'net') {
    const pc = S.pc, L = pcLink();
    return `<article class="card"><h4>Propriétés de : Protocole Internet version 4 (TCP/IPv4)</h4><p class="${L.ok ? 'infobox' : 'warnbox'}">${L.ok ? `Câble branché sur ${esc(L.sw.host)} ${esc(L.port)} (VLAN ${L.vlan}${VLANS[L.vlan] && VLANS[L.vlan].net ? ', réseau ' + VLANS[L.vlan].net + '.0/24' : ''}).` : esc(L.why)}</p>
<form class="pcform netform" data-form="net" autocomplete="off"><label class="fld chk"><input type="radio" name="nm" value="dhcp" ${pc.dhcp ? 'checked' : ''}> Obtenir une adresse IP automatiquement</label><label class="fld chk"><input type="radio" name="nm" value="fixe" ${pc.dhcp ? '' : 'checked'}> Utiliser l’adresse IP suivante :</label>
<div class="two"><label class="fld">Adresse IP<input type="text" class="n-ip" value="${esc(pc.ip)}" placeholder="10.99.0.50" spellcheck="false"></label><label class="fld">Masque de sous-réseau<input type="text" class="n-mask" value="${esc(pc.mask)}"></label></div>
<label class="fld">Passerelle par défaut<input type="text" class="n-gw" value="${esc(pc.gw)}" placeholder="vide si on reste dans le même réseau"></label><div class="btnrow"><button class="btn primary" type="submit">OK</button></div></form>${P.netErr ? `<p class="warnbox">${esc(P.netErr)}</p>` : ''}
<p class="note">Il n’y a pas de serveur DHCP dans la salle : l’adresse se donne à la main, dans le réseau du VLAN où le portable est branché.</p></article>`;
  }
  // navigateur
  const pg = P.page;
  let s = `<form class="pcform webbar" data-form="web" autocomplete="off"><input type="text" class="w-url" value="${esc(P.url)}" placeholder="https://172.16.10.11" aria-label="Adresse" spellcheck="false"><button class="btn" type="submit">Aller</button></form><div class="webpage ${pg ? (pg.ok ? 'ok' : 'ko') : ''}">`;
  if (!pg) s += `<p class="muted">Tape l’adresse d’un site hébergé dans la salle.</p>`;
  else s += `<h3>${esc(pg.title)}</h3><p>${esc(pg.msg)}</p>${pg.code ? `<p class="mono muted">${esc(pg.code)}</p>` : ''}`;
  return s + `</div>`;
}
function openPc(app) {
  if (!unlocked('pc')) { toast(lockInfo('pc'), 'info'); return; }
  if (!S.flags.pcOpen) { S.flags.pcOpen = true; touch(); }
  openWin({ pc: true });
  const w = WINS.find(x => x.key === 'pc');
  if (w && app && (app === 'desk' || pcUnlocked(app))) { w.tab = app; renderWins(true); pcFocus(); }
}
function pcFocus() { const w = WINS.find(x => x.key === 'pc'); if (!w) return; const i = document.querySelector(`#${w.id} .pcterm input, #${w.id} .p-host, #${w.id} .w-url`); if (i) i.focus(); }
function pcRefresh() { derive(); renderAll(); renderWins(true); pcFocus(); }
function pcOpenSession() {
  const P = UI.pc, r = P.putty.kind === 'serial' ? sessOpenSerial() : sessOpenSsh(P.putty.host.trim(), P.putty.port.trim() || '22');
  if (r.err) { P.err = r.err; SND.play('bad'); return; }
  P.err = ''; P.sess = r.s; P.out = []; P.hist = []; P.hi = -1; pcSay(P.out, r.text);
}
function pcLine(kind, line) {
  const P = UI.pc;
  if (line.trim()) { P.hist.push(line); if (P.hist.length > 100) P.hist.shift(); }
  P.hi = -1;
  if (kind === 'cmd') {
    P.cmd.push('C:\\Users\\tech>' + line);
    const r = pcCmd(line);
    if (r && r.clear) P.cmd = []; else pcSay(P.cmd, r);
    P.cmd.push('');
    return;
  }
  const s = P.sess; if (!s) return;
  const secret = sessSecret(s), d = dev(s.d), tg = s.vm ? { vm: s.vm } : { d: s.d };
  P.out.push(sessPrompt(s) + (secret ? '' : line));
  const before = s.stage, r = sessInput(s, line);
  pcSay(P.out, typeof r.out === 'string' ? r.out : '');
  if (before === 'shell' && !secret && d && typeof cmdDetect === 'function') cmdDetect(tg, line.trim());
  if (r.close) { pcSay(P.out, s.via === 'ssh' ? '\nConnection closed.' : ''); P.sess = null; P.err = s.via === 'ssh' ? 'Session fermée.' : ''; }
}
(function pcWire() {
  const box = document.getElementById('windows'); if (!box) return;
  box.addEventListener('submit', e => {
    const f = e.target.closest('.pcform'); if (!f) return;
    e.preventDefault();
    const P = UI.pc, kind = f.dataset.form;
    if (kind === 'term' || kind === 'cmd') { const i = f.querySelector('input'); pcLine(kind, i.value); i.value = ''; }
    else if (kind === 'putty') { const h = f.querySelector('.p-host'), p = f.querySelector('.p-port'); if (h) { P.putty.host = h.value; P.putty.port = p.value; } pcOpenSession(); }
    else if (kind === 'net') {
      const dhcp = f.querySelector('input[value=dhcp]').checked;
      const r = actPcNet(dhcp ? { dhcp: true } : { ip: f.querySelector('.n-ip').value.trim(), mask: f.querySelector('.n-mask').value.trim(), gw: f.querySelector('.n-gw').value.trim() });
      P.netErr = r || ''; if (!r) toast(dhcp ? 'Carte réseau en adresse automatique.' : `Carte réseau : ${S.pc.ip}.`, 'good');
    } else if (kind === 'web') { P.url = f.querySelector('.w-url').value; P.page = pcBrowse(P.url); if (P.page.ok) S.flags.sawWeb = true; touch(); }
    pcRefresh();
  });
  box.addEventListener('keydown', e => {
    if (!e.target.matches('.pcterm input')) return;
    const P = UI.pc;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (e.target.type === 'password' || !P.hist.length) return;
      e.preventDefault();
      P.hi = e.key === 'ArrowUp' ? (P.hi < 0 ? P.hist.length - 1 : Math.max(0, P.hi - 1)) : (P.hi < 0 ? -1 : P.hi + 1);
      if (P.hi >= P.hist.length) P.hi = -1;
      e.target.value = P.hi < 0 ? '' : P.hist[P.hi];
    } else if (e.key === '?' && e.target.closest('[data-form=term]') && UI.pc.sess && !sessSecret(UI.pc.sess)) {
      // comme sur un vrai Cisco : « ? » répond tout de suite et laisse la ligne en place
      const s = UI.pc.sess, d = dev(s.d);
      if (d && isIOS(d) && !s.vm && s.stage === 'shell') {
        e.preventDefault();
        const cur = e.target.value;
        P.out.push(sessPrompt(s) + cur + '?'); pcSay(P.out, cliRun(d, cur + '?'));
        const w = WINS.find(x => x.key === 'pc'); renderWins(true);
        const i = w && document.querySelector(`#${w.id} .pcterm input`); if (i) { i.value = cur; i.focus(); }
      }
    }
    e.stopPropagation();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pc]'); if (!b) return;
    const a = b.dataset.pc, P = UI.pc;
    if (a === 'open') { openPc('desk'); return; }
    if (a === 'putty') { openPc('putty'); return; }
    if (a === 'app') { openPc(b.dataset.app); return; }
    if (a === 'kind') { P.putty.kind = b.value; P.err = ''; renderWins(true); return; }
    if (a === 'close') { P.sess = null; P.err = ''; renderWins(true); return; }
    if (a === 'con') { const r = actPcConsole(b.dataset.id ? dev(b.dataset.id) : null); if (r) toast(r, 'bad'); else SND.play('plug'); if (P.sess && P.sess.via === 'serial') { P.sess = null; } pcRefresh(); return; }
    if (a === 'eth') { const r = actPcEth(b.dataset.id ? dev(b.dataset.id) : null, b.dataset.p); if (r) toast(r, 'bad'); else SND.play('plug'); pcRefresh(); return; }
  });
})();
