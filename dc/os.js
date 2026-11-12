'use strict';
/* =========================================================
   Hyperscale — systèmes des appareils et PC portable
   - IOS : modes (> # config), comptes, SSH, VLAN, adresse de gestion,
     configuration de démarrage (write memory), aide « ? » selon le contexte
   - Linux : vraies commandes de réglage (ip, mdadm, qm, nft)
   - Portable : carte réseau, ping, sessions console et SSH
   Tous les réglages passent par les actions de actions.js.
   ========================================================= */

/* ---------- État système d'un appareil ---------- */
function osOf(d) {
  if (!d.os) {
    d.os = isIOS(d)
      ? { secret: null, users: {}, domain: '', keys: false, vty: { ssh: false, local: false, pw: null }, con: { pw: null }, svi: null, gw: null, vdb: { 1: 'default' }, saved: null }
      : { ip: null, dev: null, pw: null };
    if (isIOS(d)) d.os.saved = iosSnap(d);
  }
  return d.os;
}
const ipOk = ip => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(ip || '') && ip.split('.').every(n => +n <= 255);
// VLAN du plan d'adressage auquel appartient une adresse (réseaux en /24)
function vlanOfIp(ip) { for (const v of VLAN_IDS) if (VLANS[v].net && String(ip).startsWith(VLANS[v].net + '.')) return v; return null; }
const maskOk = m => ['255.255.255.0', '255.255.0.0', '255.0.0.0', '255.255.255.128', '255.255.255.192', '255.255.255.224', '255.255.255.240', '255.255.255.248', '255.255.255.252'].includes(m);

/* ---------- IOS : configuration en cours et configuration de démarrage ---------- */
function iosSnap(d) {
  const o = Object.assign({}, d.os || {}); delete o.saved;
  return JSON.stringify({ host: d.host, cfg: d.cfg, os: o, acl: d.acl || null, vty: d.vty || null });
}
const iosDirty = d => isIOS(d) && osOf(d).saved !== iosSnap(d);
function iosSave(d) { osOf(d).saved = iosSnap(d); }
// Redémarrage : l'appareil repart de sa configuration enregistrée
function iosReload(d) {
  const os = osOf(d), s = JSON.parse(os.saved);
  d.host = s.host; d.cfg = s.cfg;
  if (s.acl) d.acl = s.acl; else delete d.acl;
  if (s.vty) d.vty = s.vty; else delete d.vty;
  d.os = Object.assign(s.os, { saved: os.saved });
  delete CLIM[d.id];
  touch();
}
// Appelé à chaque pas de simulation : un appareil Cisco qui perd le courant oublie ce qui n'était pas enregistré
function osTick() {
  for (const d of Object.values(S.devs)) {
    if (!isIOS(d)) continue;
    const up = !!D.powered[d.id];
    if (d.up === true && !up && iosDirty(d)) {
      iosReload(d);
      logEvent(`${d.host} a redémarré : la configuration non enregistrée (sans « write memory ») est perdue.`, 'bad');
    }
    if (d.up === true && !up) delete CLIM[d.id];
    d.up = up;
  }
  const pc = S.pc;
  if (pc && pc.con && !dev(pc.con)) pc.con = null;
  if (pc && pc.eth && !dev(pc.eth.d)) pc.eth = null;
}
function sviLine(d) {
  const s = osOf(d).svi; if (!s) return null;
  return pad('Vlan' + s.vlan, 23) + pad(s.ip || 'unassigned', 16) + 'YES ' + pad(s.ip ? 'manual' : 'unset', 7) + (s.up ? pad('up', 22) + 'up' : pad('administratively down', 22) + 'down');
}
function iosRunning(d) {
  const os = osOf(d), o = ['Building configuration...', '', 'Current configuration:', '!', 'version 15.2', 'service timestamps log datetime msec', '!', `hostname ${d.host}`, '!'];
  if (os.secret) o.push('enable secret 5 $1$mERr$' + hhash(os.secret).toString(36), '!');
  for (const u of Object.keys(os.users)) o.push(`username ${u} privilege 15 secret 5 $1$${hhash(u + os.users[u]).toString(36)}`);
  if (os.domain) o.push(`ip domain-name ${os.domain}`);
  if (os.keys) o.push('ip ssh version 2');
  o.push('!');
  if (kindOf(d) === 'switch') {
    for (const v of Object.keys(os.vdb)) if (+v !== 1) o.push(`vlan ${v}`, ` name ${os.vdb[v]}`, '!');
    for (const p of CAT[d.type].ports) {
      if (!d.cfg[p.id]) continue;
      const kc = cfg(d, p.id);
      if (kc.mode === 'access' && kc.vlan === 1 && kc.admin && !kc.desc && !kc.psec && !kc.bpdu) continue;
      o.push(`interface ${longIf(p.id)}`);
      if (kc.desc) o.push(` description ${kc.desc}`);
      if (kc.mode === 'access') { if (kc.vlan !== 1) o.push(' switchport mode access', ` switchport access vlan ${kc.vlan}`); }
      else o.push(' switchport mode trunk', ` switchport trunk native vlan ${kc.native}`, ` switchport trunk allowed vlan ${kc.allowed.join(',') || 'none'}`);
      if (kc.psec) o.push(' switchport port-security');
      if (kc.bpdu) o.push(' spanning-tree portfast', ' spanning-tree bpduguard enable');
      if (!kc.admin) o.push(' shutdown');
      o.push('!');
    }
    if (os.svi) { o.push(`interface Vlan${os.svi.vlan}`, os.svi.ip ? ` ip address ${os.svi.ip} ${os.svi.mask}` : ' no ip address'); if (!os.svi.up) o.push(' shutdown'); o.push('!'); }
    if (os.gw) o.push(`ip default-gateway ${os.gw}`, '!');
  } else if (d.acl) {
    for (const [n, L] of Object.entries(d.acl.lists || {})) { o.push(/^\d+$/.test(n) ? `! access-list ${n} (${L.length} ligne(s)) : show access-lists` : `ip access-list extended ${n}`, '!'); }
  }
  o.push('line con 0');
  if (os.con.pw) o.push(' password 7 ' + hhash(os.con.pw).toString(16), ' login');
  o.push('line vty 0 4');
  const tr = kindOf(d) === 'router' && d.vty ? d.vty.transport : (os.vty.ssh ? 'ssh' : null);
  if (os.vty.local) o.push(' login local');
  if (tr) o.push(` transport input ${tr === 'all' ? 'telnet ssh' : tr}`);
  if (d.vty && d.vty.acl) o.push(` access-class ${d.vty.acl} in`);
  o.push('!', 'end');
  return o.join('\n');
}
// SSH ouvert sur un appareil IOS : clés générées, un compte local, lignes VTY en « login local » et « transport input ssh »
function iosSshWhy(d) {
  const os = osOf(d);
  if (!os.keys) return 'aucune clé RSA (crypto key generate rsa)';
  if (!Object.keys(os.users).length) return 'aucun compte local (username … secret …)';
  if (!os.vty.local) return 'les lignes VTY ne demandent pas de compte (login local)';
  const tr = kindOf(d) === 'router' && d.vty ? d.vty.transport : (os.vty.ssh ? 'ssh' : 'none');
  if (tr !== 'ssh' && tr !== 'all') return 'les lignes VTY n’acceptent pas SSH (transport input ssh)';
  return null;
}

/* ---------- Aide « ? » selon le contexte ---------- */
const USER_CMDS = [{ p: 'enable', h: 'passer en mode privilégié (#)' }, { p: 'show <rest>', h: 'afficher un état' }, { p: 'ping <rest>', h: 'tester une adresse' }, { p: 'exit', h: 'fermer la session' }];
const EXEC_EXTRA = [{ p: 'configure terminal', h: 'entrer en mode configuration' }, { p: 'write memory', h: 'enregistrer la configuration (survit au redémarrage)' }, { p: 'copy running-config startup-config', h: 'enregistrer la configuration' },
  { p: 'show running-config', h: 'configuration en cours' }, { p: 'show startup-config', h: 'configuration enregistrée' }, { p: 'show ip ssh', h: 'état du serveur SSH' }, { p: 'ping <rest>', h: 'tester une adresse' },
  { p: 'reload', h: 'redémarrer l’équipement' }, { p: 'disable', h: 'revenir en mode utilisateur (>)' }, { p: 'exit', h: 'fermer la session' }];
const GLOBAL_EXTRA = [
  { p: 'hostname <rest>', h: 'nom de l’équipement' }, { p: 'enable secret <rest>', h: 'mot de passe du mode privilégié (chiffré)' }, { p: 'no enable secret', h: 'retire ce mot de passe' },
  { p: 'username <rest>', h: 'compte local : username admin secret MOTDEPASSE' }, { p: 'no username <rest>', h: 'supprime un compte' },
  { p: 'ip domain-name <rest>', h: 'nom de domaine, nécessaire aux clés SSH' }, { p: 'crypto key generate rsa <rest?>', h: 'génère les clés du serveur SSH' }, { p: 'ip ssh version 2', h: 'impose SSH version 2' },
  { p: 'line vty <rest>', h: 'accès à distance : line vty 0 4' }, { p: 'line console 0', h: 'port console' },
  { p: 'service password-encryption', h: 'chiffre les mots de passe en clair' }, { p: 'no ip domain-lookup', h: 'ne cherche pas un nom quand une commande est mal tapée' }, { p: 'banner motd <rest>', h: 'message affiché à la connexion' }];
const SW_GLOBAL = [{ p: 'vlan <n>', h: 'crée un VLAN ou entre dedans' }, { p: 'no vlan <n>', h: 'supprime un VLAN' }, { p: 'interface vlan <n>', h: 'interface de gestion du switch (adresse IP)' }, { p: 'ip default-gateway <rest>', h: 'passerelle du switch' }];
const VLAN_CMDS = [{ p: 'name <rest>', h: 'nom du VLAN' }, { p: 'exit', h: 'revenir en arrière' }];
const SVI_CMDS = [{ p: 'ip address <rest>', h: 'adresse et masque : ip address 10.99.0.2 255.255.255.0' }, { p: 'no ip address', h: 'retire l’adresse' }, { p: 'no shutdown', h: 'active l’interface' }, { p: 'shutdown', h: 'désactive l’interface' }, { p: 'description <rest>', h: 'note libre' }];
const SWLINE_CMDS = [{ p: 'transport input <rest>', h: 'protocoles acceptés : ssh, telnet, all, none' }, { p: 'login local', h: 'demande un compte local (username)' }, { p: 'login', h: 'demande le mot de passe de la ligne' }, { p: 'password <rest>', h: 'mot de passe de la ligne' },
  { p: 'exec-timeout <rest>', h: 'ferme une session inactive' }, { p: 'logging synchronous', h: 'les messages ne coupent plus la saisie' }];
function modeCmds(d) {
  const st = cliState(d), sw = kindOf(d) === 'switch';
  if (st.mode === 'user') return USER_CMDS;
  if (st.mode === 'exec') return cmdList({ d: d.id }).map(x => ({ p: x.c, h: x.hint || '' })).concat(EXEC_EXTRA);
  if (st.mode === 'config') return confCmds(d).filter(c => c.p !== 'vlan <n>' && c.p !== 'hostname <rest>' && c.p !== 'line vty <rest>').concat(GLOBAL_EXTRA, sw ? SW_GLOBAL : [], [{ p: 'end', h: 'revenir au mode privilégié' }, { p: 'exit', h: 'revenir en arrière' }, { p: 'do <rest>', h: 'lancer une commande du mode privilégié' }]);
  if (st.mode === 'vlan') return VLAN_CMDS.concat([{ p: 'end', h: 'revenir au mode privilégié' }]);
  if (st.mode === 'line') return SWLINE_CMDS.concat(kindOf(d) === 'router' ? LINE_CMDS.filter(c => c.p.includes('access-class')) : [], [{ p: 'exit', h: 'revenir en arrière' }, { p: 'end', h: 'revenir au mode privilégié' }]);
  if (st.mode === 'if' && st.svi) return SVI_CMDS.concat([{ p: 'exit', h: 'revenir en arrière' }, { p: 'end', h: 'revenir au mode privilégié' }]);
  if (st.mode === 'if') return (sw ? IF_CMDS : RIF_CMDS).concat([{ p: 'exit', h: 'revenir en arrière' }, { p: 'end', h: 'revenir au mode privilégié' }]);
  return [{ p: 'exit', h: 'revenir en arrière' }, { p: 'end', h: 'revenir au mode privilégié' }];
}
const tokName = t => t === '<n>' ? '<1-4094>' : t === '<rest>' || t === '<rest?>' ? 'LINE' : t;
// « sh? » complète un mot ; « switchport ? » liste les mots possibles ensuite
function iosHelp(d, before) {
  const list = modeCmds(d), partial = before.length && !before.endsWith(' ');
  const tk = before.trim().toLowerCase().split(' ').filter(Boolean), fixed = partial ? tk.slice(0, -1) : tk, last = partial ? tk[tk.length - 1] : '';
  const seen = new Map();
  for (const c of list) {
    const pt = c.p.split(' ');
    let ok = pt.length > fixed.length;
    for (let i = 0; ok && i < fixed.length; i++) {
      const p = pt[i];
      if (p[0] === '<') { if (p.startsWith('<rest')) { ok = false; } continue; }
      if (p[0] === '{') { if (!p.slice(1, -1).split('|').some(x => x.startsWith(fixed[i]))) ok = false; continue; }
      if (!p.toLowerCase().startsWith(fixed[i])) ok = false;
    }
    if (!ok) continue;
    const nx = pt[fixed.length], opts = nx[0] === '{' ? nx.slice(1, -1).split('|') : [nx];
    for (const o of opts) {
      if (last && (o[0] === '<' || !o.toLowerCase().startsWith(last))) continue;
      const end = pt.length === fixed.length + 1;
      if (!seen.has(o) || (end && !seen.get(o))) seen.set(o, end ? c.h : (seen.get(o) || ''));
    }
  }
  if (!seen.size) return '% Unrecognized command';
  const keys = [...seen.keys()].sort((a, b) => (a[0] === '<') - (b[0] === '<') || a.localeCompare(b));
  if (partial) return keys.map(tokName).join('  ');
  return keys.map(k => '  ' + pad(tokName(k), 26) + (seen.get(k) || '')).join('\n') + (fixed.length && list.some(c => c.p.split(' ').length === fixed.length && matchGrammar([c], fixed.join(' '))) ? '\n  <cr>' : '');
}

/* ---------- IOS : la ligne de commande complète ---------- */
const BAD = '% Invalid input detected at \'^\' marker.';
function cliRun(d, input) {
  const raw = input.replace(/\s+/g, ' ').trim();
  if (!isIOS(d)) return linuxRun(d, raw);
  const st = cliState(d), os = osOf(d);
  if (st.mode !== 'if') st.svi = null;
  if (input.trim().endsWith('?')) return iosHelp(d, input.replace(/^\s+/, '').replace(/\?\s*$/, '').replace(/\s+/g, ' '));
  if (!raw) return '';
  const low = raw.toLowerCase(), sw = kindOf(d) === 'switch';
  const is = (...pats) => pats.some(p => matchGrammar([{ p }], low));
  if (st.mode === 'user') {
    if (is('enable')) { st.mode = 'exec'; if (!S.flags.en) { S.flags.en = true; touch(); } return ''; }
    if (is('exit', 'logout', 'quit')) return '';
    if (low.startsWith('sh')) return iosShow(d, raw) || cliCore(d, raw);
    if (low.startsWith('ping ')) return devPing(d, raw.split(' ')[1]);
    if (/^conf/.test(low)) return BAD + '\n! En mode utilisateur (>), on ne peut que regarder. Tape « enable ».';
    return BAD;
  }
  if (st.mode === 'exec') {
    if (is('disable')) { st.mode = 'user'; return ''; }
    if (is('write memory', 'write', 'copy running-config startup-config')) { iosSave(d); S.flags.wr = true; touch(); return 'Building configuration...\n[OK]'; }
    if (is('reload')) { const lost = iosDirty(d); iosReload(d); return (lost ? 'System configuration has been modified and not saved: changes are lost.\n' : '') + 'Reload requested. Restarting...\n\nPress RETURN to get started.'; }
    if (is('erase startup-config', 'write erase')) return '% Dans cette salle, on ne remet pas un équipement en configuration d’usine.';
    if (low.startsWith('ping ')) return devPing(d, raw.split(' ')[1]);
    const sh = iosShow(d, raw); if (sh) return sh;
    const out = cliCore(d, raw);
    return /^% Commande inconnue/.test(out) ? BAD : out;
  }
  if (low.startsWith('do ')) { const keep = st.mode; st.mode = 'exec'; const out = cliRun(d, raw.slice(3)); if (cliState(d).mode === 'exec') cliState(d).mode = keep; return out; }
  if (st.mode === 'config') {
    let m;
    if ((m = raw.match(/^ho\w* (\S+)$/i)) && is('hostname <rest>')) {
      if (!/^[A-Za-z][A-Za-z0-9-]{0,30}$/.test(m[1])) return '% Hostname contains one or more illegal characters.';
      d.host = m[1]; touch(); return '';
    }
    if (is('enable secret <rest>', 'enable password <rest>')) { os.secret = raw.split(' ').slice(2).join(' '); touch(); return ''; }
    if (is('no enable secret', 'no enable password')) { os.secret = null; touch(); return ''; }
    if ((m = raw.match(/^usern\w* (\S+)(?: privilege \d+)? (?:secret|password)(?: [057])? (\S+)$/i))) { os.users[m[1]] = m[2]; touch(); return ''; }
    if ((m = raw.match(/^no usern\w* (\S+)/i))) { delete os.users[m[1]]; touch(); return ''; }
    if (/^usern/i.test(raw)) return '% Incomplete command.\n! Exemple : username admin secret MonMotDePasse';
    if ((m = raw.match(/^ip domain[- ]name (\S+)$/i))) { os.domain = m[1]; touch(); return ''; }
    if (/^cry\w* key gen\w* rsa/i.test(raw)) {
      if (!os.domain) return '% Please define a domain-name first.';
      os.keys = true; touch();
      return `The name for the keys will be: ${d.host}.${os.domain}\n% The key modulus size is 2048 bits\n% Generating 2048 bit RSA keys, keys will be non-exportable...[OK]\n%SSH-5-ENABLED: SSH 2.0 has been enabled`;
    }
    if (is('ip ssh version 2')) return os.keys ? '' : 'Please create RSA keys to enable SSH (and of atleast 768 bits for SSH v2).';
    if (is('service password-encryption', 'no ip domain-lookup') || /^banner motd /i.test(raw)) return '';
    if ((m = low.match(/^line con\w*( 0)?$/))) { st.mode = 'line'; st.line = 'con'; return ''; }
    if ((m = low.match(/^line vty (\d+)(?: (\d+))?$/))) { st.mode = 'line'; st.line = 'vty'; return ''; }
    if (/^line/.test(low)) return '% Incomplete command.\n! Exemple : line vty 0 4';
    if (sw) {
      if ((m = low.match(/^int\w* vlan ?(\d+)$/))) {
        const v = +m[1];
        if (!os.svi || os.svi.vlan !== v) os.svi = { vlan: v, ip: null, mask: null, up: true };
        if (!os.vdb[v]) os.vdb[v] = VLANS[v] ? VLANS[v].name : 'VLAN' + String(v).padStart(4, '0');
        st.mode = 'if'; st.svi = v; st.ifs = []; touch(); return '';
      }
      if ((m = low.match(/^vlan (\d+)$/))) {
        const v = +m[1]; if (v < 1 || v > 4094) return BAD;
        if (!os.vdb[v]) { os.vdb[v] = VLANS[v] ? VLANS[v].name : 'VLAN' + String(v).padStart(4, '0'); touch(); }
        st.mode = 'vlan'; st.vlan = v; return '';
      }
      if ((m = low.match(/^no vlan (\d+)$/))) { if (+m[1] === 1) return '% Default VLAN 1 may not be deleted.'; delete os.vdb[+m[1]]; touch(); return ''; }
      if ((m = low.match(/^ip default-gateway (\S+)$/))) { if (!ipOk(m[1])) return BAD; os.gw = m[1]; touch(); return ''; }
    }
    return cliCore(d, raw);
  }
  if (st.mode === 'vlan') {
    let m;
    if ((m = raw.match(/^na\w* (\S+)$/i))) { os.vdb[st.vlan] = m[1].slice(0, 32); touch(); return ''; }
    if (low === 'exit') { st.mode = 'config'; return ''; }
    if (low === 'end') { st.mode = 'exec'; return ''; }
    if ((m = low.match(/^vlan (\d+)$/))) { st.mode = 'config'; return cliRun(d, raw); }
    return BAD;
  }
  if (st.mode === 'line') {
    let m;
    if (low === 'exit') { st.mode = 'config'; return ''; }
    if (low === 'end') { st.mode = 'exec'; return ''; }
    const L = st.line === 'con' ? os.con : os.vty;
    if ((m = low.match(/^tr\w* in\w* (.+)$/)) && st.line === 'vty') {
      const t = m[1].split(' ');
      if (!t.every(x => ['ssh', 'telnet', 'all', 'none'].includes(x))) return BAD;
      os.vty.ssh = t.includes('ssh') || t.includes('all'); touch();
      return kindOf(d) === 'router' ? cliCore(d, raw) : '';
    }
    if (is('login local')) { L.local = true; touch(); return ''; }
    if (is('login')) { if (!L.pw) return '% Login disabled on line, until \'password\' is set'; touch(); return ''; }
    if ((m = raw.match(/^pas\w* (?:[07] )?(\S+)$/i))) { L.pw = m[1]; touch(); return ''; }
    if (/^(exec-timeout|logging synchronous|no exec-timeout)/.test(low)) return '';
    if (kindOf(d) === 'router' && /access-class/.test(low)) return cliCore(d, raw);
    return BAD;
  }
  if (st.mode === 'if' && st.svi) {
    let m; const s = os.svi;
    if (low === 'exit') { st.mode = 'config'; st.svi = null; return ''; }
    if (low === 'end') { st.mode = 'exec'; st.svi = null; return ''; }
    if ((m = low.match(/^ip add\w* (\S+) (\S+)$/))) {
      if (!ipOk(m[1]) || !maskOk(m[2])) return '% Bad mask or address.\n! Exemple : ip address 10.99.0.2 255.255.255.0';
      const used = ipUsedBy(m[1]);
      if (used && used !== d.id) return `% ${m[1]} overlaps with another device.\n! Cette adresse est déjà prise.`;
      s.ip = m[1]; s.mask = m[2]; touch(); return '';
    }
    if (/^ip add/.test(low)) return '% Incomplete command.';
    if (is('no ip address')) { s.ip = null; touch(); return ''; }
    if (is('no shutdown')) { s.up = true; touch(); return `%LINK-3-UPDOWN: Interface Vlan${s.vlan}, changed state to up`; }
    if (is('shutdown')) { s.up = false; touch(); return `%LINK-5-CHANGED: Interface Vlan${s.vlan}, changed state to administratively down`; }
    if (/^(no )?desc/.test(low)) return '';
    return BAD;
  }
  // port d'un switch : « switchport access vlan N » crée le VLAN s'il manque, comme un vrai switch
  if (st.mode === 'if' && sw) {
    const m = low.match(/^sw\w* ac\w* vl\w* (\d+)$/);
    const out = cliCore(d, raw);
    if (m && VLAN_IDS.includes(+m[1]) && !os.vdb[+m[1]]) { os.vdb[+m[1]] = VLANS[+m[1]].name; return `% Access VLAN does not exist. Creating vlan ${m[1]}` + (out ? '\n' + out : ''); }
    return out;
  }
  return cliCore(d, raw);
}
// Commandes « show » ajoutées ou complétées. Renvoie '' si la commande n'est pas de celles-là.
function iosShow(d, raw) {
  const low = raw.toLowerCase(), os = osOf(d), is = (...pats) => pats.some(p => matchGrammar([{ p }], low));
  if (is('show running-config')) { if (!S.flags.shRun) { S.flags.shRun = true; touch(); } return iosRunning(d); }
  if (is('show startup-config')) { if (!S.flags.shStart) { S.flags.shStart = true; touch(); } const cur = iosSnap(d), keep = { host: d.host, cfg: d.cfg, os: d.os, acl: d.acl, vty: d.vty }; if (cur === os.saved) return iosRunning(d).replace('Current configuration:', 'Using NVRAM:'); iosReloadPeek(d); const out = iosRunning(d).replace('Building configuration...\n\nCurrent configuration:', 'Using NVRAM:'); Object.assign(d, keep); if (!keep.acl) delete d.acl; if (!keep.vty) delete d.vty; return out; }
  if (is('show ip ssh')) { const why = iosSshWhy(d); return os.keys ? `SSH Enabled - version 2.0\nAuthentication timeout: 120 secs; Authentication retries: 3${why ? '\n! Connexion encore impossible : ' + why + '.' : ''}` : 'SSH Disabled - version 2.0\n%Please create RSA keys to enable SSH (crypto key generate rsa).'; }
  if (is('show users')) return '    Line       User       Host(s)              Idle       Location\n*  0 con 0                idle                 00:00:00';
  if (kindOf(d) === 'switch' && is('show vlan brief', 'show vlan')) {
    const o = [pad('VLAN', 5) + pad('Name', 33) + pad('Status', 10) + 'Ports', '---- -------------------------------- --------- -------------------------------'];
    for (const v of Object.keys(os.vdb).map(Number).sort((a, b) => a - b)) {
      const ports = CAT[d.type].ports.filter(p => hasCfg(d, p) && cfg(d, p.id).mode === 'access' && cfg(d, p.id).vlan === v).map(p => p.id);
      const rows = []; for (let i = 0; i < Math.max(1, ports.length); i += 4) rows.push(ports.slice(i, i + 4).join(', '));
      o.push(pad(v, 5) + pad(os.vdb[v], 33) + pad('active', 10) + rows[0]);
      for (const r of rows.slice(1)) o.push(' '.repeat(48) + r);
    }
    return o.join('\n');
  }
  if (is('show ip interface brief')) {
    if (kindOf(d) !== 'switch') return '';
    const o = [pad('Interface', 23) + pad('IP-Address', 16) + 'OK? Method Status                Protocol'];
    for (const p of CAT[d.type].ports) { const ps = portState(d, p); o.push(pad(longIf(p.id), 23) + pad('unassigned', 16) + 'YES unset  ' + (ps.st === 'disabled' ? pad('administratively down', 22) + 'down' : ps.up ? pad('up', 22) + 'up' : pad('down', 22) + 'down')); }
    const s = sviLine(d); if (s) o.push(s);
    return o.join('\n');
  }
  return '';
}
// Remet en place la configuration enregistrée sans rien journaliser (pour « show startup-config »)
function iosReloadPeek(d) { const s = JSON.parse(osOf(d).saved); d.host = s.host; d.cfg = s.cfg; d.acl = s.acl || undefined; d.vty = s.vty || undefined; d.os = Object.assign(s.os, { saved: d.os.saved }); }

/* ---------- Réseau de gestion : qui porte quelle adresse, qui atteint qui ---------- */
function ipUsedBy(ip) {
  for (const d of Object.values(S.devs)) { const o = d.os; if (!o) continue; if ((o.svi && o.svi.ip === ip) || o.ip === ip) return d.id; }
  const v = S.vms.find(x => x.ip === ip); if (v) return v.id;
  if (S.pc && !S.pc.dhcp && S.pc.ip === ip) return 'pc';
  return null;
}
// À qui appartient une adresse : appareil, VM, passerelle (pare-feu), portable
function ipOwner(ip) {
  for (const d of Object.values(S.devs)) {
    const o = d.os; if (!o) continue;
    if (o.svi && o.svi.ip === ip) return { t: 'dev', d, vlan: o.svi.vlan, up: !!D.powered[d.id] && o.svi.up };
    if (o.ip === ip) return { t: 'dev', d, vlan: vlanOfIp(ip), up: !!D.powered[d.id] };
  }
  const vm = S.vms.find(x => x.ip === ip);
  if (vm) return { t: 'vm', vm, d: dev(vm.host), vlan: vm.vlan, up: vm.st === 'running' && !vm.isolated && !!D.powered[vm.host] };
  for (const v of VLAN_IDS) if (VLANS[v].gw === ip) { const fw = devsOfKind('fw')[0]; return fw ? { t: 'gw', d: fw, vlan: v, up: !!D.powered[fw.id] } : null; }
  if (S.pc && !S.pc.dhcp && S.pc.ip === ip) return { t: 'pc', vlan: vlanOfIp(ip), up: true };
  return null;
}
// Le portable est-il branché sur un port de switch en état de marche ?
function pcLink() {
  const pc = S.pc;
  if (!pc || !pc.eth) return { ok: false, why: 'Le câble réseau du portable n’est branché nulle part.' };
  const sw = dev(pc.eth.d);
  if (!sw) return { ok: false, why: 'Le câble réseau du portable n’est branché nulle part.' };
  if (!D.powered[sw.id]) return { ok: false, why: `${sw.host} est éteint.` };
  const kc = cfg(sw, pc.eth.p);
  if (!kc.admin || kc.err) return { ok: false, why: `Le port ${pc.eth.p} de ${sw.host} est désactivé.` };
  if (kc.mode !== 'access') return { ok: false, why: `Le port ${pc.eth.p} est en trunk : un poste se branche sur un port en mode access.` };
  return { ok: true, sw, port: pc.eth.p, vlan: kc.vlan };
}
function l2Reach(fromSw, v, o) {
  if (o.d.id === fromSw.id) return true;
  return l2Search(fromSw.id, null, v, e => e.d === o.d.id).ok;
}
// Le portable atteint-il cette adresse ? proto : 'icmp' ou 'tcp', port pour tcp
function pcReach(ip, proto, port) {
  const L = pcLink(), pc = S.pc;
  if (!L.ok) return { ok: false, why: L.why, code: 'link' };
  if (pc.dhcp || !ipOk(pc.ip)) return { ok: false, why: pc.dhcp ? 'Aucun serveur DHCP n’a répondu : le portable n’a pas d’adresse utilisable. Donne-lui une adresse fixe.' : 'La carte réseau du portable n’a pas d’adresse.', code: 'noip' };
  const myV = vlanOfIp(pc.ip);
  if (ip === pc.ip) return { ok: true };
  const o = ipOwner(ip);
  const tv = vlanOfIp(ip);
  if (myV !== L.vlan) return { ok: false, why: `Le port ${L.port} est dans le VLAN ${L.vlan}${VLANS[L.vlan] && VLANS[L.vlan].net ? ` (réseau ${VLANS[L.vlan].net}.0/24)` : ''}, mais le portable a l’adresse ${pc.ip}.`, code: 'subnet' };
  if (!o || !o.up || o.t === 'pc') return { ok: false, why: 'Personne ne répond à cette adresse.', code: 'timeout' };
  if (tv === L.vlan) return l2Reach(L.sw, tv, o) ? { ok: true, o } : { ok: false, why: `Aucun chemin dans le VLAN ${tv} entre ${L.sw.host} et ${o.d.host}.`, code: 'timeout' };
  // autre réseau : il faut passer par la passerelle (le pare-feu)
  const gw = VLANS[L.vlan].gw, fw = devsOfKind('fw')[0];
  if (!gw || pc.gw !== gw) return { ok: false, why: `${ip} est dans un autre réseau : il faut une passerelle par défaut sur le portable (${gw || 'ce VLAN n’est pas routé'}).`, code: 'nogw' };
  if (!fw || !D.powered[fw.id] || !l2Reach(L.sw, L.vlan, { d: fw })) return { ok: false, why: 'La passerelle (le pare-feu) ne répond pas.', code: 'timeout' };
  if (o.d.id !== fw.id && !l2Search(fw.id, null, tv, e => e.d === o.d.id).ok) return { ok: false, why: `Le pare-feu n’atteint pas ${o.d.host} dans le VLAN ${tv}.`, code: 'timeout' };
  if (proto !== 'icmp' && !ruleAllows(zoneOfVlan(L.vlan), zoneOfVlan(tv), proto, port)) return { ok: false, why: `Le pare-feu refuse ${zoneOfVlan(L.vlan)} → ${zoneOfVlan(tv)} en ${proto.toUpperCase()} ${port}.`, code: 'filtered' };
  return { ok: true, o };
}
// ping depuis un switch ou un routeur : vers le portable ou vers une adresse du même VLAN de gestion
function devPing(d, ip) {
  if (!ipOk(ip)) return '% Unrecognized host or address.';
  const head = `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:\n`;
  const s = osOf(d).svi;
  let ok = false;
  if (s && s.ip && s.up) {
    if (S.pc && S.pc.ip === ip) ok = pcReach(s.ip, 'icmp').ok;
    else { const o = ipOwner(ip); ok = !!(o && o.up && o.t !== 'pc' && vlanOfIp(ip) === s.vlan && l2Reach(d, s.vlan, o)); }
  }
  return head + (ok ? '!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/1/2 ms' : '.....\nSuccess rate is 0 percent (0/5)');
}

/* ---------- Linux : vraies commandes de réglage ---------- */
const UNZIF = Object.fromEntries(Object.entries(ZIF).map(([z, i]) => [i, z]));
function shellSplit(s) { return (s.match(/"[^"]*"|'[^']*'|\S+/g) || []).map(x => x.replace(/^["']|["']$/g, '')); }
function optsOf(tk) { const o = { _: [] }; for (let i = 0; i < tk.length; i++) { const t = tk[i]; if (t.startsWith('--')) { const e = t.indexOf('='); if (e > 0) o[t.slice(2, e)] = t.slice(e + 1); else if (tk[i + 1] !== undefined && !tk[i + 1].startsWith('-')) o[t.slice(2)] = tk[++i]; else o[t.slice(2)] = true; } else if (/^-[a-z]$/.test(t) && tk[i + 1] !== undefined && !tk[i + 1].startsWith('-')) o[t.slice(1)] = tk[++i]; else o._.push(t); } return o; }
function expandDevs(list) {
  const out = [];
  for (const t of list) {
    let m;
    if ((m = t.match(/^\/dev\/sd\[([a-z])-([a-z])\]$/))) for (let c = m[1].charCodeAt(0); c <= m[2].charCodeAt(0); c++) out.push('/dev/sd' + String.fromCharCode(c));
    else if ((m = t.match(/^\/dev\/sd\{([a-z,]+)\}$/))) m[1].split(',').forEach(c => out.push('/dev/sd' + c));
    else if (/^\/dev\/sd[a-z]$/.test(t)) out.push(t);
    else return null;
  }
  return out;
}
const vmById = id => S.vms.find(v => String(v.vmid) === String(id));
function linuxRun(d, raw) {
  if (!raw) return '';
  const k = kindOf(d), os = osOf(d), tk = shellSplit(raw), low = raw.toLowerCase();
  if (raw.endsWith('?') || low === 'help') return linuxHelp(d);
  let m;
  /* --- adresse de gestion --- */
  if ((m = low.match(/^ip (?:-4 )?a(?:ddr|ddress)? add (\S+)\/(\d+) dev (\S+)$/))) {
    if (!ipOk(m[1])) return 'Error: any valid prefix is expected rather than "' + m[1] + '".';
    if (k === 'fw') return 'RTNETLINK answers: Operation not permitted\n# Sur ce pare-feu, chaque VLAN porte déjà l’adresse de passerelle du plan (10.99.0.1 pour ADMIN). Crée la sous-interface : ip link add link port2 name port2.99 type vlan id 99';
    if (!CAT[d.type].ports.some(p => p.id.toLowerCase() === m[3].split('.')[0])) return `Cannot find device "${m[3]}"`;
    if (!vlanOfIp(m[1])) return `# ${m[1]} n’appartient à aucun réseau du plan d’adressage (ADMIN : 10.99.0.0/24).\nRTNETLINK answers: Invalid argument`;
    const used = ipUsedBy(m[1]); if (used && used !== d.id) return 'RTNETLINK answers: File exists\n# Cette adresse est déjà prise.';
    os.ip = m[1]; os.dev = m[3]; touch(); return '';
  }
  if ((m = low.match(/^ip (?:-4 )?a(?:ddr|ddress)? del (\S+)\/(\d+) dev (\S+)$/))) { if (os.ip !== m[1]) return 'RTNETLINK answers: Cannot assign requested address'; os.ip = null; touch(); return ''; }
  if (/^ip (-br )?(-4 )?a(ddr|ddress)?( show)?$/.test(low) && k !== 'fw') {
    const o = ['lo               UNKNOWN        127.0.0.1/8'];
    for (const p of CAT[d.type].ports) { const c = portCable(d.id, p.id), up = c && D.link[c.id] && D.link[c.id].up; o.push(pad(p.id, 17) + pad(up ? 'UP' : 'DOWN', 15) + (os.ip && os.dev && os.dev.split('.')[0] === p.id.toLowerCase() ? os.ip + '/24' : '')); }
    return o.join('\n');
  }
  /* --- pare-feu : sous-interfaces VLAN et règles nftables --- */
  if (k === 'fw') {
    const lan = CAT[d.type].ports.find(p => p.role === 'lan');
    if ((m = low.match(/^ip link add link (\S+) name (\S+) type vlan id (\d+)$/))) {
      if (!lan || m[1] !== lan.id.toLowerCase()) return `Cannot find device "${m[1]}"\n# Le port côté salle s’appelle ${lan ? lan.id : '?'}.`;
      const v = +m[3]; if (!VLAN_IDS.includes(v) || v === 1) return `# VLAN ${v} hors du plan d’adressage (${VLAN_IDS.filter(x => x !== 1).join(', ')}).\nRTNETLINK answers: Invalid argument`;
      const c = cfg(d, lan.id), al = c.mode === 'trunk' ? c.allowed : [];
      if (al.includes(v)) return 'RTNETLINK answers: File exists';
      CLI_SELF = true; try { actPortCfg(d, lan.id, { mode: 'trunk', allowed: [...al, v].sort((a, b) => a - b) }); } finally { CLI_SELF = false; }
      return '';
    }
    if ((m = low.match(/^ip link (?:del|delete) (?:dev )?(\S+)\.(\d+)$/))) {
      const c = lan && cfg(d, lan.id), v = +m[2];
      if (!c || c.mode !== 'trunk' || !c.allowed.includes(v)) return `Cannot find device "${m[1]}.${m[2]}"`;
      CLI_SELF = true; try { actPortCfg(d, lan.id, { allowed: c.allowed.filter(x => x !== v) }); } finally { CLI_SELF = false; }
      return '';
    }
    if (/^ip (-br )?(link|a|addr|address)( show)?$/.test(low)) {
      const c = lan ? cfg(d, lan.id) : null, o = ['lo               UNKNOWN        127.0.0.1/8'];
      for (const p of CAT[d.type].ports) { const cb = portCable(d.id, p.id), up = cb && D.link[cb.id] && D.link[cb.id].up; o.push(pad(p.id, 17) + pad(up ? 'UP' : 'DOWN', 15) + (p.role === 'wan' ? PUB_IP + '/29' : '')); }
      if (c && c.mode === 'trunk') for (const v of c.allowed) o.push(pad(`${lan.id}.${v}@${lan.id}`, 17) + pad('UP', 15) + (VLANS[v].gw ? VLANS[v].gw + '/24' : ''));
      return o.join('\n');
    }
    if (tk[0] === 'nft') return nftRun(d, tk, raw);
  }
  /* --- stockage : mdadm --- */
  if (tk[0] === 'mdadm' && (k === 'server' || k === 'nas')) return mdadmRun(d, tk);
  /* --- hyperviseur : qm --- */
  if ((tk[0] === 'qm' || tk[0] === 'qmrestore') && k === 'server') return qmRun(d, tk, raw);
  if (tk[0] === 'qm' || tk[0] === 'qmrestore') return `-bash: ${tk[0]}: command not found`;
  if (tk[0] === 'nft') return 'Error: Could not process rule: Operation not supported\n# Les règles se posent sur le pare-feu.';
  const out = runCommand({ d: d.id }, raw);
  return /^% Commande inconnue/.test(out) ? `-bash: ${tk[0]}: command not found\n# Tape « help » pour la liste des commandes.` : out;
}
function linuxHelp(d) {
  const k = kindOf(d), row = (a, b) => '  ' + pad(a, 62) + b, L = [];
  if (k === 'fw') L.push(row('ip -br link', 'interfaces et sous-interfaces VLAN'), row('ip link add link port2 name port2.10 type vlan id 10', 'route le VLAN 10'), row('ip link del port2.10', 'ne route plus le VLAN 10'),
    row('nft -a list ruleset', 'règles en place, avec leur numéro (handle)'), row('nft add rule inet filtre forward iifname "wan0" oifname "vlan10" tcp dport 443 accept', 'autorise un flux'),
    row('nft delete rule inet filtre forward handle N', 'retire la règle N'), row('nft add element inet filtre blocklist { ADRESSE }', 'bloque une adresse'), row('nft add rule inet filtre input tcp flags syn limit rate over 200/second drop', 'limite les SYN'),
    '  Interfaces de zone : ' + Object.entries(ZIF).map(([z, i]) => `${i} = ${z}`).join(' · '));
  else {
    L.push(row('ip -br a', 'interfaces et adresse de gestion'), row('ip addr add 10.99.0.21/24 dev eno1', 'adresse de gestion (réseau ADMIN)'), row('passwd', 'mot de passe de root, demandé en SSH'),
      row('cat /proc/mdstat', 'état de la grappe RAID'), row('mdadm --create /dev/md0 --level=1 --raid-devices=2 /dev/sda /dev/sdb', 'crée la grappe (niveaux 0, 1, 5, 6, 10)'), row('mdadm --detail /dev/md0', 'détail de la grappe'));
    if (k === 'server') L.push(row('qm list', 'machines virtuelles de cet hôte'), row('qm create 101 --name web-01 --net0 virtio,bridge=vmbr0,tag=10 --ipconfig0 ip=172.16.10.11/24', 'crée et démarre une VM (nom = service-numéro)'),
      row('qm start|shutdown|reboot|destroy VMID', 'démarrer, arrêter, redémarrer, supprimer'), row('qm set VMID --memory 8192', 'change la mémoire'), row('qm set VMID --net0 virtio,bridge=vmbr0,tag=10,link_down=1', 'coupe la carte réseau (isoler)'),
      row('qmrestore VMID', 'restaure la dernière sauvegarde'), row('qm terminal VMID', 'ouvre la console de la VM'), '  Services : ' + Object.keys(SVC).join(', '));
  }
  return 'Réglages :\n' + L.join('\n') + '\n\nDiagnostic :\n' + cmdList({ d: d.id }).filter(x => x.chip).map(x => '  ' + x.c).join('\n');
}
function mdadmRun(d, tk) {
  const o = optsOf(tk.slice(1));
  if ('detail' in o || o._.includes('-D')) {
    const A = arrayInfo(d), n = d.disks.filter(Boolean).length;
    if (!A.valid) return 'mdadm: cannot open /dev/md0: No such file or directory';
    return `/dev/md0:\n        Raid Level : raid${d.raid}\n      Raid Devices : ${n}\n             State : ${A.state === 'ok' ? 'clean' : A.state === 'fail' ? 'FAILED' : 'clean, degraded'}\n        Array Size : ${A.usable.toFixed(2)} To utilisables`;
  }
  if (!('create' in o)) return 'mdadm: an md device must be given in this mode\n# Exemple : mdadm --create /dev/md0 --level=1 --raid-devices=2 /dev/sda /dev/sdb';
  const lvl = String(o.level !== undefined ? o.level : o.l).replace(/^raid/, ''), n = +(o['raid-devices'] !== undefined ? o['raid-devices'] : o.n);
  const args = o._.filter(x => x.startsWith('/dev/')), md = o.create === true ? args[0] : o.create;
  if (md !== '/dev/md0') return 'mdadm: an md device must be given in this mode\n# La grappe de cet équipement s’appelle /dev/md0.';
  if (!RAID[lvl] || lvl === 'none') return `mdadm: invalid raid level: ${lvl}\n# Niveaux possibles : 0, 1, 5, 6, 10.`;
  const list = expandDevs(args.filter(x => x !== '/dev/md0'));
  if (!list || !list.length) return 'mdadm: no raid-devices specified.\n# Liste les disques : /dev/sda /dev/sdb, ou /dev/sd[a-d].';
  if (!n || n !== list.length) return `mdadm: You have listed ${list.length} devices but --raid-devices=${n || '?'}.`;
  const have = d.disks.map((x, i) => x ? diskName(i) : null).filter(Boolean);
  const miss = list.find(x => !have.includes(x)); if (miss) return `mdadm: cannot open ${miss}: No such file or directory\n# Disques présents : ${have.join(' ') || 'aucun'}.`;
  if (list.length !== have.length) return `mdadm: ${have.length} disques sont en place, la grappe doit tous les prendre (${have.join(' ')}).`;
  const e = actSetRaid(d, lvl);
  return e ? 'mdadm: ' + e : `mdadm: Defaulting to version 1.2 metadata\nmdadm: array /dev/md0 started.`;
}
// Trouve le contrat en cours de construction qui attend encore ce service
function contractWanting(svc) {
  for (const c of S.contracts) {
    if (c.state !== 'setup' && c.state !== 'active') continue;
    const def = contractDef(c.id), want = (def.svcs || []).filter(x => x.s === svc).reduce((n, x) => n + (x.n || 1), 0);
    if (want > S.vms.filter(v => v.k === c.id && v.svc === svc).length) return c.id;
  }
  return null;
}
function qmRun(d, tk, raw) {
  const sub = tk[0] === 'qmrestore' ? 'restore' : tk[1], rest = tk.slice(tk[0] === 'qmrestore' ? 1 : 2), o = optsOf(rest);
  const need = () => { const v = vmById(o._.find(x => /^\d+$/.test(x))); return v && v.host === d.id ? v : null; };
  const run = (v, op) => { CLI_SELF = true; try { return actVm(v.id, op); } finally { CLI_SELF = false; } };
  if (sub === 'list') return runCommand({ d: d.id }, 'qm list');
  if (sub === 'create') {
    const name = String(o.name || ''), svc = name.split('-')[0];
    if (!o._[0] || !/^\d+$/.test(o._[0])) return '400 Parameter verification failed.\nvmid: type check (\'integer\') failed\n# Exemple : qm create 101 --name web-01 --net0 virtio,bridge=vmbr0,tag=10 --ipconfig0 ip=172.16.10.11/24';
    if (vmById(o._[0])) return `unable to create VM ${o._[0]} - VM ${o._[0]} already exists on node '${d.host}'`;
    if (!SVC[svc]) return `# Le nom dit quel service installer : ${Object.keys(SVC).map(s => s + '-01').slice(0, 4).join(', ')}…\n400 Parameter verification failed.\nname: unknown template '${name}'`;
    const tag = /tag=(\d+)/.exec(String(o.net0 || '')), ip = /ip=([\d.]+)\/(\d+)/.exec(String(o.ipconfig0 || ''));
    if (!tag) return '400 Parameter verification failed.\nnet0: missing VLAN tag\n# Précise le VLAN : --net0 virtio,bridge=vmbr0,tag=10';
    if (!ip) return '400 Parameter verification failed.\nipconfig0: missing\n# Précise l’adresse : --ipconfig0 ip=172.16.10.11/24';
    let sto = d;
    const st = /^([^:]+)/.exec(String(o.scsi0 || o.storage || 'local-lvm'))[1];
    if (st !== 'local-lvm' && st !== 'local') { sto = Object.values(S.devs).find(x => kindOf(x) === 'nas' && ('nfs-' + x.host === st || x.host === st)); if (!sto) return `storage '${st}' does not exist\n# Stockages : local-lvm${devsOfKind('nas').map(x => ', nfs-' + x.host).join('')}`; }
    const k = contractWanting(svc);
    CLI_SELF = true; let r; try { r = actDeploy(k, svc, d.id, +tag[1], ip[1], sto.id); } finally { CLI_SELF = false; }
    if (typeof r === 'string') return 'qm: ' + r;
    return `VM ${r.vmid} créée (${r.name}, ${SVC[svc].soft}) et démarrée.` + (k ? '' : '\n# Aucun contrat en cours n’attend ce service : la VM tourne mais ne rapporte rien.');
  }
  const v = need();
  if (!v) return o._.length ? `Configuration file 'nodes/${d.host}/qemu-server/${o._[0]}.conf' does not exist` : '400 not enough arguments\n# Exemple : qm ' + (sub || 'start') + ' 101';
  if (sub === 'start') { if (v.st === 'running') return `VM ${v.vmid} already running`; return run(v, 'start') || ''; }
  if (sub === 'stop' || sub === 'shutdown') return run(v, 'stop') || '';
  if (sub === 'reboot' || sub === 'reset') return run(v, 'restart') || '';
  if (sub === 'destroy') return run(v, 'delete') || '';
  if (sub === 'restore') return run(v, 'restore') || `restore vma archive: restauration de la VM ${v.vmid} en cours…`;
  if (sub === 'terminal' || sub === 'enter') return { enter: v.id };
  if (sub === 'set') {
    if (o.memory) { const mb = +o.memory; if (mb === v.ram * 2048) return run(v, 'ram') || `update VM ${v.vmid}: -memory ${mb}`; return `# La mémoire se double : ${v.ram * 2048} Mo pour cette VM.\n400 Parameter verification failed.`; }
    const ld = /link_down=([01])/.exec(String(o.net0 || ''));
    if (ld) { if ((ld[1] === '1') !== !!v.isolated) run(v, 'isolate'); return `update VM ${v.vmid}: -net0 ${o.net0}`; }
    return '400 Parameter verification failed.\n# Réglages gérés : --memory, --net0 …,link_down=0|1';
  }
  return `ERROR: unknown command 'qm ${sub || ''}'`;
}
function nftRun(d, tk, raw) {
  const low = raw.toLowerCase(), act = fn => { CLI_SELF = true; try { return fn(); } finally { CLI_SELF = false; } };
  let m;
  if (/^nft (-a )?list (ruleset|table inet filtre|chain inet filtre forward)$/.test(low)) {
    const o = ['table inet filtre {', '\tset blocklist {', '\t\ttype ipv4_addr', S.fwopt.block.length ? `\t\telements = { ${S.fwopt.block.join(', ')} }` : null, '\t}', '\tchain input {', '\t\ttype filter hook input priority filter; policy drop;', '\t\tip saddr @blocklist drop # handle 11',
      S.fwopt.syn ? '\t\ttcp flags syn limit rate over 200/second drop # handle 12' : null, '\t}', '\tchain forward {', '\t\ttype filter hook forward priority filter; policy drop;', '\t\tct state established,related accept # handle 3'];
    S.rules.forEach((r, i) => o.push('\t\t' + nftLine(r).replace('nft add rule inet filtre forward ', '') + ` # handle ${i + 4}`));
    o.push('\t}', '}');
    return o.filter(x => x !== null).join('\n');
  }
  if ((m = low.match(/^nft add rule inet filtre forward (.+) accept$/))) {
    const r = { src: 'any', dst: 'any', proto: 'any', port: 'any' }, body = m[1];
    const i = /iifname "?([\w.]+)"?/.exec(body), oo = /oifname "?([\w.]+)"?/.exec(body), p = /\b(tcp|udp) dport (\S+)/.exec(body);
    if (i) { if (!UNZIF[i[1]]) return `Error: Interface does not exist: ${i[1]}\n# Interfaces : ${Object.values(ZIF).join(', ')}`; r.src = UNZIF[i[1]]; }
    if (oo) { if (!UNZIF[oo[1]]) return `Error: Interface does not exist: ${oo[1]}\n# Interfaces : ${Object.values(ZIF).join(', ')}`; r.dst = UNZIF[oo[1]]; }
    if (p) { r.proto = p[1]; r.port = p[2] === '1-65535' ? 'any' : +p[2]; if (r.port !== 'any' && !(r.port >= 1 && r.port <= 65535)) return 'Error: syntax error, unexpected port'; }
    else if (/dport|tcp|udp/.test(body)) return 'Error: syntax error\n# Exemple : tcp dport 443';
    if (body.replace(/iifname "?[\w.]+"?|oifname "?[\w.]+"?|\b(tcp|udp) dport \S+/g, '').trim()) return 'Error: syntax error, unexpected string\n# Exemple : nft add rule inet filtre forward iifname "wan0" oifname "vlan10" tcp dport 443 accept';
    const e = act(() => actAddRule(r));
    return e ? '# ' + e : (ruleRisk(r) ? '# Attention : ' + ruleRisk(r) : '');
  }
  if ((m = low.match(/^nft delete rule inet filtre forward handle (\d+)$/))) { const i = +m[1] - 4; if (!S.rules[i]) return 'Error: Could not process rule: No such file or directory'; act(() => actDelRule(i)); return ''; }
  if ((m = low.match(/^nft add element inet filtre blocklist \{ ?([\d.]+) ?\}$/))) { if (!ipOk(m[1])) return 'Error: syntax error, unexpected address'; act(() => actFw('block', m[1])); return ''; }
  if ((m = low.match(/^nft delete element inet filtre blocklist \{ ?([\d.]+) ?\}$/))) { const i = S.fwopt.block.indexOf(m[1]); if (i < 0) return 'Error: Could not process rule: No such file or directory'; S.fwopt.block.splice(i, 1); touch(); return ''; }
  if (/^nft add rule inet filtre input tcp flags syn limit rate over \d+\/second drop$/.test(low)) { if (!S.fwopt.syn) act(() => actFw('syn')); return ''; }
  if (/^nft delete rule inet filtre input handle 12$/.test(low)) { if (S.fwopt.syn) act(() => actFw('syn')); return ''; }
  if (/^nft (add|delete|insert)/.test(low)) return 'Error: syntax error\n# Tape « help » pour des exemples.';
  return runCommand({ d: d.id }, raw);
}
// Dans une VM : réglages de service, puis diagnostic
function vmRun(v, raw) {
  const low = raw.toLowerCase().trim(), s0 = SVC[v.svc], act = op => { CLI_SELF = true; try { return actVm(v.id, op); } finally { CLI_SELF = false; } };
  if (!low) return '';
  if (low === 'help' || low.endsWith('?')) {
    const row = (a, b) => '  ' + pad(a, 46) + b, L = [row(`systemctl restart ${s0.unit}`, 'relance le service'), row('journalctl --vacuum-size=200M', 'purge les journaux'), row('systemctl enable --now fail2ban', 'bannit les adresses qui insistent'), row('systemctl disable --now fail2ban', 'arrête fail2ban')];
    if (s0.cert) L.push(row('certbot renew', 'renouvelle le certificat'), row('systemctl enable --now certbot.timer', 'renouvellement automatique (ACME)'), row('systemctl disable --now certbot.timer', 'arrête le renouvellement automatique'));
    return 'Réglages :\n' + L.join('\n') + '\n  exit' + ' '.repeat(42) + 'quitte la VM\n\nDiagnostic :\n' + cmdList({ vm: v.id }).filter(x => x.chip).map(x => '  ' + x.c).join('\n');
  }
  if (low === `systemctl restart ${s0.unit}` || low === 'reboot') return act('restart') || '';
  if (/^journalctl --vacuum-(size|time)=\S+$/.test(low) || low === 'logrotate -f /etc/logrotate.conf') { act('purge'); return 'Vacuuming done, freed archived journals.'; }
  if (/^systemctl enable --now fail2ban$/.test(low)) { if (!v.f2b) act('f2b'); return 'Created symlink /etc/systemd/system/multi-user.target.wants/fail2ban.service.'; }
  if (/^systemctl disable --now fail2ban$/.test(low)) { if (v.f2b) act('f2b'); return 'Removed /etc/systemd/system/multi-user.target.wants/fail2ban.service.'; }
  if (s0.cert && /^certbot renew/.test(low)) { act('renew'); return `Renewing an existing certificate for ${v.name}.client.fr\nCongratulations, all renewals succeeded.`; }
  if (s0.cert && /^systemctl enable --now certbot\.timer$/.test(low)) { if (!v.acme) act('acme'); return 'Created symlink /etc/systemd/system/timers.target.wants/certbot.timer.'; }
  if (s0.cert && /^systemctl disable --now certbot\.timer$/.test(low)) { if (v.acme) act('acme'); return 'Removed /etc/systemd/system/timers.target.wants/certbot.timer.'; }
  const out = runCommand({ vm: v.id }, raw);
  return /^% Commande inconnue/.test(out) ? `-bash: ${raw.split(' ')[0]}: command not found\n# Tape « help » pour la liste des commandes.` : out;
}

/* ---------- Portable : invite de commandes Windows ---------- */
function pcNetText() {
  const pc = S.pc, L = pcLink();
  const o = ['', 'Configuration IP de Windows', '', 'Carte Ethernet Ethernet :', ''];
  if (!L.ok) { o.push('   Statut du média. . . . . . . . . . . . : Média déconnecté'); return o.join('\n'); }
  if (pc.dhcp) o.push('   Adresse d’autoconfiguration IPv4 . . . : 169.254.' + (hhash('pc') % 250 + 1) + '.' + (hhash('pc2') % 250 + 1), '   Masque de sous-réseau. . . . . . . . . : 255.255.0.0', '   Passerelle par défaut. . . . . . . . . :');
  else o.push('   Adresse IPv4. . . . . . . . . . . . . .: ' + (pc.ip || ''), '   Masque de sous-réseau. . . . . . . . . : ' + (pc.mask || ''), '   Passerelle par défaut. . . . . . . . . : ' + (pc.gw || ''));
  return o.join('\n');
}
function pcCmd(raw) {
  const tk = raw.trim().split(/\s+/), c = (tk[0] || '').toLowerCase();
  if (!c) return '';
  if (c === 'help' || c === '?') return 'ipconfig          adresse du portable\nping ADRESSE      teste si une adresse répond\ntracert ADRESSE   montre le chemin\narp -a            voisins vus sur le réseau\ncls               efface l’écran';
  if (c === 'ipconfig') return pcNetText();
  if (c === 'cls') return { clear: true };
  if (c === 'arp') { const L = pcLink(); if (!L.ok || S.pc.dhcp) return 'Aucune entrée ARP trouvée.'; const o = ['', `Interface : ${S.pc.ip} --- 0x4`, '  Adresse Internet      Adresse physique      Type']; for (const d of Object.values(S.devs)) { const a = d.os && (d.os.ip || (d.os.svi && d.os.svi.ip)); if (a && vlanOfIp(a) === L.vlan && pcReach(a, 'icmp').ok) o.push('  ' + pad(a, 22) + pad(macOf(d.id).replace(/:/g, '-'), 22) + 'dynamique'); } return o.join('\n'); }
  if (c === 'ping' || c === 'tracert') {
    const ip = tk[tk.length - 1];
    if (tk.length < 2) return `Utilisation : ${c} ADRESSE`;
    if (!ipOk(ip)) return `La requête ${c === 'ping' ? 'Ping' : 'tracert'} n’a pas pu trouver l’hôte ${ip}. Vérifiez le nom et essayez à nouveau.`;
    const r = pcReach(ip, 'icmp');
    if (c === 'tracert') {
      const head = `\nDétermination de l’itinéraire vers ${ip} avec un maximum de 30 sauts.\n\n`;
      if (!r.ok) return head + '  1     *        *        *     Délai d’attente de la demande dépassé.\n\n! ' + r.why;
      const routed = vlanOfIp(ip) !== vlanOfIp(S.pc.ip);
      if (routed) { if (!S.flags.tracert) { S.flags.tracert = true; touch(); } }
      return head + (routed ? `  1    <1 ms    <1 ms    <1 ms  ${S.pc.gw}\n  2     1 ms     1 ms     1 ms  ${ip}` : `  1    <1 ms    <1 ms    <1 ms  ${ip}`) + '\n\nItinéraire déterminé.';
    }
    const head = `\nEnvoi d’une requête 'Ping'  ${ip} avec 32 octets de données :\n`;
    if (r.ok && r.o && r.o.t !== 'pc') { if (!S.flags.ping) { S.flags.ping = true; touch(); } if (vlanOfIp(ip) !== vlanOfIp(S.pc.ip)) { if (!S.flags.pingRoute) { S.flags.pingRoute = true; touch(); } } if (r.o.t === 'dev' && !isIOS(r.o.d)) { if (!S.flags.pingSrv) { S.flags.pingSrv = true; touch(); } } }
    if (r.ok) return head + `Réponse de ${ip} : octets=32 temps<1ms TTL=${vlanOfIp(ip) === vlanOfIp(S.pc.ip) ? 64 : 63}\n`.repeat(4) + `\nStatistiques Ping pour ${ip}:\n    Paquets : envoyés = 4, reçus = 4, perdus = 0 (perte 0%)`;
    const line = r.code === 'link' ? 'Échec général.' : r.code === 'noip' || r.code === 'subnet' || r.code === 'nogw' ? 'PING : échec de la transmission. Défaillance générale.' : 'Délai d’attente de la demande dépassé.';
    return head + (line + '\n').repeat(4) + `\nStatistiques Ping pour ${ip}:\n    Paquets : envoyés = 4, reçus = 0, perdus = 4 (perte 100%)\n\n! ${r.why}`;
  }
  return `'${tk[0]}' n’est pas reconnu en tant que commande interne\nou externe, un programme exécutable ou un fichier de commandes.`;
}

/* ---------- Sessions du portable : console (câble) et SSH (réseau) ---------- */
// Une session : { via: 'serial'|'ssh', d: id d'appareil, vm: id de VM ou null, stage: 'user'|'pw'|'shell'|'ask', user, ask }
function sessOpenSerial() {
  const d = S.pc && S.pc.con ? dev(S.pc.con) : null;
  if (!d) return { err: 'Le câble console du portable n’est branché sur aucun appareil. Ouvre la fenêtre de l’appareil (onglet Physique) et branche-le sur son port console.' };
  if (!D.powered[d.id]) return { err: `${d.host} est éteint : rien ne s’affiche sur le port console.` };
  delete CLIM[d.id];
  const os = osOf(d);
  if (!S.flags.sawCon) { S.flags.sawCon = true; touch(); }
  if (!isIOS(d)) { if (!S.flags.conLinux) { S.flags.conLinux = true; touch(); } }
  const s = { via: 'serial', d: d.id, vm: null, stage: 'shell', user: null, ask: null };
  if (isIOS(d)) { cliState(d).mode = 'user'; if (os.con.pw) { s.stage = 'ask'; s.ask = 'conpw'; return { s, text: '\nUser Access Verification\n' }; } return { s, text: `\n${d.host} con0 is now available\n\nPress RETURN to get started.\n` }; }
  return { s, text: `\nDebian GNU/Linux 12 ${d.host} ttyS0\n\n${d.host} login: root (automatic login)\n` };
}
function sessOpenSsh(host, port) {
  if (!ipOk(host)) return { err: `Unable to open connection to ${host}\nHost does not exist` };
  const r = pcReach(host, 'tcp', +port || 22);
  if (!r.ok) return { err: `Network error: Connection timed out\n\n${r.why}` };
  if (+port !== 22) return { err: 'Network error: Connection refused' };
  const o = r.o; if (!o || o.t === 'pc') return { err: 'Network error: Connection refused' };
  if (o.t === 'vm') return { s: { via: 'ssh', d: o.vm.host, vm: o.vm.id, direct: true, stage: 'shell', user: 'root', ask: null }, text: `Using username "root".\nAuthenticating with public key "admin@portable"\nLinux ${o.vm.name} 6.1.0-18-amd64\n` };
  const d = o.d;
  if (isIOS(d)) { const why = iosSshWhy(d); if (why) return { err: `Network error: Connection refused\n\nLe SSH n’est pas prêt sur ${d.host} : ${why}.` }; }
  else if (!osOf(d).pw && kindOf(d) !== 'fw') return { err: `Network error: Connection refused\n\n${d.host} refuse la connexion de root tant qu’il n’a pas de mot de passe (commande passwd, en console).` };
  return { s: { via: 'ssh', d: d.id, vm: null, stage: 'user', user: null, ask: null }, text: '' };
}
function sessTarget(s) { return s.vm ? S.vms.find(v => v.id === s.vm) : dev(s.d); }
function sessPrompt(s) {
  const d = dev(s.d); if (!d) return '';
  if (s.stage === 'user') return 'login as: ';
  if (s.stage === 'pw') return `${s.user}@${sessHost(s)}'s password: `;
  if (s.stage === 'ask') return s.ask === 'newpw' ? 'New password: ' : 'Password: ';
  if (s.vm) { const v = sessTarget(s); return `root@${v ? v.name : 'vm'}:~# `; }
  if (isIOS(d)) return cliPrompt(d) + ' ';
  return (kindOf(d) === 'fw' ? `root@${d.host}:~# ` : `root@${d.host}:~# `);
}
const sessHost = s => { const d = dev(s.d), o = d && d.os; return o ? (o.ip || (o.svi && o.svi.ip) || d.host) : ''; };
const sessSecret = s => s.stage === 'pw' || s.stage === 'ask';
// Traite une ligne tapée. Renvoie { out, close } ; la session change d'état.
function sessInput(s, line) {
  const d = dev(s.d);
  if (!d || !D.powered[d.id]) return { out: s.via === 'ssh' ? 'Network error: Software caused connection abort' : '', close: true };
  if (s.via === 'ssh' && !s.vm && s.stage === 'shell') { const o = d.os, a = o && (o.ip || (o.svi && o.svi.ip)); if (kindOf(d) !== 'fw' && (!a || !pcReach(a, 'tcp', 22).ok)) return { out: 'Network error: Software caused connection abort', close: true }; }
  const os = osOf(d);
  if (s.stage === 'user') { s.user = line.trim(); s.stage = 'pw'; return { out: '' }; }
  if (s.stage === 'pw') {
    const good = isIOS(d) ? os.users[s.user] === line : (s.user === 'root' || s.user === 'admin') && (kindOf(d) === 'fw' ? true : os.pw === line);
    if (!good) { s.stage = 'user'; return { out: 'Access denied' }; }
    s.stage = 'shell'; if (isIOS(d)) { delete CLIM[d.id]; cliState(d).mode = 'user'; if (!S.flags.sawSsh) { S.flags.sawSsh = true; touch(); } } else { if (!S.flags.sshLinux) { S.flags.sshLinux = true; touch(); } }
    return { out: isIOS(d) ? '' : `Linux ${d.host} 6.1.0-18-amd64\nLast login: ${linuxStamp(S.t)} from ${S.pc.ip}` };
  }
  if (s.stage === 'ask') {
    const ask = s.ask; s.stage = 'shell'; s.ask = null;
    if (ask === 'enable') { if (line === os.secret) { cliState(d).mode = 'exec'; if (!S.flags.en) { S.flags.en = true; touch(); } return { out: '' }; } return { out: '% Access denied' }; }
    if (ask === 'conpw') { if (line === os.con.pw) return { out: '' }; s.stage = 'ask'; s.ask = 'conpw'; return { out: '% Bad passwords' }; }
    if (ask === 'newpw') { if (line.length < 4) return { out: 'BAD PASSWORD: The password is shorter than 4 characters\npasswd: Authentication token manipulation error' }; os.pw = line; touch(); return { out: 'passwd: password updated successfully' }; }
  }
  const raw = line.trim(), low = raw.toLowerCase();
  if (s.vm) {
    const v = sessTarget(s); if (!v) { s.vm = null; return { out: 'Connection to VM lost.' }; }
    if (low === 'exit' || low === 'logout') { if (s.via === 'ssh' && s.direct) return { out: 'logout', close: true }; s.vm = null; return { out: 'logout' }; }
    return { out: vmRun(v, raw) };
  }
  if (isIOS(d)) {
    const st = cliState(d);
    if ((st.mode === 'user' || st.mode === 'exec') && /^(exit|logout|quit)$/.test(low)) { st.mode = 'user'; return { out: '', close: true }; }
    if (st.mode === 'user' && os.secret && matchGrammar([{ p: 'enable' }], low)) { s.stage = 'ask'; s.ask = 'enable'; return { out: '' }; }
    return { out: cliRun(d, line) };
  }
  if (low === 'exit' || low === 'logout') return { out: 'logout', close: true };
  if (low === 'passwd' || low === 'passwd root') { if (kindOf(d) === 'fw') return { out: 'passwd: ce pare-feu s’administre par clé SSH, pas de mot de passe.' }; s.stage = 'ask'; s.ask = 'newpw'; return { out: '' }; }
  const out = linuxRun(d, raw);
  if (out && typeof out === 'object' && out.enter) { s.vm = out.enter; const v = sessTarget(s); return { out: `starting serial terminal on interface serial0 (press Ctrl+O to exit)\n\n${v.name} login: root (automatic login)` }; }
  return { out };
}

/* ---------- Portable : gestes ---------- */
function actPcConsole(d) {
  const pc = S.pc;
  if (d && kindOf(d) === 'odf') return "Un tiroir optique est passif : il n'a pas de port console.";
  pc.con = d ? d.id : null;
  if (d) logEvent(`Câble console du portable branché sur ${d.host}.`);
  touch(); return null;
}
function actPcEth(d, pid) {
  const pc = S.pc;
  if (!d) { pc.eth = null; touch(); return null; }
  const pd = portDef(d, pid);
  if (kindOf(d) !== 'switch') return 'Le portable se branche sur un port de switch.';
  if (!pd || pd.t !== 'rj45') return 'La carte réseau du portable est en cuivre : choisis un port RJ45.';
  if (portCable(d.id, pid)) return 'Ce port a déjà un câble.';
  pc.eth = { d: d.id, p: pid };
  logEvent(`Portable branché sur ${d.host} ${pid}.`);
  touch(); return null;
}
function actPcNet(patch) {
  const pc = S.pc;
  if (patch.dhcp) { pc.dhcp = true; touch(); return null; }
  if (!ipOk(patch.ip)) return "Adresse IP invalide. Exemple : 10.99.0.50";
  if (!maskOk(patch.mask)) return "Masque invalide. Exemple : 255.255.255.0";
  if (patch.gw && !ipOk(patch.gw)) return "Passerelle invalide. Exemple : 10.99.0.1, ou laisse vide.";
  const used = ipUsedBy(patch.ip); if (used && used !== 'pc') return "Cette adresse est déjà prise par un autre appareil : conflit d'adresses.";
  pc.dhcp = false; pc.ip = patch.ip; pc.mask = patch.mask; pc.gw = patch.gw || '';
  touch(); return null;
}
// Navigateur du portable : ce qu'affiche une adresse
function pcBrowse(url) {
  const host = String(url).trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), https = !/^http:\/\//.test(url.trim());
  if (!host) return { ok: false, title: 'Page vierge', msg: 'Tape une adresse, par exemple https://172.16.10.11' };
  if (!ipOk(host)) return { ok: false, title: 'Site inaccessible', msg: `Impossible de trouver l’adresse IP du serveur de ${host}. Dans la salle, on teste un site par son adresse IP.`, code: 'DNS_PROBE_FINISHED_NXDOMAIN' };
  const r = pcReach(host, 'tcp', https ? 443 : 80);
  if (!r.ok) return { ok: false, title: 'Ce site est inaccessible', msg: r.why, code: r.code === 'filtered' ? 'ERR_CONNECTION_TIMED_OUT' : 'ERR_ADDRESS_UNREACHABLE' };
  const o = r.o;
  if (!o || o.t !== 'vm' || !SVC[o.vm.svc].cert) return { ok: false, title: 'Ce site est inaccessible', msg: `${host} a refusé la connexion : aucun site web ne tourne à cette adresse.`, code: 'ERR_CONNECTION_REFUSED' };
  const v = o.vm, R = D.vm[v.id] || { st: 'down', R: [] };
  if (https && v.cert < S.t) return { ok: false, title: 'Votre connexion n’est pas privée', msg: `Le certificat de ${v.name} a expiré. Renouvelle-le dans la VM : certbot renew.`, code: 'NET::ERR_CERT_DATE_INVALID' };
  if (R.st === 'down') return { ok: false, title: '502 Bad Gateway', msg: (R.R.find(x => x.sev === 'bad') || { msg: 'Le service ne répond pas.' }).msg, code: 'HTTP ERROR 502' };
  const def = v.k ? contractDef(v.k) : null;
  return { ok: true, title: def ? def.client : v.name, msg: `Le site servi par ${v.name} (${SVC[v.svc].soft}) répond en ${https ? 'HTTPS, certificat valide' : 'HTTP, sans chiffrement'}.`, vm: v.id };
}

/* ---------- Vérifications des exercices ---------- */
const OSCHK = {
  sw: () => devsOfKind('switch'),
  ios: () => Object.values(S.devs).filter(d => isIOS(d) && CAT[d.type].psu),
  conOn: k => { const d = S.pc.con && dev(S.pc.con); return !!d && (!k || kindOf(d) === k); },
  renamed: () => OSCHK.sw().some(d => !/^sw-[a-z]\d\d-\d\d$/.test(d.host)),
  svi: () => OSCHK.sw().some(d => { const s = osOf(d).svi; return !!(s && s.ip && s.up && vlanOfIp(s.ip) === s.vlan && s.vlan === 99); }),
  pcPort: () => { const L = pcLink(); return L.ok && L.vlan === 99; },
  pcIp: () => !S.pc.dhcp && vlanOfIp(S.pc.ip) === 99,
  secret: () => OSCHK.sw().some(d => !!osOf(d).secret),
  user: () => OSCHK.sw().some(d => Object.keys(osOf(d).users).length > 0),
  keys: () => OSCHK.sw().some(d => osOf(d).keys),
  sshReady: () => OSCHK.sw().some(d => !iosSshWhy(d)),
  vlanMade: v => OSCHK.sw().some(d => !!osOf(d).vdb[v]),
  srvIp: () => devsOfKind('server').some(d => { const o = osOf(d); return !!o.ip && vlanOfIp(o.ip) === 99; }),
  srvTrunk: () => CHK.srvLinks().some(x => { const c = cfg(dev(x.o.d), x.o.p); return c.mode === 'trunk' && c.allowed.includes(20) && c.allowed.includes(99); }),
  srvPw: () => devsOfKind('server').some(d => !!osOf(d).pw),
  allSaved: () => OSCHK.ios().length > 0 && OSCHK.ios().every(d => !iosDirty(d)),
  fwSub: v => { const fw = devsOfKind('fw')[0], lan = fw && CAT[fw.type].ports.find(p => p.role === 'lan'); if (!lan) return false; const c = cfg(fw, lan.id); return c.mode === 'trunk' && c.allowed.includes(v); },
  pcGw: () => !S.pc.dhcp && !!VLANS[vlanOfIp(S.pc.ip)] && S.pc.gw === VLANS[vlanOfIp(S.pc.ip)].gw,
  allSecret: () => OSCHK.ios().length > 0 && OSCHK.ios().every(d => !!osOf(d).secret),
  allConPw: () => OSCHK.ios().length > 0 && OSCHK.ios().every(d => !!osOf(d).con.pw),
  allSshOnly: () => OSCHK.ios().length > 0 && OSCHK.ios().every(d => kindOf(d) === 'router' ? (d.vty && d.vty.transport === 'ssh') : osOf(d).vty.ssh && !iosSshWhy(d)),
};
