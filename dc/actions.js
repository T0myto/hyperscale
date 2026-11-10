'use strict';
/* =========================================================
   Hyperscale — actions du joueur (avec commande équivalente)
   ========================================================= */
function pay(c, what) {
  if (S.money < c) return `Fonds insuffisants : ${money(c)} nécessaires pour ${what}.`;
  S.money -= c;
  return null;
}
const ZIF = { Internet: 'wan0', DMZ: 'vlan10', SERVEURS: 'vlan20', ADMIN: 'vlan99', STOCKAGE: 'vlan30' };

/* ---------- Équipements ---------- */
// Retire les obturateurs des unités où l'on installe un équipement
function clearBlanks(r, u, h, ignore) {
  const m = slotMap(r, ignore);
  for (let k = 0; k < h; k++) { const o = m[u + k]; if (o && dev(o) && kindOf(dev(o)) === 'blank') delete S.devs[o]; }
}
function actPlace(type, r, u) {
  const c = CAT[type];
  if (!S.racks[r] || S.racks[r].kind !== 'rack') return "Le matériel s'installe dans tes baies, pas dans la salle opérateurs.";
  if (!fits(type, r, u)) return "Pas assez d'unités libres à cet endroit.";
  const e = pay(c.cost, c.name); if (e) return e;
  if (type !== 'blank') clearBlanks(r, u, c.u);
  const d = addDevice(type, r, u);
  logEvent(`${c.name}${d.host ? ' ' + d.host : ''} installé en baie ${rackName(r)}, U${u}.`);
  if (typeof learnHook === 'function') learnHook('place', d);
  touch();
  return d;
}
function actMove(id, r, u) {
  const d = dev(id);
  if (CAT[d.type].fixed) return "Cet équipement appartient au datacenter.";
  if (!S.racks[r] || S.racks[r].kind !== 'rack') return "Choisis une de tes baies.";
  if (!fits(d.type, r, u, id)) return "Pas assez d'unités libres à cet endroit.";
  if (d.rack !== r) d.psus.forEach(p => { p.out = null; });
  clearBlanks(r, u, CAT[d.type].u, id);
  d.rack = r; d.u = u;
  logEvent(`${nameOf(d)} déplacé en baie ${rackName(r)}, U${u}.`);
  touch();
  return d;
}
function actRemove(id) {
  const d = dev(id);
  if (CAT[d.type].fixed) return "Cet équipement appartient au datacenter.";
  if (S.vms.some(v => v.host === id || v.sto === id)) return "Supprime d'abord les VM hébergées ou stockées sur cet équipement.";
  if (S.vms.length && devsOfKind('fw').length === 1 && kindOf(d) === 'fw') return "C'est ton seul pare-feu : tous les services en dépendent.";
  S.cables = S.cables.filter(c => c.a.d !== id && c.b.d !== id);
  delete S.devs[id];
  const refund = Math.round(CAT[d.type].cost * ECO.resale);
  S.money += refund;
  logEvent(`${nameOf(d)} retiré et revendu ${money(refund)}.`);
  touch();
  return null;
}
function actPowerToggle(d) {
  d.on = !d.on;
  logEvent(`${nameOf(d)} ${d.on ? 'rallumé' : 'éteint'} depuis le bouton.`);
  touch();
}

/* ---------- Alimentation ---------- */
function actPlug(d, i, pdu) { const e = plugPSU(d, i, pdu); if (!e) cli(d, [`# PSU${i + 1} → PDU ${pdu}, prise ${d.psus[i].out.i + 1}`]); return e; }
function actUnplug(d, i) { d.psus[i].out = null; logEvent(`${nameOf(d)} : PSU${i + 1} débranchée.`); touch(); return null; }
function actReplacePSU(d, i) {
  const e = pay(180, "un bloc d'alimentation"); if (e) return e;
  d.psus[i].ok = true;
  syslog(d, 5, `%PLATFORM_ENV-5-PWR: Power supply ${i + 1} is now OK`);
  logEvent(`${nameOf(d)} : bloc d'alimentation ${i + 1} remplacé à chaud.`, 'good');
  touch(); return null;
}
function actResetBreaker(r, p) {
  S.racks[r].trip[p] = false;
  logEvent(`Disjoncteur du PDU ${p} (baie ${rackName(r)}) réarmé.`);
  touch(); return null;
}

/* ---------- Câbles et modules ---------- */
function actConnect(type, a, b) {
  const chk = cableCheck(type, a, b);
  if (!chk.ok) return chk.why;
  const e = pay(chk.cost, 'le câble'); if (e) return e;
  for (const m of chk.mods) dev(m.d).mods[m.p] = CABLES[type].module;
  const c = addCable(type, a, b);
  c.len = chk.L;
  logEvent(`${CABLES[type].name} de ${fmtLen(chk.L)} posé : ${nameOf(dev(a.d))} ${a.p} ↔ ${nameOf(dev(b.d))} ${b.p}.`);
  if (typeof learnHook === 'function') learnHook('cable', c);
  return c;
}
function actDisconnect(cid) {
  const c = S.cables.find(x => x.id === cid); if (!c) return null;
  S.cables = S.cables.filter(x => x.id !== cid);
  logEvent(`Câble débranché : ${c.a.p} ↔ ${c.b.p}.`);
  touch(); return null;
}
function actReplaceCable(cid) {
  const c = S.cables.find(x => x.id === cid); if (!c) return null;
  const ct = CABLES[c.type];
  const e = pay(Math.round(ct.base + ct.perM * c.len), 'un câble neuf'); if (e) return e;
  c.dmg = false; c.cut = false; c.crc = 0;
  c.len = Math.max(c.len, stdLen(cableLen(c.a, c.b)));
  logEvent(`Câble ${c.a.p} ↔ ${c.b.p} remplacé par un neuf.`, 'good');
  touch(); return null;
}
function actModule(d, pid, m) {
  const pd = portDef(d, pid);
  if (pd.op) return "Ce module appartient à l'opérateur.";
  const cab = portCable(d.id, pid);
  if (cab && CABLES[cab.type].noModule && m) return "Un DAC occupe déjà la cage : il a ses modules intégrés.";
  if (m) { const e = pay(MODULES[m].price[pd.t], 'le module'); if (e) return e; }
  if (m) d.mods[pid] = m; else delete d.mods[pid];
  delete d.modFail[pid];
  cli(d, [m ? `! insertion d'un module ${MODULES[m].std[pd.t]} dans ${pid}` : `! module retiré de ${pid}`]);
  touch(); return null;
}
function actReplaceModule(d, pid) {
  const pd = portDef(d, pid), m = d.mods[pid]; if (!m) return null;
  const e = pay(MODULES[m].price[pd.t], 'un module neuf'); if (e) return e;
  delete d.modFail[pid];
  syslog(d, 5, `%SFF8472-5-THRESHOLD_VIOLATION: ${pid}: Rx power back to normal`);
  logEvent(`${nameOf(d)} : module de ${pid} remplacé.`, 'good');
  touch(); return null;
}

/* ---------- Configuration des ports ---------- */
function actPortCfg(d, pid, patch) {
  const c = cfg(d, pid);
  if (patch.admin === false || patch.admin === true) c.err = null;
  Object.assign(c, patch);
  const L = [`interface ${pid}`];
  if (kindOf(d) === 'fw') {
    if ('mode' in patch || 'vlan' in patch || 'allowed' in patch) {
      if (c.mode === 'access') L.push(` # ${pid} sans étiquette : interface du VLAN ${c.vlan}`);
      else c.allowed.forEach(v => L.push(` ip link add link ${pid} name ${pid}.${v} type vlan id ${v}`));
    }
    if ('admin' in patch) L.push(patch.admin ? ` ip link set ${pid} up` : ` ip link set ${pid} down`);
  } else {
    if ('admin' in patch) L.push(patch.admin ? ' no shutdown' : ' shutdown');
    if ('mode' in patch || 'vlan' in patch || 'allowed' in patch || 'native' in patch) {
      if (c.mode === 'access') L.push(' switchport mode access', ` switchport access vlan ${c.vlan}`);
      else L.push(' switchport mode trunk', ` switchport trunk allowed vlan ${c.allowed.join(',') || 'none'}`, ` switchport trunk native vlan ${c.native}`, ' switchport nonegotiate');
    }
    if ('speed' in patch || 'duplex' in patch) L.push(` speed ${c.speed}`, ` duplex ${c.duplex}`);
    if ('bpdu' in patch) L.push(...(patch.bpdu ? [' spanning-tree portfast', ' spanning-tree bpduguard enable'] : [' no spanning-tree bpduguard enable']));
    if ('psec' in patch) L.push(...(patch.psec ? [' switchport port-security', ' switchport port-security maximum 2', ' switchport port-security violation restrict'] : [' no switchport port-security']));
    if ('desc' in patch) L.push(` description ${patch.desc || '-'}`);
  }
  cli(d, L);
  if (typeof learnHook === 'function') learnHook('portcfg', d, pid);
  touch();
  return null;
}

/* ---------- ACL du routeur ---------- */
const aclCli = (d, name, extra) => cli(d, [/^\d+$/.test(name) ? `! ACL numérotée ${name}` : `ip access-list extended ${name}`, ...extra]);
function actAclAdd(d, name, e, seq) {
  const A = aclOf(d), L = A.lists[name] || (A.lists[name] = []);
  if (L.length >= 30) return "Cette ACL a déjà 30 lignes : simplifie-la.";
  const s = seq || (L.length ? Math.max(...L.map(x => x.seq)) + 10 : 10);
  if (L.some(x => x.seq === s)) return `Le numéro ${s} est déjà pris dans l'ACL ${name}.`;
  const ent = Object.assign({}, e, { seq: s });
  L.push(ent); L.sort((x, y) => x.seq - y.seq);
  if (/^\d+$/.test(name)) cli(d, [`access-list ${name} ${+name < 100 ? ent.act + ' ' + ent.src : aclLine(ent)}`]);
  else aclCli(d, name, [` ${s} ${aclLine(ent)}`]);
  if (typeof learnHook === 'function') learnHook('acl', d);
  touch(); return ent;
}
function actAclDel(d, name, seq) {
  const L = aclOf(d).lists[name]; if (!L) return "ACL introuvable.";
  const i = L.findIndex(x => x.seq === seq); if (i < 0) return `Pas de ligne ${seq} dans l'ACL ${name}.`;
  L.splice(i, 1);
  aclCli(d, name, [` no ${seq}`]);
  touch(); return null;
}
// Monte ou descend une ligne : on échange les numéros de séquence, comme on le ferait avec « no » puis une ligne numérotée
function actAclMove(d, name, seq, dir) {
  const L = aclOf(d).lists[name]; if (!L) return "ACL introuvable.";
  const i = L.findIndex(x => x.seq === seq), j = i + dir;
  if (i < 0 || j < 0 || j >= L.length) return null;
  const a = L[i], b = L[j], t = a.seq; a.seq = b.seq; b.seq = t;
  L.sort((x, y) => x.seq - y.seq);
  aclCli(d, name, [` no ${a.seq}`, ` no ${b.seq}`, ` ${a.seq} ${aclLine(a)}`, ` ${b.seq} ${aclLine(b)}`]);
  touch(); return null;
}
function actAclDrop(d, name) {
  const A = aclOf(d); if (!A.lists[name]) return "ACL introuvable.";
  delete A.lists[name];
  for (const p in A.in) if (A.in[p] === name) delete A.in[p];
  if (d.vty && d.vty.acl === name) d.vty.acl = null;
  cli(d, [/^\d+$/.test(name) ? `no access-list ${name}` : `no ip access-list extended ${name}`]);
  touch(); return null;
}
function actAclApply(d, pid, name) {
  const A = aclOf(d);
  if (name && !A.lists[name]) A.lists[name] = [];
  const old = A.in[pid];
  if (name) { A.in[pid] = name; (A.since || (A.since = {}))[pid] = S.t; } else delete A.in[pid];
  cli(d, [`interface ${pid}`, name ? ` ip access-group ${name} in` : ` no ip access-group ${old || ''} in`]);
  touch(); return null;
}

function actVty(d, patch) {
  const v = vtyOf(d), L = ['line vty 0 4'];
  if ('acl' in patch && patch.acl && !(aclOf(d).lists[patch.acl])) return `L'ACL ${patch.acl} n'existe pas.`;
  if ('transport' in patch) L.push(` transport input ${patch.transport === 'all' ? 'telnet ssh' : patch.transport}`);
  if ('acl' in patch) L.push(patch.acl ? ` access-class ${patch.acl} in` : ` no access-class ${v.acl || ''} in`);
  Object.assign(v, patch);
  cli(d, L);
  touch(); return null;
}

/* ---------- Disques, RAID, mémoire ---------- */
function actAddDisk(d, bay, type) {
  if (d.disks[bay]) return "La baie est occupée.";
  if (!unlocked(DISKS[type].unlock)) return "Pas encore disponible.";
  const e = pay(DISKS[type].price, 'le disque'); if (e) return e;
  const hasData = S.vms.some(v => v.sto === d.id);
  d.disks[bay] = { type, st: hasData && d.raid !== 'none' && d.raid !== '0' ? 'rebuild' : 'ok', rb: 0 };
  cli(d, hasData ? [`mdadm /dev/md0 --add ${diskName(bay)}`, `mdadm --grow /dev/md0 --raid-devices=${arrayInfo(d).n}`] : [`# ${DISKS[type].name} inséré en baie ${bay}`]);
  logEvent(`${nameOf(d)} : ${DISKS[type].name} inséré en baie ${bay}.`);
  touch(); return null;
}
function actReplaceDisk(d, bay) {
  const x = d.disks[bay]; if (!x) return null;
  const e = pay(DISKS[x.type].price, 'un disque neuf'); if (e) return e;
  const lost = d.lost;
  d.disks[bay] = { type: x.type, st: lost ? 'ok' : 'rebuild', rb: 0 };
  if (lost) d.disks.forEach(k => { if (k && k.st === 'failed') { k.st = 'ok'; } });
  cli(d, [`mdadm /dev/md0 --remove ${diskName(bay)}`, `# échange à chaud du disque en baie ${bay}`, `mdadm /dev/md0 --add ${diskName(bay)}`, 'cat /proc/mdstat']);
  logEvent(`${nameOf(d)} : disque de la baie ${bay} remplacé${lost ? ', grappe recréée vide' : ', reconstruction lancée'}.`, 'good');
  touch(); return null;
}
function actRemoveDisk(d, bay) {
  const x = d.disks[bay]; if (!x) return null;
  if (x.st === 'ok' && S.vms.some(v => v.sto === d.id)) return "Ce disque contient des données en service : retire seulement un disque en panne.";
  d.disks[bay] = null;
  touch(); return null;
}
function actSetRaid(d, level) {
  if (S.vms.some(v => v.sto === d.id)) return "Changer de RAID efface la grappe : supprime ou déplace d'abord les VM stockées ici.";
  const n = d.disks.filter(Boolean).length, R = RAID[level];
  if (n < R.min) return `${R.name} demande au moins ${R.min} disques (il y en a ${n}).`;
  if (R.even && n % 2) return `${R.name} demande un nombre pair de disques.`;
  d.raid = level;
  d.disks.forEach(x => { if (x) { x.st = 'ok'; x.rb = 0; } });
  d.lost = false;
  const devs = d.disks.map((x, i) => x ? diskName(i) : null).filter(Boolean).join(' ');
  cli(d, level === 'none' ? ['# disques utilisés séparément'] : [`mdadm --create /dev/md0 --level=${level} --raid-devices=${n} ${devs}`, 'mkfs.ext4 /dev/md0', "mdadm --detail --scan | tee /etc/mdadm/mdadm.conf"]);
  logEvent(`${nameOf(d)} : grappe configurée en ${R.name}.`);
  touch(); return null;
}
function actRam(d) {
  const c = CAT[d.type];
  if (d.ram >= c.ramMax) return "Mémoire maximale atteinte.";
  const add = d.ram, cost = Math.round(add / 64 * 420);
  const e = pay(cost, 'les barrettes'); if (e) return e;
  d.ram += add;
  logEvent(`${nameOf(d)} : mémoire portée à ${d.ram} Go.`);
  touch(); return null;
}

/* ---------- Machines virtuelles ---------- */
function actDeploy(k, svc, hostId, vlan, ip, stoId) {
  const s = SVC[svc], host = dev(hostId), sto = dev(stoId);
  if (!host || kindOf(host) !== 'server') return "Choisis un serveur hôte.";
  const used = hostUsed(host);
  if (used.ram + s.ram > host.ram) return `Mémoire insuffisante sur ${host.host} : ${host.ram - used.ram} Go libres, ${s.ram} Go demandés. La RAM ne se suralloue pas sans risque.`;
  if (used.vcpu + s.vcpu > CAT[host.type].cores * 4) return `Trop de vCPU sur ${host.host} (surallocation au-delà de 4 pour 1).`;
  if (!sto) return "Choisis un stockage.";
  const A = arrayInfo(sto);
  if (!A.valid) return `La grappe de ${sto.host} n'est pas configurée.`;
  if (A.state === 'fail') return `La grappe de ${sto.host} est hors service.`;
  if (storeUsed(sto) + s.disk / 1000 > A.usable) return `Pas assez d'espace sur ${sto.host} : ${(A.usable - storeUsed(sto)).toFixed(2)} To libres, ${(s.disk / 1000).toFixed(2)} To demandés.`;
  const ipErr = ipCheck(ip, vlan, null);
  if (ipErr) return ipErr;
  S.seq.s[svc] = (S.seq.s[svc] || 0) + 1;
  const n = ++S.seq.v;
  const vm = {
    id: 'v' + n, vmid: 100 + n, name: `${svc}-${String(S.seq.s[svc]).padStart(2, '0')}`, svc, k, host: hostId, vlan, ip,
    vcpu: s.vcpu, ram: s.ram, disk: s.disk, sto: stoId, st: 'running', cert: S.t + 3 * 1440, acme: false, f2b: false,
    fill: 0.3 + Math.random() * 0.2, leak: 0, lastBak: null, isolated: false,
  };
  S.vms.push(vm);
  const storage = sto.id === host.id ? 'local-lvm' : `nfs-${sto.host}`;
  cli(host, [
    `qm create ${vm.vmid} --name ${vm.name} --cores ${vm.vcpu} --memory ${vm.ram * 1024} --net0 virtio,bridge=vmbr0,tag=${vlan} --scsi0 ${storage}:${vm.disk}`,
    `qm start ${vm.vmid}`,
    `# dans la VM : ip addr add ${ip}/24 dev eth0${VLANS[vlan].gw ? ` && ip route add default via ${VLANS[vlan].gw}` : ''}`,
    `# dans la VM : systemctl enable --now ${s.unit}`]);
  logEvent(`VM ${vm.name} (${s.soft}) déployée sur ${host.host}, VLAN ${vlan}, ${ip}.`);
  if (typeof learnHook === 'function') learnHook('deploy', vm);
  touch();
  return vm;
}
function actVm(id, op) {
  const v = S.vms.find(x => x.id === id); if (!v) return null;
  const host = dev(v.host);
  switch (op) {
    case 'start': case 'restart':
      if (v.st === 'lost' || v.st === 'encrypted') return "Restaure d'abord les données.";
      v.st = 'running'; v.crash = null; v.leak = 0;
      cli(host, [`qm ${op === 'start' ? 'start' : 'reboot'} ${v.vmid}`]); break;
    case 'stop': v.st = 'stopped'; cli(host, [`qm shutdown ${v.vmid}`]); break;
    case 'delete':
      S.vms = S.vms.filter(x => x.id !== id);
      cli(host, [`qm stop ${v.vmid}`, `qm destroy ${v.vmid}`]);
      logEvent(`VM ${v.name} supprimée.`); break;
    case 'restore':
      if (!D.backup) return "Aucune sauvegarde disponible : le service de sauvegarde n'est pas en place.";
      if (!v.lastBak) return "Cette VM n'a encore jamais été sauvegardée.";
      v.st = 'restoring'; v.rs = 40; v.encrypted = false; v.fill = Math.min(v.fill, 0.6);
      cli(host, [`# restauration du travail de sauvegarde du ${clock(v.lastBak).stamp}`, `bareos> restore client=${v.name}-fd select current all done`]);
      logEvent(`Restauration de ${v.name} lancée depuis la dernière sauvegarde.`); break;
    case 'reinstall': {
      const e = pay(400, 'la réinstallation'); if (e) return e;
      v.st = 'running'; v.encrypted = false; v.fill = 0.3; v.lastBak = null;
      logEvent(`${v.name} réinstallée à neuf : les données du client sont perdues. Avec une sauvegarde, une restauration les aurait gardées.`, 'bad'); break;
    }
    case 'renew': v.cert = S.t + 3 * 1440; cli(null, [`certbot renew --cert-name ${v.name}.client.fr`]); logEvent(`Certificat de ${v.name} renouvelé.`, 'good'); break;
    case 'acme': v.acme = !v.acme; cli(null, [v.acme ? 'systemctl enable --now certbot.timer' : 'systemctl disable --now certbot.timer']); break;
    case 'f2b': v.f2b = !v.f2b; cli(null, [v.f2b ? 'apt install fail2ban && systemctl enable --now fail2ban' : 'systemctl disable --now fail2ban']); break;
    case 'purge': v.fill = 0.45; v.filling = false; cli(null, ['journalctl --vacuum-size=200M', 'logrotate -f /etc/logrotate.conf']); logEvent(`${v.name} : journaux purgés, rotation activée.`, 'good'); break;
    case 'isolate': v.isolated = !v.isolated; cli(host, [`qm set ${v.vmid} --net0 virtio,bridge=vmbr0,tag=${v.vlan},link_down=${v.isolated ? 1 : 0}`]); break;
    case 'ram': {
      const used = hostUsed(host);
      if (used.ram + v.ram > host.ram) return `Pas assez de RAM libre sur ${host.host}.`;
      v.ram *= 2; cli(host, [`qm set ${v.vmid} --memory ${v.ram * 1024}`]); logEvent(`${v.name} : mémoire portée à ${v.ram} Go.`); break;
    }
  }
  touch(); return null;
}

/* ---------- Pare-feu ---------- */
function nftLine(r) {
  let s = 'nft add rule inet filtre forward';
  if (r.src !== 'any') s += ` iifname "${ZIF[r.src]}"`;
  if (r.dst !== 'any') s += ` oifname "${ZIF[r.dst]}"`;
  if (r.proto !== 'any') s += ` ${r.proto} dport ${r.port === 'any' ? '1-65535' : r.port}`;
  return s + ' accept';
}
function actAddRule(r) {
  if (r.src === r.dst && r.src !== 'any') return "Source et destination identiques : le trafic dans un même VLAN ne passe pas par le pare-feu.";
  if (S.rules.some(x => x.src === r.src && x.dst === r.dst && x.proto === r.proto && x.port === r.port)) return "Cette règle existe déjà.";
  S.rules.push(r);
  const fw = devsOfKind('fw')[0];
  cli(fw, [nftLine(r)]);
  if (typeof learnHook === 'function') learnHook('rule', r);
  touch(); return null;
}
function actDelRule(i) {
  const r = S.rules[i]; if (!r) return null;
  S.rules.splice(i, 1);
  cli(devsOfKind('fw')[0], [`nft delete rule inet filtre forward handle ${i + 4}   # ${r.src} → ${r.dst} ${r.proto} ${r.port}`]);
  touch(); return null;
}
function ruleRisk(r) {
  if (r.src === 'Internet' && (r.dst === 'SERVEURS' || r.dst === 'ADMIN' || r.dst === 'STOCKAGE')) return "Dangereux : Internet ne doit jamais atteindre directement cette zone.";
  if (r.src === 'Internet' && (r.port === 'any' || r.proto === 'any')) return "Trop large : n'ouvre que les ports nécessaires.";
  if (r.src === 'Internet' && r.port === 22) return "SSH exposé à Internet : réservé à un service SFTP, et avec fail2ban.";
  if (r.src === 'any' || r.dst === 'any') return "« any » ouvre plus que nécessaire.";
  return null;
}

/* ---------- Salle : baies, énergie, froid ---------- */
function actInstallRack(row, pos, kind) {
  kind = kind || 'rack';
  const it = ROOM_ITEMS[kind];
  if (rackAt(row, pos) >= 0) return "Emplacement déjà occupé.";
  if (!unlocked(it.unlock)) return `${it.name} : pas encore disponible.`;
  if (!S.power.rows[row]) return `La rangée ${row} n'est pas électrifiée : pose d'abord ses gaines à barres A et B (onglet Salle).`;
  const e = pay(it.cost, it.name); if (e) return e;
  const r = addRack(row, pos, kind);
  logEvent(`${it.name} installé${kind === 'rack' ? 'e' : ''} en ${row}${String(pos).padStart(2, '0')}${kind === 'rack' ? ', PDU A et B raccordés aux gaines de la rangée' : ''}.`, 'good');
  if (typeof learnHook === 'function') learnHook(kind === 'rack' ? 'rack' : 'inrow');
  touch();
  return r;
}
function actRowPower(row) {
  if (S.power.rows[row]) return "Rangée déjà électrifiée.";
  if (!unlocked(ROOM_ITEMS.rowpower.unlock)) return "Pas encore disponible : livre d'autres contrats.";
  const e = pay(ROOM_ITEMS.rowpower.cost, 'les gaines à barres'); if (e) return e;
  S.power.rows[row] = true;
  logEvent(`Rangée ${row} électrifiée : gaines à barres A et B posées depuis les onduleurs.`, 'good');
  touch(); return null;
}
function actPower(op, arg) {
  const it = ROOM_ITEMS[op];
  if (it && !unlocked(it.unlock)) return `${it.name} : pas encore disponible.`;
  if (op === 'ups') {
    if (S.power.ups.A.kw >= 100) return "Les onduleurs sont au maximum (100 kW par voie).";
    const e = pay(it.cost, it.name); if (e) return e;
    S.power.ups.A.kw += 20; S.power.ups.B.kw += 20;
    logEvent(`Onduleurs A et B portés à ${S.power.ups.A.kw} kW chacun.`, 'good');
  } else if (op === 'battery') {
    const e = pay(it.cost, it.name); if (e) return e;
    S.power.battMax += 15; S.power.batt += 15;
    logEvent(`Autonomie des onduleurs portée à ${S.power.battMax} minutes.`, 'good');
  } else if (op === 'gen') {
    if (S.power.gen) return "Le groupe électrogène est déjà installé.";
    const e = pay(it.cost, it.name); if (e) return e;
    S.power.gen = true;
    logEvent('Groupe électrogène installé dans la cour : il démarrera seul en cas de coupure EDF.', 'good');
  } else if (op === 'reset') {
    S.power.ups[arg].trip = false;
    logEvent(`Onduleur ${arg} réarmé.`);
  }
  touch(); return null;
}
function actCrac(slot) {
  const it = ROOM_ITEMS.crac;
  if (!unlocked(it.unlock)) return `${it.name} : pas encore disponible.`;
  if (S.cool.cracs.some(c => c.slot === slot)) return "Un climatiseur occupe déjà cet emplacement.";
  const e = pay(it.cost, it.name); if (e) return e;
  S.cool.cracs.push({ slot, ok: true });
  logEvent(`Climatiseur CRAC-${slot + 1} installé : ${S.cool.cracs.length * CRAC_KW} kW de froid dans la salle.`, 'good');
  if (typeof learnHook === 'function') learnHook('crac');
  touch(); return null;
}
function actContain(aisle) {
  const it = ROOM_ITEMS.containment;
  if (!unlocked(it.unlock)) return `${it.name} : pas encore disponible.`;
  if (S.cool.contain[aisle]) return "Cette allée est déjà confinée.";
  const e = pay(it.cost, it.name); if (e) return e;
  S.cool.contain[aisle] = true;
  logEvent(`Allée froide ${aisle} confinée : portes aux deux bouts et toit.`, 'good');
  touch(); return null;
}
function actOp2() {
  const it = ROOM_ITEMS.op2;
  if (!unlocked(it.unlock)) return `${it.name} : pas encore disponible.`;
  if (S.room.op2) return "Déjà souscrit.";
  const e = pay(it.cost, it.name); if (e) return e;
  S.room.op2 = true;
  logEvent("Second opérateur livré : sa fibre arrive sur le port OP2 de l'ODF, en salle MMR.", 'good');
  touch(); return null;
}
function actRepairCrac(slot) {
  const c = S.cool.cracs.find(x => x.slot === slot);
  if (!c || c.ok || S.timers['crac' + slot]) return null;
  const e = pay(800, "l'intervention du frigoriste"); if (e) return e;
  S.timers['crac' + slot] = S.t + 45;
  logEvent(`Frigoriste appelé pour CRAC-${slot + 1} : intervention dans 45 minutes.`);
  touch(); return null;
}
function actFw(op, arg) {
  const fw = devsOfKind('fw')[0];
  if (op === 'syn') { S.fwopt.syn = !S.fwopt.syn; cli(fw, [S.fwopt.syn ? 'nft add rule inet filtre input tcp flags syn limit rate over 200/second drop' : 'nft delete rule inet filtre input handle 12   # limite SYN']); }
  if (op === 'scrub') {
    if (S.fwopt.scrub) return null;
    const e = pay(600, "le filtrage chez l'opérateur"); if (e) return e;
    S.fwopt.scrub = true; logEvent("L'opérateur détourne le trafic vers son centre de nettoyage anti-DDoS.", 'good');
  }
  if (op === 'block') { if (!S.fwopt.block.includes(arg)) S.fwopt.block.push(arg); cli(fw, [`nft add element inet filtre blocklist { ${arg} }`]); }
  touch(); return null;
}
function actAccept(id) {
  const cs = S.contracts.find(c => c.id === id);
  if (cs && cs.state === 'offer') { cs.state = 'setup'; logEvent(`Contrat « ${contractDef(id).client} » signé : à mettre en service.`); touch(); }
}
