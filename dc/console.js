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
  return m.length === 1 ? m[0] : null;
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
