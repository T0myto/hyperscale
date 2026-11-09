'use strict';
/* =========================================================
   Hyperscale — console : commandes de diagnostic réalistes
   ========================================================= */
const pad = (s, n) => { s = String(s); return s.length >= n ? s + ' ' : s + ' '.repeat(n - s.length); };
const lpad = (s, n) => { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; };
function hhash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function macOf(seed, style) {
  const h = hhash(seed), h2 = hhash(seed + 'x');
  const b = [0xbc, 0x24, 0x11, (h >> 16) & 255, (h >> 8) & 255, h2 & 255];
  if (style === 'cisco') return [b.slice(0, 2), b.slice(2, 4), b.slice(4, 6)].map(x => x.map(n => n.toString(16).padStart(2, '0')).join('')).join('.');
  return b.map(n => n.toString(16).padStart(2, '0')).join(':');
}
const longIf = p => p.replace(/^Gi/, 'GigabitEthernet').replace(/^Te/, 'TenGigabitEthernet').replace(/^Fo/, 'FortyGigabitEthernet');
const stamp = t => { const c = clock(t); return `*J${c.day} ${c.hh}:${c.mm}:${String(Math.floor((t * 7.3) % 60)).padStart(2, '0')}`; };
const linuxStamp = t => { const c = clock(t); return `J${c.day} ${c.hh}:${c.mm}:${String(Math.floor((t * 7.3) % 60)).padStart(2, '0')}`; };

function promptOf(tg) {
  if (tg.vm) { const v = S.vms.find(x => x.id === tg.vm); return `root@${v ? v.name : 'vm'}:~#`; }
  const d = dev(tg.d), k = kindOf(d);
  if (k === 'switch' || k === 'router') return `${d.host}#`;
  if (k === 'fw') return `admin@${d.host}:~$`;
  return `root@${d.host}:~#`;
}
function cmdList(tg) {
  const L = [];
  const chip = (c, hint) => L.push({ c, chip: true, hint });
  const alt = c => L.push({ c, chip: false });
  if (tg.vm) {
    const v = S.vms.find(x => x.id === tg.vm); if (!v) return L;
    const s = SVC[v.svc], gw = VLANS[v.vlan].gw;
    chip(`systemctl status ${s.unit}`, 'Le service tourne-t-il ?');
    chip('ss -tulnp', 'Quels ports écoutent ?');
    chip('ip -br addr', 'Adresse IP de la VM');
    chip('ip route', 'Passerelle par défaut');
    if (gw) chip(`ping -c 3 ${gw}`, 'La passerelle répond-elle ?');
    chip('df -h', 'Espace disque');
    chip('free -h', 'Mémoire');
    chip('journalctl -n 15', 'Derniers journaux');
    if (s.ports.some(p => p[1] === 22) || v.brute) chip('journalctl -u ssh -n 15', 'Journal SSH');
    if (s.cert) chip('openssl s_client -connect localhost:443', 'Certificat TLS');
    if (['db', 'web', 'sftp', 'mail'].includes(v.svc)) chip('ls /srv/data', 'Contenu des données');
    return L;
  }
  const d = dev(tg.d), k = kindOf(d), ports = CAT[d.type].ports;
  if (k === 'switch') {
    chip('show interfaces status', 'État de tous les ports');
    chip('show vlan brief', 'VLAN et ports access');
    chip('show interfaces trunk', 'Trunks et VLAN autorisés');
    chip('show mac address-table', 'Adresses MAC apprises');
    chip('show logging', 'Journal Syslog');
    chip('show environment power', 'Alimentations');
    chip('show interfaces transceiver', 'Puissance optique');
    chip('show spanning-tree summary', 'Spanning Tree');
    for (const p of ports) { (portCable(d.id, p.id) || cfg(d, p.id).err ? chip : alt)(`show interfaces ${p.id}`, 'Compteurs du port'); alt(`show running-config interface ${p.id}`); }
  } else if (k === 'router') {
    chip('show ip interface brief', 'Interfaces et adresses');
    chip('show bgp summary', 'Sessions BGP opérateurs');
    chip('show access-lists', 'ACL et compteurs');
    chip('show ip ssh', 'Accès SSH et lignes VTY');
    alt('show ip access-lists');
    chip('show interfaces Te0/0/0', 'Lien opérateur 1');
    chip('show interfaces transceiver', 'Puissance optique');
    chip('show logging', 'Journal Syslog');
    chip('show environment power', 'Alimentations');
    for (const p of ports) alt(`show interfaces ${p.id}`);
  } else if (k === 'fw') {
    chip('show interfaces', 'Interfaces et VLAN');
    chip('nft list ruleset', 'Règles actives');
    chip('show log', 'Journal (flux refusés)');
    chip('conntrack -S', 'Table de sessions');
    chip('show environment power', 'Alimentations');
  } else if (k === 'server' || k === 'nas') {
    chip('ip -br link', 'État des cartes réseau');
    if (k === 'server') chip('qm list', 'Machines virtuelles');
    if (k === 'server') chip('free -h', 'Mémoire de l’hôte');
    chip('cat /proc/mdstat', 'État du RAID');
    chip('df -h', 'Espace de stockage');
    if (k === 'nas') chip('exportfs -v', 'Partages NFS');
    chip('ipmitool sdr type "Power Supply"', 'Alimentations (BMC)');
    chip('ipmitool sdr type Temperature', 'Températures (BMC)');
    chip('journalctl -p err -n 15', 'Erreurs système');
    for (const p of ports) { (portCable(d.id, p.id) ? chip : alt)(`ethtool ${p.id}`, 'Lien de la carte'); if (p.t !== 'rj45') alt(`ethtool -m ${p.id}`); }
    if (k === 'server') for (const v of S.vms) if (VLANS[v.vlan] && VLANS[v.vlan].net) alt(`arping -I vmbr0 ${v.ip}`);
    if (S.flags.ipdup) chip(`arping -I vmbr0 ${S.flags.ipdup.ip}`, 'Qui répond à cette IP ?');
  }
  return L;
}
function matchCommand(tg, input) {
  const norm = input.trim().replace(/\s+/g, ' ');
  if (!norm) return null;
  const list = cmdList(tg).map(x => x.c);
  const exact = list.find(c => c.toLowerCase() === norm.toLowerCase());
  if (exact) return exact;
  const tk = norm.toLowerCase().split(' ');
  const m = list.filter(c => { const ct = c.toLowerCase().split(' '); return ct.length === tk.length && ct.every((t, i) => t.startsWith(tk[i])); });
  if (m.length === 1) return m[0];
  // « gi1/0/2 » désigne Gi1/0/2, pas Gi1/0/20 : on garde les candidats dont le dernier mot est exact
  const ex = m.filter(c => c.toLowerCase().split(' ').pop() === tk[tk.length - 1]);
  return ex.length === 1 ? ex[0] : null;
}
function runCommand(tg, input) {
  const norm = input.trim().replace(/\s+/g, ' ');
  if (norm === 'help' || norm === '?') return 'Commandes disponibles :\n' + cmdList(tg).filter(x => x.chip).map(x => '  ' + x.c).join('\n') + '\nLes abréviations Cisco marchent : « sh int st » = show interfaces status.';
  const c = matchCommand(tg, norm);
  if (!c) return `% Commande inconnue ou ambiguë : « ${norm} ». Tape « help » pour la liste.`;
  try { return tg.vm ? vmCmd(S.vms.find(x => x.id === tg.vm), c) : devCmd(dev(tg.d), c); }
  catch (e) { return '% Erreur : ' + e.message; }
}

/* ---------- Équipements réseau ---------- */
function portState(d, p) {
  const c = portCable(d.id, p.id), k = hasCfg(d, p) ? cfg(d, p.id) : null;
  if (k && k.err) return { st: 'err-disabled', up: false, c };
  if (k && !k.admin) return { st: 'disabled', up: false, c };
  if (!c) return { st: 'notconnect', up: false, c };
  const L = D.link[c.id];
  return { st: L.up ? 'connected' : 'notconnect', up: L.up, c, L };
}
function mediaType(d, p) {
  const c = portCable(d.id, p.id);
  if (p.t === 'rj45') return '10/100/1000BaseTX';
  if (c && CABLES[c.type].noModule) return p.t === 'sfp' ? 'SFP-10GBase-CX1' : 'QSFP-40G-CR4';
  const m = d.mods[p.id];
  return m ? MODULES[m].std[p.t] : 'Not Present';
}
function crcCount(c) { return c && c.dmg ? Math.floor((S.t - (c.crcT || S.t)) * 41 + 127) : 0; }
function lateCount(d, p, st) { return st.L && st.L.mismatch ? 1200 + Math.floor((S.t % 600) * 3) : 0; }
function devCmd(d, c) {
  const k = kindOf(d), ports = CAT[d.type].ports;
  if (!D.powered[d.id]) return `% ${d.host} ne répond pas : l'équipement est hors tension.`;
  const out = [];
  if (c === 'show interfaces status') {
    out.push(pad('Port', 12) + pad('Name', 20) + pad('Status', 13) + pad('Vlan', 8) + pad('Duplex', 8) + pad('Speed', 7) + 'Type');
    for (const p of ports) {
      const st = portState(d, p), kc = cfg(d, p.id);
      const peer = st.c ? otherEnd(st.c, d.id, p.id) : null;
      const name = kc.desc || (peer ? `${nameOf(dev(peer.d))} ${peer.p}` : '');
      const vlan = kc.mode === 'trunk' ? 'trunk' : kc.vlan;
      const dup = kc.duplex === 'auto' ? (st.up ? (st.L.mismatch ? 'a-half' : 'a-full') : 'auto') : kc.duplex;
      const spd = kc.speed === 'auto' ? (st.up ? 'a-' + (p.speed >= 10000 ? p.speed / 1000 + 'G' : p.speed) : 'auto') : kc.speed;
      out.push(pad(p.id, 12) + pad(name.slice(0, 18), 20) + pad(st.st, 13) + pad(vlan, 8) + pad(dup, 8) + pad(spd, 7) + mediaType(d, p));
    }
  } else if (c.startsWith('show interfaces ') && !['show interfaces status', 'show interfaces trunk', 'show interfaces transceiver'].includes(c)) {
    const p = ports.find(x => x.id === c.slice(16)); if (!p) return '% Interface invalide';
    const st = portState(d, p), kc = hasCfg(d, p) ? cfg(d, p.id) : { desc: '' };
    const line = st.st === 'disabled' ? 'is administratively down, line protocol is down (disabled)' : st.st === 'err-disabled' ? 'is down, line protocol is down (err-disabled)' : st.up ? 'is up, line protocol is up (connected)' : 'is down, line protocol is down (notconnect)';
    const use = st.c ? (D.cUse[st.c.id] || 0) : 0;
    const bps = Math.round(use * 1e6 * (k === 'router' && p.role === 'wan' ? 1 : 0.6));
    const crc = crcCount(st.c), late = lateCount(d, p, st);
    out.push(`${longIf(p.id)} ${line}`,
      `  Hardware is ${p.t === 'rj45' ? 'Gigabit Ethernet' : p.t === 'sfp' ? 'Ten Gigabit Ethernet' : 'Forty Gigabit Ethernet'}, address is ${macOf(d.id + p.id, 'cisco')}`,
      kc.desc ? `  Description: ${kc.desc}` : `  Description: ${st.c ? 'vers ' + nameOf(dev(otherEnd(st.c, d.id, p.id).d)) : '-'}`,
      `  MTU 1500 bytes, BW ${p.speed * 1000} Kbit/sec, DLY 10 usec`,
      st.up ? `  ${st.L.mismatch && kc.duplex === 'auto' ? 'Half' : 'Full'}-duplex, ${p.speed >= 10000 ? p.speed / 1000 + 'Gb/s' : p.speed + 'Mb/s'}, media type is ${mediaType(d, p)}` : `  Auto-duplex, Auto-speed, media type is ${mediaType(d, p)}`,
      `  5 minute input rate ${bps} bits/sec, ${Math.round(bps / 9000)} packets/sec`,
      `  5 minute output rate ${Math.round(bps * 0.4)} bits/sec, ${Math.round(bps / 22000)} packets/sec`,
      `     ${Math.floor(S.t * 3121)} packets input, ${Math.floor(S.t * 2911042)} bytes`,
      `     ${crc ? crc + 8 : 0} input errors, ${crc} CRC, ${Math.floor(crc / 9)} frame, 0 overrun, 0 ignored`,
      `     0 output errors, ${late ? late * 3 : 0} collisions, 0 interface resets`,
      `     ${late} late collision, 0 deferred`,
      `     ${(D.cUse[st.c && st.c.id] || 0) > (st.L && st.L.speed || 1e9) ? Math.floor(S.t * 77) : 0} output drops`);
    if (k === 'router' && p.role === 'wan' && S.flags.ddos && S.flags.ddos.kind === 'vol' && !S.fwopt.scrub) out.push('  !! Utilisation en entrée : 100 %, 1 834 221 input drops (file pleine)');
  } else if (c === 'show vlan brief') {
    out.push(pad('VLAN', 5) + pad('Name', 33) + pad('Status', 10) + 'Ports', '---- -------------------------------- --------- -------------------------------');
    for (const v of VLAN_IDS) {
      const list = ports.filter(p => hasCfg(d, p) && cfg(d, p.id).mode === 'access' && cfg(d, p.id).vlan === v).map(p => p.id);
      const rows = []; for (let i = 0; i < Math.max(1, list.length); i += 4) rows.push(list.slice(i, i + 4).join(', '));
      out.push(pad(v, 5) + pad(VLANS[v].name, 33) + pad('active', 10) + rows[0]);
      rows.slice(1).forEach(r => out.push(' '.repeat(48) + r));
    }
  } else if (c === 'show interfaces trunk') {
    const tr = ports.filter(p => hasCfg(d, p) && cfg(d, p.id).mode === 'trunk');
    if (!tr.length) return "Aucun port en mode trunk sur ce switch.";
    out.push(pad('Port', 12) + pad('Mode', 13) + pad('Encapsulation', 15) + pad('Status', 14) + 'Native vlan');
    tr.forEach(p => { const st = portState(d, p); out.push(pad(p.id, 12) + pad('on', 13) + pad('802.1q', 15) + pad(st.up ? 'trunking' : 'not-trunking', 14) + cfg(d, p.id).native); });
    out.push('', pad('Port', 12) + 'Vlans allowed on trunk');
    tr.forEach(p => out.push(pad(p.id, 12) + (cfg(d, p.id).allowed.join(',') || 'none')));
    out.push('', pad('Port', 12) + 'Vlans allowed and active in management domain');
    tr.forEach(p => out.push(pad(p.id, 12) + (cfg(d, p.id).allowed.filter(v => VLANS[v]).join(',') || 'none')));
  } else if (c === 'show mac address-table') {
    out.push('          Mac Address Table', '-------------------------------------------', pad('Vlan', 8) + pad('Mac Address', 18) + pad('Type', 12) + 'Ports', pad('----', 8) + pad('-----------', 18) + pad('--------', 12) + '-----');
    let n = 0;
    for (const l of D.adj[d.id] || []) {
      const o = dev(l.other.d), ok = kindOf(o);
      for (const v of VLAN_IDS) {
        if (!carries(l.me, v)) continue;
        if (ok === 'server' && portDef(o, l.other.p).role !== 'bmc') S.vms.filter(x => x.host === o.id && x.vlan === v && x.st !== 'stopped' && !x.isolated).forEach(x => { out.push(pad(lpad(v, 4), 8) + pad(macOf(x.id, 'cisco'), 18) + pad('DYNAMIC', 12) + l.me.p); n++; });
        else if ((ok === 'server' || ok === 'nas') && carries(l.me, v) && cfg(d, l.me.p).mode === 'access') { out.push(pad(lpad(v, 4), 8) + pad(macOf(o.id + l.other.p, 'cisco'), 18) + pad('DYNAMIC', 12) + l.me.p); n++; }
        else if (ok === 'fw' && carries(l.other, v)) { out.push(pad(lpad(v, 4), 8) + pad(macOf(o.id + 'v' + v, 'cisco'), 18) + pad('DYNAMIC', 12) + l.me.p); n++; }
        else if (ok === 'rogue' && v === cfg(d, l.me.p).vlan) { out.push(pad(lpad(v, 4), 8) + pad('0011.2233.4455', 18) + pad('DYNAMIC', 12) + l.me.p); n++; }
      }
    }
    out.push(`Total Mac Addresses for this criterion: ${n}`);
  } else if (c === 'show logging') {
    const L = S.syslog.filter(x => x.d === d.id).slice(-25);
    out.push('Syslog logging: enabled (0 messages dropped)', `    Trap logging: level informational, ${L.length} message lines logged`, `    Logging to 10.99.0.20 (udp port 514)`, '', 'Log Buffer (16384 bytes):');
    if (!L.length) out.push('(aucun message récent)');
    L.forEach(x => out.push(`${stamp(x.t)}: ${x.msg}`));
  } else if (c === 'show environment power') {
    out.push(pad('PS', 5) + pad('Model', 20) + pad('Status', 18) + 'Watts');
    d.psus.forEach((p, i) => {
      const live = p.out && pduLive(d.rack, p.out.pdu);
      const st = !p.ok ? 'Bad (failed)' : !p.out ? 'No Input Power' : !live ? 'No Input Power' : 'OK';
      out.push(pad(`${i + 1}`, 5) + pad(`PWR-${CAT[d.type].w[1] > 300 ? 750 : 350}W-AC`, 20) + pad(st, 18) + (st === 'OK' ? Math.round(D.draw[d.id] / d.psus.filter(x => x.ok && x.out && pduLive(d.rack, x.out.pdu)).length) : 0));
      if (p.out) out.push(`     └ prise ${p.out.i + 1} du PDU ${p.out.pdu} (baie ${rackName(d.rack)})`);
    });
    if (d.psus.length === 1) out.push('', '! Une seule alimentation : cet équipement est un point unique de panne.');
    out.push('', `SYSTEM TEMPERATURE is ${(D.temp[d.rack] || 20) > 32 ? 'CRITICAL' : (D.temp[d.rack] || 20) > 27 ? 'WARNING' : 'OK'}, inlet ${(D.temp[d.rack] || 20).toFixed(1)} C`);
  } else if (c === 'show interfaces transceiver') {
    out.push(pad('Port', 12) + pad('Module', 18) + pad('Temp(C)', 9) + pad('Tx(dBm)', 9) + 'Rx(dBm)', '---------   ---------------   -------  -------  -------');
    let n = 0;
    for (const p of ports) {
      const m = d.mods[p.id]; if (!m) continue;
      const st = portState(d, p);
      const rx = d.modFail[p.id] ? -40.0 : st.up ? -2.1 - (hhash(p.id) % 30) / 10 : -40.0;
      const tx = d.modFail[p.id] ? -40.0 : -1.8 - (hhash(p.id + 't') % 10) / 10;
      out.push(pad(p.id, 12) + pad(MODULES[m].std[p.t], 18) + pad((31 + (hhash(p.id) % 60) / 10).toFixed(1), 9) + pad(tx.toFixed(1), 9) + rx.toFixed(1) + (rx <= -30 ? '   -- alarme Rx low' : ''));
      n++;
    }
    if (!n) out.push('(aucun module optique : les DAC n\'ont pas de diagnostic optique)');
  } else if (c === 'show spanning-tree summary') {
    out.push('Switch is in rapid-pvst mode', `Root bridge for: ${S.flags.stp && S.flags.stp.sw === d.id ? 'none (un équipement inconnu revendique le rôle de root)' : 'VLAN0010, VLAN0020, VLAN0099'}`,
      'PortFast BPDU Guard Default  is disabled', `Topology changes in last 5 min: ${S.flags.stp && S.flags.stp.sw === d.id ? 37 : 0}`, '',
      pad('Name', 22) + pad('Blocking', 10) + pad('Forwarding', 12) + 'STP Active');
    for (const v of VLAN_IDS) { const n = (D.adj[d.id] || []).filter(l => carries(l.me, v)).length; if (n) out.push(pad('VLAN' + String(v).padStart(4, '0'), 22) + pad(0, 10) + pad(n, 12) + n); }
  } else if (c.startsWith('show running-config interface ')) {
    const p = c.slice(30), kc = cfg(d, p);
    out.push('Building configuration...', '!', `interface ${longIf(p)}`);
    if (kc.desc) out.push(` description ${kc.desc}`);
    if (kc.mode === 'access') out.push(' switchport mode access', ` switchport access vlan ${kc.vlan}`);
    else out.push(' switchport mode trunk', ` switchport trunk native vlan ${kc.native}`, ` switchport trunk allowed vlan ${kc.allowed.join(',') || 'none'}`, ' switchport nonegotiate');
    if (kc.speed !== 'auto') out.push(` speed ${kc.speed}`);
    if (kc.duplex !== 'auto') out.push(` duplex ${kc.duplex}`);
    if (kc.psec) out.push(' switchport port-security', ' switchport port-security violation restrict');
    if (kc.bpdu) out.push(' spanning-tree portfast', ' spanning-tree bpduguard enable');
    if (!kc.admin) out.push(' shutdown');
    out.push('end');
  } else if (c === 'show ip interface brief') {
    out.push(pad('Interface', 23) + pad('IP-Address', 16) + pad('OK?', 4) + pad('Method', 7) + pad('Status', 22) + 'Protocol');
    const ips = { 'Te0/0/0': '198.51.100.2', 'Te0/0/1': '192.0.2.2', 'Te0/1/0': '203.0.113.1', 'Te0/1/1': 'unassigned', Gi0: '10.99.0.2' };
    for (const p of ports) { const st = portState(d, p); out.push(pad(p.id, 23) + pad(ips[p.id] || 'unassigned', 16) + pad('YES', 4) + pad('NVRAM', 7) + pad(st.up ? 'up' : 'down', 22) + (st.up ? 'up' : 'down')); }
  } else if (c === 'show ip ssh') {
    const v = vtyOf(d);
    out.push('SSH Enabled - version 2.0', 'Authentication methods: publickey, keyboard-interactive, password', 'Authentication timeout: 120 secs; Authentication retries: 3', '',
      `! line vty 0 4 : transport input ${v.transport === 'all' ? 'telnet ssh' : v.transport}${v.transport === 'ssh' ? '' : '  (Telnet accepté : les mots de passe circulent en clair)'}`,
      `! access-class : ${v.acl ? v.acl + ' in' : 'aucune  (tout Internet peut tenter sa chance)'}`);
  } else if (c === 'show access-lists' || c === 'show ip access-lists') {
    out.push(...aclShow(d));
  } else if (c === 'show bgp summary') {
    out.push('BGP router identifier 203.0.113.1, local AS number 64512', 'BGP table version is 42, main routing table version 42', '',
      pad('Neighbor', 16) + pad('V', 4) + pad('AS', 7) + pad('MsgRcvd', 9) + pad('MsgSent', 9) + pad('Up/Down', 10) + 'State/PfxRcd');
    const up1 = (() => { const c1 = portCable(d.id, 'Te0/0/0'); return c1 && D.link[c1.id].up; })();
    const up2 = (() => { const c2 = portCable(d.id, 'Te0/0/1'); return c2 && D.link[c2.id].up; })();
    out.push(pad('198.51.100.1', 16) + pad(4, 4) + pad(3215, 7) + pad(up1 ? Math.floor(S.t * 2) : 0, 9) + pad(up1 ? Math.floor(S.t * 2) : 0, 9) + pad(up1 ? '1d02h' : 'never', 10) + (up1 ? '1 (route par défaut)' : 'Active'));
    out.push(pad('192.0.2.1', 16) + pad(4, 4) + pad(5410, 7) + pad(up2 ? Math.floor(S.t) : 0, 9) + pad(up2 ? Math.floor(S.t) : 0, 9) + pad(up2 ? '03:12:44' : 'never', 10) + (up2 ? '1 (route par défaut)' : S.room.op2 ? 'Active' : 'Idle (pas de second opérateur)'));
    out.push('', `Routes vers Internet : ${(up1 ? 1 : 0) + (up2 ? 1 : 0)} lien(s) opérateur actif(s).`);
  } else if (c === 'show interfaces') {
    out.push(pad('Port', 8) + pad('Rôle', 8) + pad('État', 7) + 'Adresses');
    for (const p of ports) {
      const st = portState(d, p);
      let addr = '';
      if (p.role === 'wan') addr = 'wan0 203.0.113.2/29';
      else if (p.role === 'mgmt') addr = 'mgmt 10.99.0.3/24';
      else { const kc = cfg(d, p.id); const vl = kc.mode === 'access' ? [kc.vlan] : kc.allowed; addr = vl.filter(v => VLANS[v] && VLANS[v].gw).map(v => `vlan${v} ${VLANS[v].gw}/24`).join(', ') || '(aucun VLAN routé)'; addr = (kc.mode === 'trunk' ? 'trunk : ' : 'access : ') + addr; }
      out.push(pad(p.id, 8) + pad(p.role || '', 8) + pad(st.up ? 'up' : 'down', 7) + addr);
    }
  } else if (c === 'nft list ruleset') {
    out.push('table inet filtre {', '    chain forward {', '        type filter hook forward priority 0; policy drop;', '        ct state established,related accept');
    if (S.fwopt.block.length) out.push(`        ip saddr { ${S.fwopt.block.join(', ')} } drop`);
    S.rules.forEach(r => out.push('        ' + nftLine(r).replace('nft add rule inet filtre forward ', '')));
    out.push('        log prefix "DROP " counter drop', '    }', '}');
  } else if (c === 'show log') {
    S.flags.readLog = true;
    const L = S.syslog.filter(x => x.d === d.id).slice(-25);
    if (!L.length) out.push('(journal vide)');
    L.forEach(x => out.push(`${linuxStamp(x.t)} ${d.host} ${x.msg}`));
  } else if (c === 'conntrack -S') {
    const full = S.flags.ddos && S.flags.ddos.kind === 'syn' && !S.fwopt.syn;
    out.push(`cpu=0 found=${Math.floor(S.t * 9)} invalid=${full ? 88123 : 12} insert=0 insert_failed=${full ? 120344 : 0} drop=${full ? 230211 : 0} early_drop=${full ? 9921 : 0} error=0 search_restart=0`,
      `entries=${full ? 262144 : 300 + S.vms.length * 140} (max 262144)${full ? '   -- table pleine : connexions SYN_RECV en masse' : ''}`);
  } else return devHostCmd(d, c);
  return out.join('\n');
}

/* ---------- Serveurs et baie de stockage ---------- */
function devHostCmd(d, c) {
  const out = [], ports = CAT[d.type].ports;
  if (c === 'ip -br link') {
    for (const p of ports) {
      if (p.role === 'bmc') continue;
      const st = portState(d, p);
      out.push(pad(p.id, 10) + pad(st.up ? 'UP' : 'DOWN', 8) + pad(macOf(d.id + p.id), 19) + (st.up ? '<BROADCAST,MULTICAST,UP,LOWER_UP>' : '<NO-CARRIER,BROADCAST,MULTICAST,UP>'));
    }
    out.push(pad('vmbr0', 10) + pad('UP', 8) + pad(macOf(d.id + 'br'), 19) + '<BROADCAST,MULTICAST,UP,LOWER_UP>   (pont VLAN-aware des VM)');
  } else if (c === 'qm list') {
    out.push(lpad('VMID', 10) + ' ' + pad('NAME', 20) + pad('STATUS', 11) + lpad('MEM(MB)', 9) + lpad('BOOTDISK(GB)', 14));
    S.vms.filter(v => v.host === d.id).forEach(v => out.push(lpad(v.vmid, 10) + ' ' + pad(v.name, 20) + pad(v.st === 'running' || v.st === 'encrypted' ? 'running' : v.st === 'crashed' ? 'running' : 'stopped', 11) + lpad(v.ram * 1024, 9) + lpad(v.disk.toFixed(2), 14)));
    if (!S.vms.some(v => v.host === d.id)) out.push('(aucune VM)');
  } else if (c === 'free -h') {
    const u = hostUsed(d);
    out.push(pad('', 14) + lpad('total', 10) + lpad('used', 10) + lpad('free', 10), pad('Mem:', 14) + lpad(d.ram + 'Gi', 10) + lpad(u.ram + 3 + 'Gi', 10) + lpad(Math.max(0, d.ram - u.ram - 3) + 'Gi', 10), pad('Swap:', 14) + lpad('8Gi', 10) + lpad('0B', 10) + lpad('8Gi', 10));
    out.push('', `vCPU alloués : ${u.vcpu} pour ${CAT[d.type].cores} cœurs (ratio ${(u.vcpu / CAT[d.type].cores).toFixed(2)}:1)`);
  } else if (c === 'cat /proc/mdstat') {
    const A = arrayInfo(d), present = d.disks.map((x, i) => x ? { x, i } : null).filter(Boolean);
    if (d.raid === 'none' || !A.valid) { out.push('Personalities :', 'unused devices: <none>', '', d.raid === 'none' ? '(aucune grappe RAID : les disques sont utilisés séparément)' : '(grappe non configurée)'); return out.join('\n'); }
    out.push('Personalities : [raid0] [raid1] [raid6] [raid5] [raid4] [raid10]');
    const members = present.map(({ x, i }, k) => `${diskName(i).slice(5)}1[${k}]${x.st === 'failed' ? '(F)' : ''}`).join(' ');
    out.push(`md0 : ${A.state === 'fail' ? 'inactive' : 'active'} raid${d.raid} ${members}`);
    const ok = present.filter(p => p.x.st === 'ok').length;
    out.push(`      ${Math.round(A.usable * 976562500)} blocks super 1.2 [${A.n}/${ok}] [${present.map(p => p.x.st === 'ok' ? 'U' : '_').join('')}]`);
    const rb = present.find(p => p.x.st === 'rebuild');
    if (rb) { const pc = rb.x.rb * 100; out.push(`      [${'='.repeat(Math.floor(pc / 5))}>${'.'.repeat(20 - Math.floor(pc / 5))}]  recovery = ${pc.toFixed(1)}% finish=${Math.round((1 - rb.x.rb) * DISKS[rb.x.type].size * 20)}min`); }
    out.push('', 'unused devices: <none>');
    if (A.state === 'deg') out.push('', '!! Grappe dégradée : un « _ » remplace un disque absent ou en panne.');
    if (A.state === 'fail') out.push('', '!! Grappe détruite : trop de disques perdus, les données ne sont plus lisibles.');
  } else if (c === 'df -h') {
    const A = arrayInfo(d), used = storeUsed(d);
    out.push(pad('Filesystem', 26) + lpad('Size', 7) + lpad('Used', 7) + lpad('Avail', 7) + lpad('Use%', 6) + ' Mounted on');
    out.push(pad('/dev/md0', 26) + lpad(A.usable.toFixed(1) + 'T', 7) + lpad(used.toFixed(2) + 'T', 7) + lpad(Math.max(0, A.usable - used).toFixed(1) + 'T', 7) + lpad(A.usable ? Math.round(used / A.usable * 100) + '%' : '-', 6) + (kindOf(d) === 'nas' ? ' /export/vm' : ' /var/lib/vz'));
  } else if (c === 'exportfs -v') {
    out.push(`/export/vm      10.30.0.0/24(sync,wdelay,hide,no_subtree_check,sec=sys,rw,root_squash)`, '', 'Partage NFS joignable uniquement depuis le VLAN 30 (stockage).');
  } else if (c === 'ipmitool sdr type "Power Supply"') {
    d.psus.forEach((p, i) => {
      const live = p.out && pduLive(d.rack, p.out.pdu);
      out.push(pad(`PS${i + 1} Status`, 17) + '| ' + pad((0x74 + i).toString(16) + 'h', 5) + '| ' + pad(p.ok ? 'ok' : 'cr', 4) + '| ' + pad(`10.${i + 1}`, 5) + '| ' + (!p.ok ? 'Presence detected, Failure detected' : !live ? 'Presence detected, Power Supply AC lost' : 'Presence detected'));
    });
    const good = d.psus.filter(p => p.ok && p.out && pduLive(d.rack, p.out.pdu));
    const sameFeed = good.length === 2 && good[0].out.pdu === good[1].out.pdu;
    out.push(pad('PS Redundancy', 17) + '| 77h | ' + pad(good.length === 2 ? 'ok' : 'cr', 4) + '| 7.1  | ' + (good.length === 2 ? (sameFeed ? 'Fully Redundant (mais les deux PSU sont sur la même voie !)' : 'Fully Redundant') : 'Redundancy Lost'));
  } else if (c === 'ipmitool sdr type Temperature') {
    const t = D.temp[d.rack] || 20, cpu = t + 25 + (D.util[d.id] || 0) * 25;
    out.push(pad('Inlet Temp', 17) + `| 04h | ${t > 32 ? 'cr' : t > 27 ? 'nc' : 'ok'} | 7.1 | ${t.toFixed(0)} degrees C`, pad('Exhaust Temp', 17) + `| 01h | ok | 7.1 | ${(t + 12 + (D.util[d.id] || 0) * 8).toFixed(0)} degrees C`, pad('CPU1 Temp', 17) + `| 0Eh | ${cpu > 85 ? 'nc' : 'ok'} | 3.1 | ${cpu.toFixed(0)} degrees C`);
    out.push('', 'Recommandation ASHRAE pour l\'entrée d\'air : 18 à 27 °C.');
  } else if (c === 'journalctl -p err -n 15') {
    const L = S.syslog.filter(x => x.d === d.id && x.sev <= 3).slice(-15);
    if (!L.length) out.push('-- No entries --');
    L.forEach(x => out.push(`${linuxStamp(x.t)} ${d.host} ${x.msg}`));
  } else if (c.startsWith('ethtool -m ')) {
    const p = ports.find(x => x.id === c.slice(11)); const m = d.mods[p.id], cab = portCable(d.id, p.id);
    if (!m) return cab && CABLES[cab.type].noModule ? 'Cable is a DAC: no optical diagnostics' : 'Cannot get module EEPROM information: No such device';
    const st = portState(d, p);
    out.push(`Identifier : 0x03 (SFP)`, `Transceiver type : ${MODULES[m].std[p.t]}`, `Laser output power : ${d.modFail[p.id] ? '0.0001 mW / -40.00 dBm' : '0.6531 mW / -1.85 dBm'}`, `Receiver signal average optical power : ${d.modFail[p.id] || !st.up ? '0.0001 mW / -40.00 dBm' : '0.5012 mW / -3.00 dBm'}`);
  } else if (c.startsWith('ethtool ')) {
    const p = ports.find(x => x.id === c.slice(8)); const st = portState(d, p);
    out.push(`Settings for ${p.id}:`, `	Supported ports: [ ${p.t === 'rj45' ? 'TP' : 'FIBRE'} ]`, `	Speed: ${st.up ? speedName(st.L.speed).replace(' ', '') : 'Unknown!'}`, `	Duplex: ${st.up ? (st.L.mismatch ? 'Full (l\'autre côté est en half : collisions)' : 'Full') : 'Unknown! (255)'}`, '	Auto-negotiation: on', `	Link detected: ${st.up ? 'yes' : 'no'}`);
  } else if (c.startsWith('arping -I vmbr0 ')) {
    const ip = c.slice(16);
    const owners = S.vms.filter(v => v.ip === ip && v.st !== 'stopped');
    out.push(`ARPING ${ip} from ${VLANS[owners[0] ? owners[0].vlan : 10].net}.250 vmbr0`);
    if (!owners.length) out.push('Timeout', 'Sent 3 probes, Received 0 responses');
    else { for (let i = 0; i < 3; i++) owners.forEach(o => out.push(`Unicast reply from ${ip} [${macOf(o.id).toUpperCase()}]  0.${600 + i * 31 + owners.indexOf(o) * 7}ms`)); out.push(`Sent 3 probes, Received ${3 * owners.length} responses${owners.length > 1 ? '   !! deux adresses MAC différentes répondent' : ''}`); }
  } else return `% ${c} : commande non disponible sur cet équipement.`;
  return out.join('\n');
}

/* ---------- Machines virtuelles ---------- */
function vmCmd(v, c) {
  if (!v) return '% VM introuvable.';
  const s = SVC[v.svc], host = dev(v.host), gw = VLANS[v.vlan].gw, out = [];
  if (!host || !D.powered[host.id]) return `% ${v.name} ne répond pas : son hôte est hors tension.`;
  if (v.st === 'stopped') return `% ${v.name} est arrêtée. Démarre-la (qm start ${v.vmid}).`;
  if (v.st === 'lost') return `% ${v.name} ne démarre plus : son disque virtuel est introuvable (grappe RAID détruite).`;
  if (v.st === 'restoring') return `% Restauration de ${v.name} en cours (${Math.ceil(v.rs)} min restantes).`;
  const running = v.st === 'running';
  if (c.startsWith('systemctl status ')) {
    out.push(`● ${s.unit}.service - ${s.soft}`, `     Loaded: loaded (/lib/systemd/system/${s.unit}.service; enabled; preset: enabled)`);
    if (v.st === 'crashed') out.push(`     Active: failed (Result: oom-kill) since ${linuxStamp(S.t - 5)}`, `    Process: 812 ExecStart=/usr/sbin/${s.unit} (code=killed, signal=KILL)`);
    else if (v.st === 'encrypted') out.push(`     Active: failed (Result: exit-code) since ${linuxStamp(S.t - 10)}`, `     ${s.unit}: impossible d'ouvrir les fichiers de données (format inconnu)`);
    else if (v.fill >= 1) out.push(`     Active: failed (Result: exit-code)`, `     ${s.unit}: No space left on device`);
    else out.push(`     Active: active (running) since ${linuxStamp(Math.max(0, S.t - 300))}`, `   Main PID: 812 (${s.unit.split('@')[0]})`, `     Memory: ${Math.round(v.ram * 1024 * (0.35 + (v.leak || 0) * 0.6))}M`);
  } else if (c === 'ss -tulnp') {
    out.push(pad('Netid', 7) + pad('State', 8) + pad('Local Address:Port', 24) + 'Process');
    if (running && v.fill < 1) s.ports.forEach(p => out.push(pad(p[0], 7) + pad(p[0] === 'tcp' ? 'LISTEN' : 'UNCONN', 8) + pad(`0.0.0.0:${p[1]}`, 24) + `users:(("${s.unit.split('@')[0]}",pid=812,fd=6))`));
    out.push(pad('tcp', 7) + pad('LISTEN', 8) + pad('10.99.0.0/24:22', 24) + 'users:(("sshd",pid=611,fd=3))   (SSH d\'administration)');
  } else if (c === 'ip -br addr') {
    out.push(pad('lo', 12) + pad('UNKNOWN', 9) + '127.0.0.1/8', pad('eth0', 12) + pad(v.isolated ? 'DOWN' : 'UP', 9) + `${v.ip}/24`);
  } else if (c === 'ip route') {
    if (gw) out.push(`default via ${gw} dev eth0 proto static`);
    out.push(`${VLANS[v.vlan].net}.0/24 dev eth0 proto kernel scope link src ${v.ip}`);
    if (gw && ipCheck(v.ip, v.vlan, v.id) && !(ipCheck(v.ip, v.vlan, v.id) || '').includes('déjà')) out.push('', `!! L'adresse ${v.ip} n'est pas dans le réseau de la passerelle ${gw} : la route par défaut est injoignable.`);
  } else if (c.startsWith('ping -c 3 ')) {
    const target = c.slice(10);
    const r = l2Search(host.id, p => portDef(host, p).role !== 'bmc', v.vlan, gwGoal);
    const ok = !v.isolated && r.ok && !ipCheck(v.ip, v.vlan, v.id);
    out.push(`PING ${target} (${target}) 56(84) bytes of data.`);
    if (ok) { for (let i = 1; i <= 3; i++) out.push(`64 bytes from ${target}: icmp_seq=${i} ttl=64 time=0.${300 + i * 41} ms`); out.push('', `--- ${target} ping statistics ---`, '3 packets transmitted, 3 received, 0% packet loss'); }
    else { for (let i = 1; i <= 3; i++) out.push(`From ${v.ip} icmp_seq=${i} Destination Host Unreachable`); out.push('', `--- ${target} ping statistics ---`, '3 packets transmitted, 0 received, +3 errors, 100% packet loss'); }
  } else if (c === 'df -h') {
    const sz = v.disk, used = sz * v.fill;
    out.push(pad('Filesystem', 12) + lpad('Size', 7) + lpad('Used', 7) + lpad('Avail', 7) + lpad('Use%', 6) + ' Mounted on', pad('/dev/sda1', 12) + lpad(sz + 'G', 7) + lpad(used.toFixed(0) + 'G', 7) + lpad((sz - used).toFixed(0) + 'G', 7) + lpad(Math.round(v.fill * 100) + '%', 6) + ' /');
    if (v.fill > 0.9) out.push('', 'du -sh /var/log/* | sort -h | tail -2', `${(used * 0.6).toFixed(0)}G	/var/log/${s.unit.split('@')[0]}`, `${(used * 0.1).toFixed(0)}G	/var/log/journal`);
  } else if (c === 'free -h') {
    const used = Math.min(v.ram, v.ram * (0.35 + (v.leak || 0) * 0.65));
    out.push(pad('', 8) + lpad('total', 9) + lpad('used', 9) + lpad('free', 9), pad('Mem:', 8) + lpad(v.ram + 'Gi', 9) + lpad(used.toFixed(1) + 'Gi', 9) + lpad((v.ram - used).toFixed(1) + 'Gi', 9));
    if (v.leak) out.push('', '!! La mémoire utilisée grimpe sans redescendre : fuite mémoire probable.');
  } else if (c === 'journalctl -n 15') {
    const L = [];
    L.push(`${linuxStamp(S.t - 40)} ${v.name} systemd[1]: Started ${s.unit}.service.`);
    if (v.leak) L.push(`${linuxStamp(S.t - 4)} ${v.name} kernel: ${s.unit} invoked oom-killer: gfp_mask=0x140cca, order=0`);
    if (v.st === 'crashed') L.push(`${linuxStamp(S.t - 3)} ${v.name} kernel: Out of memory: Killed process 812 (${s.unit}) total-vm:${v.ram * 1000}MB`);
    if (v.fill > 0.9) L.push(`${linuxStamp(S.t - 2)} ${v.name} ${s.unit}: [crit] write() failed (28: No space left on device)`);
    if (s.cert && v.cert < S.t) L.push(`${linuxStamp(S.t - 1)} ${v.name} ${s.unit}: SSL_do_handshake() failed: certificate has expired`);
    if (v.encrypted) L.push(`${linuxStamp(S.t - 9)} ${v.name} kernel: audit: 18234 fichiers renommés en .locked par /tmp/.x`);
    out.push(...L);
  } else if (c === 'journalctl -u ssh -n 15') {
    if (v.brute) for (let i = 0; i < 12; i++) out.push(`${linuxStamp(S.t - 12 + i)} ${v.name} sshd[${2200 + i}]: Failed password for ${['root', 'admin', 'ubuntu', 'test'][i % 4]} from ${v.brute} port ${40000 + i * 113} ssh2`);
    else out.push(`${linuxStamp(S.t - 60)} ${v.name} sshd[611]: Accepted publickey for admin from 10.99.0.42 port 51234 ssh2`);
    if (v.f2b && v.brute) out.push(`${linuxStamp(S.t)} ${v.name} fail2ban.actions: NOTICE [sshd] Ban ${v.brute}`);
  } else if (c === 'openssl s_client -connect localhost:443') {
    const exp = v.cert < S.t, c2 = clock(v.cert);
    out.push('CONNECTED(00000003)', `depth=0 CN = ${v.name}.client.fr`, `notAfter = J${c2.day} ${c2.hh}:${c2.mm}`, `Verify return code: ${exp ? '10 (certificate has expired)' : '0 (ok)'}`);
    if (!exp) out.push('', `Renouvellement automatique ACME : ${v.acme ? 'activé' : 'désactivé'}`);
  } else if (c === 'ls /srv/data') {
    if (v.encrypted) out.push('clients.csv.locked  factures_2026.ods.locked  base.sql.locked  photos.tar.locked  README_DECRYPT.txt');
    else out.push('clients.csv  factures_2026.ods  base.sql  photos.tar');
  } else return `% ${c} : commande non disponible.`;
  return out.join('\n');
}

/* =========================================================
   Mode configuration façon Cisco IOS (onglet CLI des fenêtres)
   exec (#) → configure terminal → (config)# → interface → (config-if)#
   ========================================================= */
const CLIM = {};
let CLI_SELF = false;
function cliState(d) { return CLIM[d.id] || (CLIM[d.id] = { mode: 'exec', ifs: [], acl: null }); }
const isIOS = d => ['switch', 'router'].includes(kindOf(d));
function cliPrompt(d) {
  const st = cliState(d);
  if (!isIOS(d) || st.mode === 'exec') return promptOf({ d: d.id });
  if (st.mode === 'config') return `${d.host}(config)#`;
  if (st.mode === 'acl') return `${d.host}(config-ext-nacl)#`;
  if (st.mode === 'line') return `${d.host}(config-line)#`;
  return `${d.host}(config-if${st.ifs.length > 1 ? '-range' : ''})#`;
}
// « gi1/0/1 », « g1/0/1 », « GigabitEthernet1/0/1 » et « te1/1/1 » désignent un port ; « gi1/0/1-4 » une plage
function findPorts(d, txt) {
  const t = txt.replace(/\s+/g, '').toLowerCase();
  const m = t.match(/^([a-z-]*)(\d+(?:\/\d+)*)(?:-(\d+))?$/);
  if (!m) return [];
  const [, pre, num, last] = m;
  const base = num.split('/'), lo = +base[base.length - 1], hi = last ? +last : lo;
  const out = [];
  for (const p of CAT[d.type].ports) {
    const pm = p.id.match(/^([A-Za-z-]+)([\d/]+)$/); if (!pm) continue;
    const pnum = pm[2].split('/');
    if (pnum.length !== base.length || pnum.slice(0, -1).join('/') !== base.slice(0, -1).join('/')) continue;
    const n = +pnum[pnum.length - 1]; if (n < lo || n > hi) continue;
    if (pre && !longIf(p.id).toLowerCase().startsWith(pre) && !p.id.toLowerCase().startsWith(pre)) continue;
    out.push(p.id);
  }
  return out;
}
function vlanList(txt, cur) {
  const t = txt.trim().toLowerCase();
  if (t === 'all') return VLAN_IDS.filter(v => v !== 1);
  if (t === 'none') return [];
  let mode = 'set', rest = t;
  const mm = t.match(/^(add|remove|except)\s+(.+)$/); if (mm) { mode = mm[1]; rest = mm[2]; }
  const ids = [];
  for (const part of rest.split(',')) {
    const r = part.trim().match(/^(\d+)(?:-(\d+))?$/); if (!r) return null;
    for (let v = +r[1]; v <= +(r[2] || r[1]); v++) ids.push(v);
  }
  const bad = ids.filter(v => !VLAN_IDS.includes(v));
  if (bad.length) return { bad };
  const all = VLAN_IDS.filter(v => v !== 1);
  const res = mode === 'add' ? [...new Set([...cur, ...ids])] : mode === 'remove' ? cur.filter(v => !ids.includes(v)) : mode === 'except' ? all.filter(v => !ids.includes(v)) : ids;
  return res.filter(v => v !== 1).sort((a, b) => a - b);
}
// Grammaire : mot-clé (abrégeable), {a|b} choix, <n> nombre, <rest> fin de ligne, <rest?> fin facultative
const IF_CMDS = [
  { p: 'shutdown', h: 'éteindre le port', f: () => ({ admin: false }) },
  { p: 'no shutdown', h: 'allumer le port', f: () => ({ admin: true }) },
  { p: 'switchport mode {access|trunk}', h: 'access : un seul VLAN · trunk : plusieurs VLAN étiquetés', f: (a, c) => a[0] === 'trunk' && !c.allowed.length ? { mode: 'trunk', allowed: VLAN_IDS.filter(v => v !== 1) } : { mode: a[0] } },
  { p: 'switchport access vlan <n>', h: 'VLAN du port en mode access', f: a => VLAN_IDS.includes(a[0]) ? { vlan: a[0] } : `% VLAN ${a[0]} absent du plan d'adressage (VLAN ${VLAN_IDS.join(', ')})` },
  { p: 'switchport trunk allowed vlan <rest>', h: 'VLAN du trunk : 10,20,99 · add 30 · remove 30', f: (a, c) => { const l = vlanList(a[0], c.allowed); return !l ? '% Liste de VLAN illisible. Exemple : switchport trunk allowed vlan 10,20,99' : l.bad ? `% VLAN ${l.bad.join(', ')} absent du plan d'adressage` : { allowed: l }; } },
  { p: 'switchport trunk native vlan <n>', h: 'VLAN natif (non étiqueté) : 999 recommandé', f: a => [1, 999].includes(a[0]) ? { native: a[0] } : '% Dans cette salle, le VLAN natif est 1 (déconseillé) ou 999 (dédié)' },
  { p: 'switchport nonegotiate', h: 'désactive DTP (négociation du trunk)', f: () => ({}) },
  { p: 'speed {auto|100|1000}', h: 'vitesse du port cuivre', rj: true, f: a => ({ speed: a[0] }) },
  { p: 'duplex {auto|full|half}', h: 'duplex : les deux bouts doivent être pareils', rj: true, f: a => ({ duplex: a[0] }) },
  { p: 'spanning-tree portfast', h: 'forwarding immédiat (ports vers des serveurs)', f: () => ({}) },
  { p: 'spanning-tree bpduguard enable', h: 'coupe le port si un switch y est branché', f: () => ({ bpdu: true }) },
  { p: 'no spanning-tree bpduguard enable', h: 'retire BPDU Guard', f: () => ({ bpdu: false }) },
  { p: 'switchport port-security <rest?>', h: 'limite le nombre d’adresses MAC du port', f: () => ({ psec: true }) },
  { p: 'no switchport port-security', h: 'retire Port Security', f: () => ({ psec: false }) },
  { p: 'description <rest>', h: 'note libre : à quoi sert ce port', f: a => ({ desc: a[0].slice(0, 24) }) },
  { p: 'no description', h: 'efface la description', f: () => ({ desc: '' }) },
];
const CONF_CMDS = [
  { p: 'interface <rest>', h: 'entrer dans un port : interface Gi1/0/1' },
  { p: 'interface range <rest>', h: 'plusieurs ports : interface range Gi1/0/1-4' },
  { p: 'vlan <n>', h: 'vérifier qu’un VLAN existe', sw: true },
  { p: 'ip access-list extended <rest>', h: 'créer ou modifier une ACL nommée', rt: true },
  { p: 'no ip access-list extended <rest>', h: 'supprimer une ACL nommée', rt: true },
  { p: 'access-list <n> <rest>', h: 'ACL numérotée : 1-99 standard, 100-199 étendue', rt: true },
  { p: 'no access-list <n>', h: 'supprimer une ACL numérotée', rt: true },
  { p: 'line vty <rest>', h: 'lignes d’accès à distance : line vty 0 4', rt: true },
  { p: 'hostname <rest>', h: 'nom de l’équipement' },
];
function matchGrammar(list, input) {
  const tk = input.split(' ');
  const hits = [];
  for (const c of list) {
    const pt = c.p.split(' '), args = []; let ok = true, exact = true, i = 0;
    for (let j = 0; j < pt.length && ok; j++) {
      const p = pt[j];
      if (p === '<rest>' || p === '<rest?>') { const r = tk.slice(i).join(' '); if (!r && p === '<rest>') ok = false; args.push(r); i = tk.length; continue; }
      const t = tk[i++]; if (t === undefined) { ok = false; break; }
      if (p === '<n>') { if (/^\d+$/.test(t)) args.push(+t); else ok = false; }
      else if (p[0] === '{') { const all = p.slice(1, -1).split('|'), o = all.includes(t) ? [t] : all.filter(x => x.startsWith(t)); if (o.length === 1) args.push(o[0]); else ok = false; }
      else if (p.startsWith(t)) { if (p !== t) exact = false; }
      else ok = false;
    }
    if (ok && i === tk.length) hits.push({ c, args, exact, n: pt.length });
  }
  if (hits.length <= 1) return hits[0] || null;
  const ex = hits.filter(h => h.exact); if (ex.length === 1) return ex[0];
  // « interface range … » l'emporte sur « interface <rest> »
  const max = Math.max(...hits.map(h => h.n)), top = hits.filter(h => h.n === max);
  return top.length === 1 ? top[0] : { ambiguous: true };
}
function cliHelp(d) {
  const st = cliState(d), row = (a, b) => `  ${pad(a, 40)}${b}`;
  if (st.mode === 'if' && kindOf(d) !== 'router') return 'Commandes d’une interface :\n' + IF_CMDS.map(c => row(c.p.replace(/[{}]/g, '').replace(/\|/g, '/').replace(/ <rest\?>/, '').replace('<n>', 'N').replace('<rest>', '…'), c.h)).join('\n') + '\n' + row('exit / end', 'revenir en arrière / au mode privilégié') + '\n' + row('do show …', 'lancer une commande show sans quitter');
  if (st.mode === 'acl') return `ACL ${st.acl} : chaque ligne est lue de haut en bas, la première qui correspond décide.\n` + [
    ['permit|deny PROTO SOURCE DESTINATION [eq PORT]', 'ajoute une ligne à la fin (numéro +10)'], ['N permit|deny …', 'insère une ligne au numéro N (ex. 15)'], ['no N', 'supprime la ligne N'],
    ['PROTO', 'ip (tout), tcp, udp, icmp'], ['SOURCE / DESTINATION', 'any · host 203.0.113.10 · 10.0.0.0 0.255.255.255'], ['exit / end', 'revenir en arrière / au mode privilégié'], ['do show access-lists', 'voir l’ACL et ses compteurs']].map(x => row(x[0], x[1])).join('\n') + '\n! À la fin, un « deny ip any any » invisible refuse tout le reste.';
  if (st.mode === 'line') return 'Lignes d’accès à distance (VTY 0 à 4) :\n' + LINE_CMDS.map(c => row(c.p.replace(' <rest>', ' …'), c.h)).join('\n') + '\n' + row('exit / end', 'revenir en arrière / au mode privilégié');
  if (st.mode === 'if' && kindOf(d) === 'router') return 'Commandes d’une interface du routeur :\n' + RIF_CMDS.map(c => row(c.p.replace(' <rest>', ' NOM in'), c.h)).join('\n') + '\n' + row('exit / end', 'revenir en arrière / au mode privilégié');
  if (st.mode === 'config') return 'Mode configuration globale :\n' + confCmds(d).map(c => row(c.p.replace(' <rest>', ' …').replace(' <n>', ' N'), c.h)).join('\n') + '\n' + row('end', 'revenir au mode privilégié') + '\n' + row('do show …', 'lancer une commande show');
  return runCommand({ d: d.id }, 'help') + (isIOS(d) ? '\nPour configurer : « configure terminal » (abrégé « conf t »).' : '');
}
// Exécute une ligne et renvoie le texte à afficher. Les réglages passent par les mêmes actions que les formulaires.
function cliRun(d, input) {
  const raw = input.trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const low = raw.toLowerCase(), st = cliState(d);
  if (low === '?' || low === 'help') return cliHelp(d);
  if (!isIOS(d)) {
    if (/^(conf|configure|interface|int |switchport|vlan )/.test(low)) return kindOf(d) === 'fw' ? '% Ce pare-feu tourne sous Linux (nftables) : ses règles se règlent dans l’onglet Config. Ici, les commandes de diagnostic (help).' : '% Cet équipement se règle dans l’onglet Config. Ici, les commandes de diagnostic (help).';
    return runCommand({ d: d.id }, raw);
  }
  if (low === 'end' || low === '^z') { st.mode = 'exec'; st.ifs = []; st.acl = null; return ''; }
  if (low === 'exit') { if (st.mode === 'if' || st.mode === 'acl' || st.mode === 'line') { st.mode = 'config'; st.ifs = []; st.acl = null; } else st.mode = 'exec'; return ''; }
  if (/^en(a|ab|abl|able)?$/.test(low)) return '';
  if (st.mode !== 'exec' && low.startsWith('do ')) return runCommand({ d: d.id }, raw.slice(3));
  if (st.mode === 'exec') {
    if (/^conf(i|ig|igu|igur|igure)?( t(e|er|erm|ermi|ermin|ermina|erminal)?)?$/.test(low)) { st.mode = 'config'; return 'Enter configuration commands, one per line.  End with CNTL/Z.'; }
    if (/^(wr|write|write memory|copy run(ning-config)? start(up-config)?)$/.test(low)) return 'Building configuration...\n[OK]\n! Configuration copiée en mémoire non volatile : elle survivra à un redémarrage.';
    return runCommand({ d: d.id }, raw);
  }
  if (st.mode !== 'exec' && /^conf(i|ig|igu|igur|igure)?( t\w*)?$/.test(low)) return '! Tu es déjà en mode configuration.';
  if (st.mode === 'config') {
    const m = matchGrammar(confCmds(d), low);
    if (!m) return `% Invalid input detected.\n! Commande inconnue en mode configuration. Tape « ? » pour la liste.`;
    if (m.ambiguous) return `% Ambiguous command: "${raw}"`;
    const k = m.c.p.split(' ')[0];
    if (m.c.rt) return aclConf(d, m, raw);
    if (k === 'interface') {
      const ports = findPorts(d, m.args[0]);
      if (!ports.length) return `% Interface inconnue : « ${m.args[0]} ». Exemple : interface ${CAT[d.type].ports[0].id}`;
      if (kindOf(d) !== 'router' && !hasCfg(d, portDef(d, ports[0]))) return `% ${ports[0]} : rien à configurer sur ce port pour l’instant.`;
      st.mode = 'if'; st.ifs = ports;
      return ports.length > 1 ? `! ${ports.length} ports sélectionnés : ${ports[0]} à ${ports[ports.length - 1]}` : '';
    }
    if (k === 'vlan') return VLAN_IDS.includes(m.args[0]) ? `! Le VLAN ${m.args[0]} (${VLANS[m.args[0]].name}) existe déjà dans la base VLAN.` : `% VLAN ${m.args[0]} hors du plan d'adressage de la salle (VLAN ${VLAN_IDS.join(', ')}).`;
    if (k === 'hostname') return `! Les noms d'hôte suivent la convention de la salle (${d.host}) : on les garde.`;
    return '';
  }
  if (st.mode === 'acl') return aclEntryCmd(d, st.acl, raw);
  if (st.mode === 'line') return lineCmd(d, low, raw);
  if (kindOf(d) === 'router') return routerIfCmd(d, st.ifs, low, raw);
  // mode interface
  const m = matchGrammar(IF_CMDS, low);
  if (!m) return `% Invalid input detected.\n! Commande inconnue pour une interface. Tape « ? » pour la liste.`;
  if (m.ambiguous) return `% Ambiguous command: "${raw}"`;
  const notes = [];
  let keys = [];
  for (const pid of st.ifs) {
    const pd = portDef(d, pid);
    if (m.c.rj && pd.t !== 'rj45') { notes.push(`% ${pid} : réglage réservé aux ports cuivre.`); continue; }
    const patch = m.c.f(m.args, cfg(d, pid));
    if (typeof patch === 'string') return patch;
    keys = Object.keys(patch);
    if (keys.length) { CLI_SELF = true; try { actPortCfg(d, pid, patch); } finally { CLI_SELF = false; } }
  }
  const c = cfg(d, st.ifs[0]), who = st.ifs.length > 1 ? st.ifs.length + ' ports' : st.ifs[0];
  const what = { mode: () => c.mode === 'access' ? `mode access, VLAN ${c.vlan}` : `mode trunk, VLAN autorisés ${c.allowed.join(',') || 'aucun'}`, vlan: () => `VLAN d'accès ${c.vlan} (${VLANS[c.vlan].name})`, allowed: () => `VLAN autorisés ${c.allowed.join(',') || 'aucun'}`, native: () => `VLAN natif ${c.native}`, admin: () => c.admin ? 'port allumé' : 'port éteint (administratively down)' };
  const key = keys.find(k => what[k]);
  if (key) notes.push(`! ${who} : ${what[key]()}`);
  return notes.join('\n');
}
// Commandes proposées en bas du terminal, selon le mode
function cliChips(d) {
  const st = cliState(d);
  if (kindOf(d) === 'router' && st.mode !== 'exec') {
    const nm = Object.keys(aclOf(d).lists)[0] || 'EDGE-IN';
    const std = Object.keys(aclOf(d).lists).find(n => /^\d+$/.test(n) && +n < 100) || '10';
    const L = st.mode === 'line' ? ['transport input ssh', `access-class ${std} in`, 'do show ip ssh', 'exit']
      : st.mode === 'acl' ? ['deny ip 10.0.0.0 0.255.255.255 any', 'permit tcp host 198.51.100.1 host 198.51.100.2 eq bgp', 'permit tcp any host 203.0.113.10 eq 443', 'no 10', 'do show access-lists', 'exit']
      : st.mode === 'if' ? [`ip access-group ${nm} in`, `no ip access-group ${nm} in`, 'do show access-lists', 'exit']
      : [`ip access-list extended ${nm}`, 'access-list 10 permit 10.99.0.0 0.0.0.255', 'line vty 0 4', 'interface Te0/0/0', 'do show access-lists'];
    return L.concat(['end', '?']).map(c => ({ c }));
  }
  if (isIOS(d) && st.mode === 'if') {
    const L = ['switchport mode access', 'switchport access vlan 10', 'switchport mode trunk', 'switchport trunk allowed vlan 10,20,99', 'switchport trunk native vlan 999', 'no shutdown', 'shutdown', 'description vers-srv'];
    if (kindOf(d) === 'switch') L.push('spanning-tree bpduguard enable');
    return L.concat(['exit', 'end', '?']).map(c => ({ c }));
  }
  if (isIOS(d) && st.mode === 'config') {
    const cabled = CAT[d.type].ports.find(p => hasCfg(d, p) && portCable(d.id, p.id)) || CAT[d.type].ports.find(p => hasCfg(d, p));
    const L = [];
    if (cabled) L.push(`interface ${cabled.id}`);
    if (kindOf(d) === 'switch') L.push(`interface range ${unusedRange(d)}`);
    return L.concat(['vlan 10', 'do show vlan brief', 'end', '?']).map(c => ({ c }));
  }
  const L = cmdList({ d: d.id }).filter(x => x.chip).map(x => ({ c: x.c, h: x.hint }));
  if (isIOS(d)) L.unshift({ c: 'configure terminal', h: 'Passer en mode configuration' });
  return L;
}

// Premier bloc de ports libres et allumés d'un switch, pour « interface range » (ex. Gi1/0/3-24)
function unusedRange(sw) {
  const ps = CAT[sw.type].ports.filter(p => p.role !== 'mgmt');
  const free = ps.map(p => !portCable(sw.id, p.id) && cfg(sw, p.id).admin);
  const i = free.indexOf(true); if (i < 0) return ps[0].id + '-' + ps[ps.length - 1].id.match(/\d+$/)[0];
  const pre = ps[i].id.replace(/\d+$/, '');
  let j = i; while (j + 1 < ps.length && free[j + 1] && ps[j + 1].id.replace(/\d+$/, '') === pre) j++;
  return i === j ? ps[i].id : ps[i].id + '-' + ps[j].id.match(/\d+$/)[0];
}
/* ---------- ACL dans la CLI du routeur ---------- */
const confCmds = d => CONF_CMDS.filter(c => (!c.rt || kindOf(d) === 'router') && (!c.sw || kindOf(d) === 'switch'));
const RIF_CMDS = [
  { p: 'ip access-group <rest>', h: 'filtre ce qui entre par ce port avec l’ACL NOM' },
  { p: 'no ip access-group <rest>', h: 'retire l’ACL de ce port' },
];
const aclName = s => /^[A-Za-z][\w-]{0,23}$/.test(s) || /^\d{1,3}$/.test(s);
function cliAct(fn) { CLI_SELF = true; try { return fn(); } finally { CLI_SELF = false; } }
// ip access-list extended / access-list N … en mode configuration
function aclConf(d, m, raw) {
  const st = cliState(d), p = m.c.p;
  if (p.startsWith('line vty')) {
    if (!/^0( 4| 15)?$/.test(m.args[0].trim())) return '% Les lignes d’accès à distance se règlent ensemble : line vty 0 4';
    st.mode = 'line'; return '';
  }
  if (p.startsWith('ip access-list')) {
    const name = raw.split(' ').pop();
    if (!aclName(name)) return '% Nom d’ACL invalide : lettres, chiffres, tirets (ex. EDGE-IN).';
    const A = aclOf(d), isNew = !A.lists[name];
    if (isNew) A.lists[name] = [];
    st.mode = 'acl'; st.acl = name;
    return isNew ? `! ACL étendue ${name} créée (vide). Ajoute des lignes permit / deny, dans l’ordre.` : `! ACL ${name} : ${A.lists[name].length} ligne(s). Les nouvelles lignes s’ajoutent à la fin.`;
  }
  if (p.startsWith('no ip access-list')) { const name = raw.split(' ').pop(); const r = cliAct(() => actAclDrop(d, name)); return r ? '% ' + r : `! ACL ${name} supprimée.`; }
  if (p.startsWith('no access-list')) { const r = cliAct(() => actAclDrop(d, String(m.args[0]))); return r ? '% ' + r : `! ACL ${m.args[0]} supprimée.`; }
  const n = m.args[0];
  if (!(n >= 1 && n <= 199)) return '% Numéro d’ACL : 1 à 99 (standard, source seule) ou 100 à 199 (étendue).';
  const e = aclParse(m.args[1], n < 100);
  if (typeof e === 'string') return e;
  const r = cliAct(() => actAclAdd(d, String(n), e));
  return typeof r === 'string' ? '% ' + r : `! ACL ${n} ${n < 100 ? 'standard' : 'étendue'}, ligne ${r.seq} : ${n < 100 ? aclStd(r) : aclLine(r)}`;
}
// Une ligne tapée en mode (config-ext-nacl)
function aclEntryCmd(d, name, raw) {
  let t = raw.trim();
  const no = t.match(/^no\s+(\d+)$/i);
  if (no) { const r = cliAct(() => actAclDel(d, name, +no[1])); return r ? '% ' + r : `! Ligne ${no[1]} supprimée.`; }
  if (/^rem(a|ar|ark)?\b/i.test(t)) return '! Remarque notée : elle documente l’ACL sans rien filtrer.';
  let seq = null;
  const sm = t.match(/^(\d+)\s+(.+)$/); if (sm) { seq = +sm[1]; t = sm[2]; }
  t = t.replace(/^(pe|per|perm|permi)\b/i, 'permit').replace(/^(de|den)\b/i, 'deny');
  const e = aclParse(t, false);
  if (typeof e === 'string') return e;
  const r = cliAct(() => actAclAdd(d, name, e, seq));
  return typeof r === 'string' ? '% ' + r : `! Ligne ${r.seq} : ${aclLine(r)}`;
}
function routerIfCmd(d, ifs, low, raw) {
  const m = matchGrammar(RIF_CMDS, low);
  if (!m) return '% Invalid input detected.\n! Sur ce routeur, une interface accepte « ip access-group NOM in ». Tape « ? ».';
  const parts = m.args[0].split(' '), name = parts[0], dir = parts[1] || '';
  if (!/^in$/i.test(dir)) return dir === 'out' ? '% Ici, on filtre en entrée (in) : au plus près de la source, avant que le trafic traverse le routeur.' : '% Précise le sens : ip access-group NOM in';
  const real = Object.keys(aclOf(d).lists).find(x => x.toLowerCase() === name.toLowerCase());
  const out = [];
  for (const pid of ifs) {
    if (m.c.p.startsWith('no')) { cliAct(() => actAclApply(d, pid, null)); out.push(`! ${pid} : plus aucune ACL en entrée.`); continue; }
    if (!real) return `% L’ACL ${name} n’existe pas encore : crée-la avec « ip access-list extended ${name} ».`;
    cliAct(() => actAclApply(d, pid, real));
    out.push(`! ${pid} : l’ACL ${real} filtre tout ce qui entre par ce port.${portDef(d, pid).role === 'wan' ? '' : ' (Ce port ne mène pas aux opérateurs.)'}`);
  }
  return out.join('\n');
}
// show access-lists, avec des compteurs plausibles depuis la mise en service
function aclShow(d) {
  const A = aclOf(d), names = Object.keys(A.lists), out = [];
  if (!names.length) return ['! Aucune ACL. Pour en créer une : conf t, puis ip access-list extended EDGE-IN.'];
  const hits = {};
  for (const [pid, nm] of Object.entries(A.in)) {
    const L = A.lists[nm] || [], mins = Math.max(1, S.t - ((A.since || {})[pid] ?? S.t));
    for (const k of aclPkts(wanOp(d, pid) || 1)) { const r = aclEval(L, k); if (r.i >= 0) hits[nm + ':' + r.e.seq] = (hits[nm + ':' + r.e.seq] || 0) + Math.round(k.w * mins); }
  }
  for (const nm of names) {
    const std = /^\d+$/.test(nm) && +nm < 100;
    out.push(`${std ? 'Standard' : 'Extended'} IP access list ${nm}`);
    for (const e of A.lists[nm]) {
      const h = hits[nm + ':' + e.seq];
      out.push(`    ${e.seq} ${std ? aclStd(e) : aclLine(e)}${h ? ` (${h} matches)` : ''}`);
    }
    const on = Object.keys(A.in).filter(p => A.in[p] === nm);
    const vty = vtyOf(d).acl === nm;
    if (on.length) out.push(`    ! appliquée en entrée sur ${on.join(', ')}`);
    else if (!vty) out.push('    ! appliquée sur aucune interface : elle ne filtre rien pour l’instant');
    if (vty) out.push(`    ! posée sur les lignes VTY (access-class ${nm} in)`);
  }
  out.push('! Tout paquet qui ne correspond à aucune ligne est refusé (deny implicite).');
  return out;
}
// ACL standard : source seule, affichée comme IOS (« 192.168.1.0, wildcard bits 0.0.0.255 »)
const aclStd = e => e.act + ' ' + (e.src === 'any' ? 'any' : e.src.startsWith('host ') ? e.src.slice(5) : e.src.replace(' ', ', wildcard bits '));
// Mode (config-line) des lignes VTY
const LINE_CMDS = [
  { p: 'transport input <rest>', h: 'protocoles acceptés : ssh (chiffré) plutôt que telnet (en clair)' },
  { p: 'access-class <rest>', h: 'filtre qui peut se connecter : access-class 10 in (ACL standard)' },
  { p: 'no access-class <rest>', h: 'retire l’ACL des lignes' },
  { p: 'login local', h: 'comptes locaux (déjà en place dans la salle)' },
];
function lineCmd(d, low, raw) {
  const m = matchGrammar(LINE_CMDS, low);
  if (!m) return '% Invalid input detected.\n! Sur une ligne VTY : transport input ssh, access-class 10 in. Tape « ? ».';
  if (m.c.p === 'login local') return '! Les comptes locaux sont déjà en place dans la salle.';
  if (m.c.p.startsWith('transport')) {
    const t = m.args[0].split(' ').filter(Boolean);
    if (!t.length || !t.every(x => ['ssh', 'telnet', 'all', 'none'].includes(x))) return '% Choix possibles : ssh, telnet, all, none.';
    const v = t.includes('all') || (t.includes('ssh') && t.includes('telnet')) ? 'all' : t[0];
    cliAct(() => actVty(d, { transport: v }));
    return v === 'ssh' ? '! Seul SSH (chiffré) est accepté sur les lignes VTY.' : v === 'none' ? '! Plus aucune connexion à distance possible : attention à ne pas t’enfermer dehors.' : '! Telnet est accepté : identifiants et commandes circulent en clair sur le réseau.';
  }
  const parts = raw.trim().split(/\s+/).slice(m.c.p.startsWith('no') ? 2 : 1), name = parts[0] || '', dir = (parts[1] || '').toLowerCase();
  if (m.c.p.startsWith('no')) { cliAct(() => actVty(d, { acl: null })); return '! Plus aucune ACL sur les lignes VTY.'; }
  if (dir !== 'in') return '% Précise le sens : access-class 10 in';
  if (!(/^\d+$/.test(name) && +name < 100)) return '% Sur une ligne VTY, on pose une ACL standard (1 à 99) : seule l’adresse source compte.';
  if (!aclOf(d).lists[name]) return `% L’ACL ${name} n’existe pas : crée-la d’abord (access-list ${name} permit 10.99.0.0 0.0.0.255).`;
  cliAct(() => actVty(d, { acl: name }));
  return `! Lignes VTY : seules les sources autorisées par l’ACL ${name} peuvent ouvrir une session.`;
}
