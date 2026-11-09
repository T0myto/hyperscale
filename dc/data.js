'use strict';
/* =========================================================
   Hyperscale — données : matériel, câbles, services, contrats
   ========================================================= */
const U_PX = 22, RACK_U = 42;
const ECO = { start: 10000, elec: 3, rent: 8, opCost: 20, resale: 0.6 };

/* ---------- Plan de la salle (en mètres) ---------- */
const ROOM = { w: 14.6, h: 16.4, yardW: 1.8 };
const ROWS = ['A', 'B', 'C', 'D', 'E', 'F'];
const NPOS = 10, RACK_W = 0.6, RACK_D = 1.2, ROW_X0 = 4.0;
const ROW_Y = { A: 1.6, B: 4.0, C: 6.4, D: 8.8, E: 11.2, F: 13.6 };
const ROW_FRONT = { A: 1, B: -1, C: 1, D: -1, E: 1, F: -1 }; // 1 : face avant vers le bas du plan
const AISLES = [
  { id: 'AB', y: 2.8, cold: true, rows: ['A', 'B'] }, { id: 'BC', y: 5.2, cold: false, rows: ['B', 'C'] },
  { id: 'CD', y: 7.6, cold: true, rows: ['C', 'D'] }, { id: 'DE', y: 10.0, cold: false, rows: ['D', 'E'] },
  { id: 'EF', y: 12.4, cold: true, rows: ['E', 'F'] }];
const coldAisleOf = row => (AISLES.find(a => a.cold && a.rows.includes(row)) || {}).id;
const CRAC_SLOTS = [{ x: 4.2, y: 0.12 }, { x: 6.55, y: 0.12 }, { x: 8.9, y: 0.12 }, { x: 4.2, y: 15.5 }, { x: 6.55, y: 15.5 }, { x: 8.9, y: 15.5 }];
const MMR_RACK = { x: 0.5, y: 7.0 };
const CRAC_KW = 15, INROW_KW = 8;
const ROOM_ITEMS = {
  rack:        { name: 'Baie 42U', cost: 900, desc: "Baie 19 pouces avec ses deux PDU (voies A et B), raccordée aux gaines à barres de la rangée." },
  inrow:       { name: 'Climatiseur en rangée', cost: 2800, unlock: 'inrow', desc: "Prend la place d'une baie. Souffle 8 kW de froid au plus près des baies voisines." },
  rowpower:    { name: 'Électrifier une rangée', cost: 1500, unlock: 'rowpower', desc: "Pose les gaines à barres A et B au-dessus de la rangée, depuis les onduleurs." },
  ups:         { name: 'Module onduleur +20 kW', cost: 4000, unlock: 'ups', desc: "Ajoute 20 kW à chaque onduleur (A et B)." },
  battery:     { name: 'Armoire de batteries +15 min', cost: 1500, unlock: 'battery', desc: "Allonge l'autonomie des onduleurs pendant une coupure secteur." },
  gen:         { name: 'Groupe électrogène', cost: 6000, unlock: 'gen', desc: "Démarre seul en cas de coupure EDF et reprend la salle avant la fin des batteries." },
  crac:        { name: 'Climatiseur de salle (CRAC) 15 kW', cost: 3500, unlock: 'crac', desc: "Une unité de plus le long d'un mur. En N+1, une panne ne fait plus chauffer la salle." },
  containment: { name: "Confinement d'une allée froide", cost: 2500, unlock: 'containment', desc: "Portes et toit sur l'allée : l'air froid ne se mélange plus à l'air chaud." },
  op2:         { name: 'Second opérateur', cost: 2500, unlock: 'op2', desc: "Une seconde fibre d'un autre opérateur arrive sur OP2. Avec BGP, la bascule est automatique." },
};

/* ---------- Plan d'adressage ---------- */
const VLANS = {
  1:  { id: 1,  name: 'default',  zone: null,       net: null,        gw: null,         color: '#8a96a0', use: "VLAN par défaut : à ne jamais utiliser en production" },
  10: { id: 10, name: 'DMZ',      zone: 'DMZ',      net: '172.16.10', gw: '172.16.10.1', color: '#f5a524', use: "Serveurs exposés à Internet" },
  20: { id: 20, name: 'SERVEURS', zone: 'SERVEURS', net: '10.20.0',   gw: '10.20.0.1',   color: '#3b9eff', use: "Serveurs internes, jamais exposés directement" },
  30: { id: 30, name: 'STOCKAGE', zone: 'STOCKAGE', net: '10.30.0',   gw: null,          color: '#2fbf9b', use: "Réseau de stockage isolé, non routé" },
  99: { id: 99, name: 'ADMIN',    zone: 'ADMIN',    net: '10.99.0',   gw: '10.99.0.1',   color: '#b07cff', use: "Administration, BMC et supervision" },
};
const VLAN_IDS = [1, 10, 20, 30, 99];
const ZONES = ['Internet', 'DMZ', 'SERVEURS', 'ADMIN', 'STOCKAGE'];
const ZONE_VLAN = { DMZ: 10, SERVEURS: 20, STOCKAGE: 30, ADMIN: 99 };

/* ---------- Matériel ---------- */
function portRange(prefix, from, to, t, speed, extra) {
  const a = [];
  for (let i = from; i <= to; i++) a.push(Object.assign({ id: prefix + i, t, speed }, extra || {}));
  return a;
}
const SRV_PORTS = [
  { id: 'idrac', label: 'BMC', t: 'rj45', speed: 1000, role: 'bmc' },
  { id: 'eno1', t: 'rj45', speed: 1000 },
  { id: 'eno2', t: 'rj45', speed: 1000 },
  { id: 'ens1f0', t: 'sfp', speed: 10000 },
  { id: 'ens1f1', t: 'sfp', speed: 10000 },
];
const CAT = {
  odf: {
    name: "Tiroir optique opérateur", short: 'ODF', kind: 'odf', u: 1, cost: 0, fixed: true, psu: 0, w: [0, 0],
    ports: [{ id: 'OP1', t: 'sfp', speed: 10000, op: 1 }, { id: 'OP2', t: 'sfp', speed: 10000, op: 2 }],
    desc: "Arrivée des fibres monomodes des opérateurs, dans la salle opérateurs (MMR). Ta baie s'y relie par un cross-connect en fibre OS2."
  },
  router: {
    name: 'Routeur de bordure', short: 'RTR', kind: 'router', u: 1, cost: 1800, psu: 2, w: [80, 160],
    ports: [
      { id: 'Te0/0/0', t: 'sfp', speed: 10000, role: 'wan' }, { id: 'Te0/0/1', t: 'sfp', speed: 10000, role: 'wan' },
      { id: 'Te0/1/0', t: 'sfp', speed: 10000, role: 'lan' }, { id: 'Te0/1/1', t: 'sfp', speed: 10000, role: 'lan' },
      { id: 'Gi0', t: 'rj45', speed: 1000, role: 'mgmt' }],
    desc: "Parle BGP avec les opérateurs et annonce tes adresses publiques."
  },
  fw: {
    name: 'Pare-feu', short: 'FW', kind: 'fw', u: 1, cost: 2400, psu: 2, w: [100, 240], tput: 10000,
    ports: [
      { id: 'port1', t: 'sfp', speed: 10000, role: 'wan' }, { id: 'port2', t: 'sfp', speed: 10000, role: 'lan' },
      { id: 'port3', t: 'sfp', speed: 10000, role: 'lan' }, { id: 'port4', t: 'rj45', speed: 1000, role: 'lan' },
      { id: 'mgmt', t: 'rj45', speed: 1000, role: 'mgmt' }],
    desc: "Pare-feu avec état. Il sert de passerelle à chaque VLAN routé et applique la matrice de flux."
  },
  sw24: {
    name: "Switch d'accès 24 ports", short: 'SW', kind: 'switch', u: 1, cost: 900, psu: 1, w: [30, 65],
    ports: [...portRange('Gi1/0/', 1, 24, 'rj45', 1000), ...portRange('Te1/1/', 1, 4, 'sfp', 10000)],
    desc: "24 ports cuivre 1 Gbit/s et 4 cages SFP+ 10 Gbit/s. Une seule alimentation."
  },
  leaf: {
    name: 'Switch leaf 10G', short: 'LEAF', kind: 'switch', u: 1, cost: 3800, psu: 2, w: [140, 300], unlock: 'leaf',
    ports: [...portRange('Te1/0/', 1, 24, 'sfp', 10000), ...portRange('Fo1/0/', 25, 26, 'qsfp', 40000), { id: 'mgmt0', t: 'rj45', speed: 1000, role: 'mgmt' }],
    desc: "24 cages SFP+ 10 Gbit/s et 2 QSFP+ 40 Gbit/s pour monter vers les spines. Double alimentation."
  },
  spine: {
    name: 'Switch spine 40G', short: 'SPINE', kind: 'switch', u: 1, cost: 7200, psu: 2, w: [240, 420], unlock: 'spine',
    ports: [...portRange('Fo1/0/', 1, 12, 'qsfp', 40000), { id: 'mgmt0', t: 'rj45', speed: 1000, role: 'mgmt' }],
    desc: "12 ports QSFP+ 40 Gbit/s. Chaque leaf se relie à chaque spine."
  },
  srv1: {
    name: 'Serveur 1U', short: 'SRV', kind: 'server', u: 1, cost: 2600, psu: 2, w: [90, 360], cores: 32, ram: 128, ramMax: 512, bays: 4,
    ports: SRV_PORTS, desc: "Hyperviseur 32 cœurs, 128 Go de RAM, 4 baies disques. Livré avec 2 SSD en RAID 1."
  },
  srv2: {
    name: 'Serveur 2U', short: 'SRV', kind: 'server', u: 2, cost: 5200, psu: 2, w: [140, 720], cores: 64, ram: 256, ramMax: 1024, bays: 12, unlock: 'srv2',
    ports: SRV_PORTS, desc: "Hyperviseur 64 cœurs, 256 Go de RAM, 12 baies disques. Livré avec 2 SSD en RAID 1."
  },
  nas: {
    name: 'Baie de stockage 2U', short: 'NAS', kind: 'nas', u: 2, cost: 4500, psu: 2, w: [110, 280], bays: 12, unlock: 'nas',
    ports: [{ id: 'mgmt', t: 'rj45', speed: 1000, role: 'bmc' }, { id: 'eth0', t: 'sfp', speed: 10000 }, { id: 'eth1', t: 'sfp', speed: 10000 }],
    desc: "12 baies, partage NFS sur le VLAN de stockage. Livrée vide : ajoute des disques et choisis le RAID."
  },
  cm: { name: 'Guide-câbles 1U', short: 'CM', kind: 'cm', u: 1, cost: 40, psu: 0, w: [0, 0], ports: [], desc: "Range les cordons sur le côté. Un câblage propre se dépanne plus vite." },
  rogue: { name: 'Petit switch inconnu', short: '???', kind: 'rogue', u: 0, cost: 0, psu: 1, w: [8, 12], hidden: true,
    ports: [{ id: 'p1', t: 'rj45', speed: 1000 }], desc: "Un équipement que personne n'a déclaré. Il n'a rien à faire ici." },
  blank: { name: 'Obturateur 1U', short: 'BLK', kind: 'blank', u: 1, cost: 10, psu: 0, w: [0, 0], ports: [], desc: "Ferme une unité vide pour empêcher l'air chaud de revenir en face avant." },
};
const SHOP_ORDER = ['sw24', 'leaf', 'spine', 'srv1', 'srv2', 'nas', 'router', 'fw', 'cm', 'blank'];

/* ---------- Câbles et modules ---------- */
const CABLES = {
  cat6:  { name: 'Cuivre Cat 6', ends: 'rj45', color: '#3b82f6', perM: 0.9, base: 4, max: { 1000: 100, 10000: 55 }, std: "1000BASE-T" },
  cat6a: { name: 'Cuivre Cat 6A', ends: 'rj45', color: '#a06bff', perM: 1.4, base: 6, max: { 1000: 100, 10000: 100 }, std: "10GBASE-T", unlock: 'cat6a' },
  dac:   { name: 'DAC SFP+ (twinax)', ends: 'sfp', color: '#41484e', perM: 9, base: 30, max: { 10000: 5 }, noModule: true, std: "10GBASE-CR" },
  dacq:  { name: 'DAC QSFP+ 40G', ends: 'qsfp', color: '#41484e', perM: 22, base: 80, max: { 40000: 5 }, noModule: true, std: "40GBASE-CR4", unlock: 'dacq' },
  om4:   { name: 'Fibre multimode OM4', ends: 'fiber', color: '#21c7c7', perM: 2.2, base: 12, max: { 10000: 400, 40000: 150 }, module: 'SR', std: "10GBASE-SR", unlock: 'om4' },
  os2:   { name: 'Fibre monomode OS2', ends: 'fiber', color: '#f2c230', perM: 2.6, base: 14, max: { 10000: 10000, 40000: 10000 }, module: 'LR', std: "10GBASE-LR" },
};
const STD_LEN = [0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30];
const MODULES = {
  SR: { name: 'SR', long: 'courte portée, multimode', price: { sfp: 60, qsfp: 240 }, tab: '#1b1f22', std: { sfp: 'SFP-10GBase-SR', qsfp: 'QSFP-40G-SR4' } },
  LR: { name: 'LR', long: 'longue portée, monomode', price: { sfp: 180, qsfp: 700 }, tab: '#2f6fe0', std: { sfp: 'SFP-10GBase-LR', qsfp: 'QSFP-40G-LR4' } },
};
const DISKS = {
  ssd: { name: 'SSD 1,92 To', size: 1.92, price: 300 },
  hdd: { name: 'HDD 8 To', size: 8, price: 220, unlock: 'hdd' },
};
const RAID = {
  none: { name: 'Aucun', min: 1, tol: () => 0, usable: (n, s) => n * s, perf: 'disque seul' },
  '0':  { name: 'RAID 0', min: 2, tol: () => 0, usable: (n, s) => n * s, perf: 'très rapide, aucune tolérance' },
  '1':  { name: 'RAID 1', min: 2, tol: n => n - 1, usable: (n, s) => s, perf: 'miroir, simple et sûr' },
  '5':  { name: 'RAID 5', min: 3, tol: () => 1, usable: (n, s) => (n - 1) * s, perf: 'parité répartie, compromis' },
  '6':  { name: 'RAID 6', min: 4, tol: () => 2, usable: (n, s) => (n - 2) * s, perf: 'double parité, résiste à 2 pannes' },
  '10': { name: 'RAID 10', min: 4, even: true, tol: () => 1, usable: (n, s) => (n / 2) * s, perf: 'miroirs + striping, rapide et sûr' },
};


/* ---------- Services (machines virtuelles) ---------- */
const SVC = {
  web:  { name: 'Site web HTTPS', soft: 'nginx', unit: 'nginx', vcpu: 2, ram: 4, disk: 40, ports: [['tcp', 443]], zone: 10, pub: true, bw: 40, cert: true },
  db:   { name: 'Base de données', soft: 'PostgreSQL', unit: 'postgresql', vcpu: 4, ram: 16, disk: 200, ports: [['tcp', 5432]], zone: 20, bw: 20 },
  dns:  { name: 'DNS faisant autorité', soft: 'bind9', unit: 'named', vcpu: 1, ram: 2, disk: 10, ports: [['udp', 53], ['tcp', 53]], zone: 10, pub: true, bw: 5 },
  mail: { name: 'Messagerie', soft: 'Postfix et Dovecot', unit: 'postfix', vcpu: 2, ram: 6, disk: 150, ports: [['tcp', 25], ['tcp', 587], ['tcp', 993]], zone: 10, pub: true, bw: 15 },
  lb:   { name: 'Répartiteur de charge', soft: 'HAProxy', unit: 'haproxy', vcpu: 2, ram: 2, disk: 10, ports: [['tcp', 443]], zone: 10, pub: true, bw: 60, cert: true },
  vpn:  { name: 'Passerelle VPN', soft: 'WireGuard', unit: 'wg-quick@wg0', vcpu: 1, ram: 1, disk: 5, ports: [['udp', 51820]], zone: 10, pub: true, bw: 30 },
  sftp: { name: 'Dépôt SFTP', soft: 'OpenSSH (SFTP)', unit: 'ssh', vcpu: 4, ram: 8, disk: 3000, ports: [['tcp', 22]], zone: 10, pub: true, bw: 900 },
  mon:  { name: 'Supervision', soft: 'Zabbix', unit: 'zabbix-server', vcpu: 2, ram: 8, disk: 100, ports: [['udp', 162], ['udp', 514]], zone: 99, bw: 5 },
  bak:  { name: 'Sauvegarde', soft: 'Bareos', unit: 'bareos-dir', vcpu: 2, ram: 4, disk: 50, ports: [['tcp', 9103]], zone: 20, bw: 60, nas: true },
  ad:   { name: 'Annuaire Active Directory', soft: 'Windows Server 2022 (AD DS)', unit: 'ntds', vcpu: 2, ram: 8, disk: 80, ports: [['tcp', 389], ['tcp', 88], ['tcp', 636]], zone: 20, bw: 10 },
  k8s:  { name: 'Nœud Kubernetes', soft: 'kubelet et containerd', unit: 'kubelet', vcpu: 8, ram: 32, disk: 120, ports: [['tcp', 30443], ['tcp', 6443]], zone: 20, bw: 120 },
};

/* ---------- Contrats ----------
   Chaque contrat introduit une ou deux notions (fiches de cours), des plus simples aux plus avancées.
   Une mission (goals) se valide dès que ses objectifs sont atteints ; un contrat client (svcs) se livre par une recette. */
const CHAPTERS = [
  { n: 1, name: 'Les bases', desc: "Le plus facile, vu en cours : la salle et ses allées, la baie, l'alimentation, le câble, le switch et les VLAN, l'adresse IP, la virtualisation, le RAID, puis l'énergie secourue et le froid." },
  { n: 2, name: 'Ouvrir sur Internet', desc: "La fibre vers les opérateurs, les ports TCP et UDP, le pare-feu et la DMZ, la méthode de dépannage et les certificats TLS." },
  { n: 3, name: 'Exploiter et protéger', desc: "Niveau intermédiaire : les sauvegardes, la supervision, la sécurité du niveau 2 et les attaques." },
  { n: 4, name: 'Notions avancées', desc: "Le plus difficile : les ACL du routeur, l'annuaire Active Directory, la haute disponibilité, les conteneurs et le double opérateur." },
];
const CONTRACTS = [
  { id: 'c1', chap: 1, client: 'Ta première baie', mission: true, what: "Pose une baie, installe un switch et un serveur, puis alimente-les proprement.", notions: ['salle', 'baie', 'elec'],
    goals: [
      { k: 'rack', t: "Dans la salle, clique un emplacement libre de la rangée A et installe une baie 42U", fiche: 'salle', ok: () => CHK.rack() },
      { k: 'shop', t: "Ouvre la baie et installe un switch d'accès 24 ports et un serveur 1U (bouton Catalogue)", fiche: 'baie', ok: () => devsOfKind('switch').length > 0 && devsOfKind('server').length > 0 },
      { k: 'plugsw', t: "Passe en face arrière (touche F) et branche l'alimentation du switch sur un PDU", fiche: 'elec', ok: () => devsOfKind('switch').some(d => d.psus.every(p => p.out)) },
      { k: 'plugsrv', t: "Branche les deux alimentations du serveur sur deux voies : PSU1 sur le PDU A, PSU2 sur le PDU B", fiche: 'elec', ok: () => devsOfKind('server').some(CHK.ab) },
    ],
    rev: 0, bonus: 1000, unlock: [] },
  { id: 'c2', chap: 1, client: 'Le réseau local', mission: true, what: "Relie le serveur au switch et range son port dans le bon VLAN.", notions: ['cuivre', 'switch'],
    goals: [
      { k: 'cablesrv', t: "Relie la carte eno1 du serveur à un port Gi du switch avec un câble cuivre Cat 6", fiche: 'cuivre', ok: () => CHK.srvLinks().length > 0 },
      { k: 'cfgsrv', t: "Ouvre le switch (double-clic), onglet Config : passe ce port en mode access, VLAN 20 (SERVEURS)", fiche: 'switch', ok: () => CHK.srvLinks().some(x => cfg(dev(x.o.d), x.o.p).mode === 'access' && carries(x.o, 20)) },
      { k: 'cfgsrv', t: "Donne une description à ce port, par exemple le nom du serveur", fiche: 'switch', ok: () => CHK.srvLinks().some(x => !!cfg(dev(x.o.d), x.o.p).desc) },
      { k: 'clisw', t: "Vérifie dans l'onglet CLI du switch : tape show vlan brief", fiche: 'switch', ok: () => CHK.cmd('show vlan brief') },
    ],
    rev: 0, bonus: 800, unlock: [] },
  { id: 'c3', chap: 1, client: 'Cabinet Marchand', what: "Une base de données pour le logiciel de comptabilité, utilisée seulement par les postes du cabinet, dans le VLAN 20.", notions: ['ip', 'virtu', 'raid'], lanOnly: true,
    svcs: [{ s: 'db', n: 1, raid: 1 }], flows: [],
    rev: 200, bonus: 1500, unlock: ['ram', 'hdd'] },
  { id: 'c4', chap: 1, client: 'Énergie secourue et froid', mission: true, what: "Ta baie tourne. Regarde d'où vient son courant, puis empêche l'air chaud de revenir vers l'avant.", notions: ['onduleur', 'froid'],
    goals: [
      { k: 'seeups', t: "Dans la salle, clique l'onduleur A du local électrique : c'est lui qui alimente le PDU A de ta baie", fiche: 'onduleur', ok: () => CHK.flag('sawUps') },
      { k: 'heat', t: "Passe la salle en vue « Chaleur » (bouton en haut à gauche) pour voir la température d'entrée de ta baie", fiche: 'froid', ok: () => CHK.flag('sawHeat') },
      { k: 'blanks', t: "Ferme les unités vides de ta baie avec des obturateurs : clique une unité vide en face avant, puis « Obturer toutes les unités vides »", fiche: 'froid', ok: () => CHK.blanked() },
    ],
    rev: 0, bonus: 1200, unlock: [] },
  { id: 'c5', chap: 2, client: 'Raccorder la salle à Internet', mission: true, internal: true, what: "Installe le routeur et le pare-feu, puis relie-les aux opérateurs par la fibre.", notions: ['fibre'],
    goals: [
      { k: 'shopnet', t: "Installe un routeur de bordure et un pare-feu dans ta baie (Catalogue)", fiche: 'pf', ok: () => devsOfKind('router').length > 0 && devsOfKind('fw').length > 0 },
      { k: 'plugnet', t: "Alimente le routeur et le pare-feu sur les deux voies : PSU1 sur A, PSU2 sur B", fiche: 'elec', ok: () => ['router', 'fw'].every(k => devsOfKind(k).some(CHK.ab)) },
      { k: 'oplink', t: "Relie le routeur (Te0/0/0) à l'ODF de la salle MMR (OP1) : fibre monomode OS2 avec modules LR", fiche: 'fibre', ok: () => CHK.opLink() },
      { k: 'wanlink', t: "Relie le routeur (Te0/1/0) au port WAN du pare-feu (port1) avec un câble DAC", fiche: 'fibre', ok: () => CHK.wanLink() },
      { k: 'clirtr', t: "Vérifie dans l'onglet CLI du routeur que l'opérateur répond : tape show bgp summary", fiche: 'fibre', ok: () => CHK.cmd('show bgp summary') && !!(D.inet && D.inet.ok) },
    ],
    rev: 0, bonus: 2000, unlock: [] },
  { id: 'c6', chap: 2, client: 'Le Fournil', what: "Le site vitrine de la boulangerie, ouvert sur Internet en HTTPS. Il va dans la DMZ (VLAN 10).", notions: ['ports', 'pf'],
    svcs: [{ s: 'web', n: 1 }], flows: [['Internet', 'DMZ', 'tcp', 443]],
    rev: 260, bonus: 1500, unlock: ['cat6a', 'om4'] },
  { id: 'c7', chap: 2, client: 'Mairie de Saint-Aubin', what: "Le DNS de la commune et la messagerie des agents. Chaque service écoute sur ses propres ports.", notions: ['dep', 'ports'],
    svcs: [{ s: 'dns', n: 1 }, { s: 'mail', n: 1 }],
    flows: [['Internet', 'DMZ', 'udp', 53], ['Internet', 'DMZ', 'tcp', 53], ['Internet', 'DMZ', 'tcp', 25], ['Internet', 'DMZ', 'tcp', 587], ['Internet', 'DMZ', 'tcp', 993]],
    rev: 520, bonus: 1500, unlock: ['leaf', 'rowpower'] },
  { id: 'c8', chap: 2, client: 'Immo Laurent', what: "Un site d'annonces en DMZ qui interroge sa base de données dans le VLAN 20 : le pare-feu route entre les deux.", notions: ['tls', 'pf', 'ip'],
    svcs: [{ s: 'web', n: 1 }, { s: 'db', n: 1, raid: 1 }], flows: [['Internet', 'DMZ', 'tcp', 443], ['DMZ', 'SERVEURS', 'tcp', 5432]], deps: [['web', 'db']],
    rev: 420, bonus: 1800, unlock: ['srv2', 'nas'] },
  { id: 'c9', chap: 3, client: 'Sauvegardes 3-2-1', internal: true, what: "Une VM Bareos écrit les sauvegardes sur une baie de stockage, jamais sur le serveur qu'elle protège.", notions: ['bak', 'raid'],
    svcs: [{ s: 'bak', n: 1 }], flows: [['SERVEURS', 'DMZ', 'tcp', 9102]],
    rev: 0, bonus: 3000, unlock: ['gen', 'op2', 'battery'], effect: 'backup' },
  { id: 'c10', chap: 3, client: 'Superviser la salle', internal: true, what: "Une VM Zabbix dans le VLAN 99 (ADMIN) interroge les équipements en SNMP et reçoit leurs journaux.", notions: ['sup'],
    svcs: [{ s: 'mon', n: 1 }], flows: [['ADMIN', 'DMZ', 'udp', 161], ['ADMIN', 'SERVEURS', 'udp', 161]],
    rev: 0, bonus: 2500, unlock: ['containment', 'crac'], effect: 'monitoring' },
  { id: 'c11', chap: 3, client: 'Sécuriser les ports du switch', mission: true, internal: true, what: "Un prestataire branche parfois n'importe quoi dans la baie. Ferme les portes du niveau 2 avant que ça arrive.", notions: ['l2sec'],
    goals: [
      { k: 'bpdu', t: "Active PortFast et BPDU Guard sur chaque port de switch relié à un serveur", fiche: 'l2sec', ok: () => CHK.srvLinks().length > 0 && CHK.srvLinks().every(x => cfg(dev(x.o.d), x.o.p).bpdu) },
      { k: 'unused', t: "Coupe tous les ports inutilisés : en CLI, interface range Gi1/0/3-24 puis shutdown", fiche: 'l2sec', ok: () => CHK.unusedOff() },
      { k: 'native', t: "Sur chaque trunk du switch, passe le VLAN natif sur 999, un VLAN vide : c'est la parade au VLAN hopping", fiche: 'l2sec', ok: () => CHK.trunksNative() },
      { k: 'clistatus', t: "Vérifie dans la CLI du switch : show interfaces status (les ports coupés sont « disabled »)", fiche: 'l2sec', ok: () => CHK.cmd('show interfaces status') },
    ],
    rev: 0, bonus: 2500, unlock: [] },
  { id: 'c12', chap: 3, client: 'Studio Pixel', what: "Un dépôt de rushs vidéo en SFTP, 3 To, exposé sur Internet : attention aux attaques par force brute.", notions: ['attaques', 'raid'],
    svcs: [{ s: 'sftp', n: 1 }], flows: [['Internet', 'DMZ', 'tcp', 22]],
    rev: 2000, bonus: 4000, unlock: [] },
  { id: 'c13', chap: 4, client: "Protéger l'accès au routeur", mission: true, internal: true, what: "Des robots essaient sans arrêt d'ouvrir une session SSH sur le routeur. Seuls les administrateurs du VLAN 99 doivent pouvoir s'y connecter : c'est le travail d'une ACL standard.", notions: ['acl', 'attaques'],
    goals: [
      { k: 'stdacl', t: "Crée une ACL standard qui n'autorise que le réseau d'administration : access-list 10 permit 10.99.0.0 0.0.0.255", fiche: 'acl', ok: () => !!CHK.stdAdmin() },
      { k: 'vtyssh', t: "Sur les lignes d'accès à distance, n'accepte que SSH : line vty 0 4, puis transport input ssh (Telnet circule en clair)", fiche: 'attaques', ok: () => CHK.vty().transport === 'ssh' },
      { k: 'vtyacl', t: "Applique l'ACL aux lignes VTY : access-class 10 in", fiche: 'acl', ok: () => { const v = CHK.vty(); return !!v.acl && v.acl === CHK.stdAdmin(); } },
      { k: 'clissh', t: "Vérifie dans la CLI du routeur : show ip ssh", fiche: 'attaques', ok: () => CHK.cmd('show ip ssh') },
    ],
    rev: 0, bonus: 2500, unlock: [] },
  { id: 'c14', chap: 4, client: 'Filtrer en bordure : ACL', mission: true, internal: true, what: "Le routeur laisse tout entrer jusqu'au pare-feu. Pose une ACL étendue sur le lien opérateur : elle jette le trafic absurde avant qu'il n'entre.", notions: ['acl'],
    goals: [
      { k: 'aclmk', t: "Crée une ACL étendue sur le routeur : onglet Config, ou en CLI ip access-list extended EDGE-IN", fiche: 'acl', ok: () => { const t = CHK.aclTarget(); return !!(t && t.list.length); } },
      { k: 'aclspoof', t: "En tête de liste, refuse les sources privées (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) : elles ne viennent jamais d'Internet", fiche: 'acl', ok: () => CHK.aclPk('spoof', 'deny') },
      { k: 'aclbgp', t: "Autorise la session BGP de l'opérateur (TCP 179 depuis 198.51.100.1), sinon Internet tombe", fiche: 'acl', ok: () => CHK.aclPk('bgp', 'permit') },
      { k: 'aclsvc', t: "Autorise les services publics de tes clients vers 203.0.113.10 : une ligne par protocole suffit, car eq accepte plusieurs ports (eq 443 22 25)", fiche: 'acl', ok: () => CHK.aclPk('svc', 'permit') },
      { k: 'aclssh', t: "Ne laisse pas passer SSH vers le routeur lui-même (198.51.100.2) : vise host 203.0.113.10 plutôt que any pour SFTP", fiche: 'acl', ok: () => CHK.aclPk('ssh', 'deny') },
      { k: 'aclapply', t: "Applique l'ACL en entrée sur le lien opérateur : interface Te0/0/0, puis ip access-group EDGE-IN in", fiche: 'acl', ok: () => { const t = CHK.aclTarget(); return !!(t && t.applied); } },
      { k: 'aclshow', t: "Vérifie les compteurs dans la CLI du routeur : show access-lists", fiche: 'acl', ok: () => CHK.cmd('show access-lists') },
    ],
    rev: 0, bonus: 3000, unlock: [] },
  { id: 'c15', chap: 4, client: 'Agences Plus', what: "Un VPN pour 40 agences et un annuaire Active Directory derrière.", notions: ['ad', 'tls'],
    svcs: [{ s: 'vpn', n: 1 }, { s: 'ad', n: 1 }], flows: [['Internet', 'DMZ', 'udp', 51820], ['DMZ', 'SERVEURS', 'tcp', 389], ['DMZ', 'SERVEURS', 'tcp', 88]], deps: [['vpn', 'ad']],
    rev: 1400, bonus: 3000, unlock: [] },
  { id: 'c16', chap: 4, client: 'Nordik Shop', what: "Une boutique en ligne en haute disponibilité, répartie sur deux baies.", notions: ['archi', 'froid', 'salle'],
    svcs: [{ s: 'lb', n: 1 }, { s: 'web', n: 2, antiRack: true }, { s: 'db', n: 1, raid: 10 }],
    flows: [['Internet', 'DMZ', 'tcp', 443], ['DMZ', 'SERVEURS', 'tcp', 5432]], deps: [['lb', 'web'], ['web', 'db']],
    rev: 1300, bonus: 3000, unlock: ['spine', 'inrow', 'dacq', 'ups'] },
  { id: 'c17', chap: 4, client: 'Campus Numérique', what: "Une plateforme de cours en conteneurs : un cluster Kubernetes de 3 nœuds sur 3 baies.", notions: ['k8s', 'archi'],
    svcs: [{ s: 'lb', n: 1 }, { s: 'k8s', n: 3, antiRack: true }], flows: [['Internet', 'DMZ', 'tcp', 443], ['DMZ', 'SERVEURS', 'tcp', 30443], ['ADMIN', 'SERVEURS', 'tcp', 6443]], deps: [['lb', 'k8s']],
    rev: 3200, bonus: 6000, unlock: [] },
  { id: 'c18', chap: 4, client: 'Hébergeur régional', what: "De la capacité web en masse avec un SLA de 99,95 % : deux opérateurs et un groupe électrogène.", notions: ['onduleur', 'archi'], final: true, needOp2: true, needGen: true,
    svcs: [{ s: 'lb', n: 2, antiRack: true }, { s: 'web', n: 4, antiRack: true }],
    flows: [['Internet', 'DMZ', 'tcp', 443]], deps: [['lb', 'web']],
    rev: 6000, bonus: 10000, unlock: [] },
];
CONTRACTS.forEach(c => { c.svcs = c.svcs || []; c.flows = c.flows || []; c.notions = c.notions || []; });
function contractDef(id) {
  const c = CONTRACTS.find(x => x.id === id);
  if (c) return c;
  const k = +id.slice(1) - CONTRACTS.length;
  const pick = ['web', 'dns', 'mail', 'vpn'][k % 4];
  const svc = SVC[pick];
  return { id, chap: 4, client: ['Clinique Saint-Luc', 'Cave Bertin', 'Lycée Jean-Moulin', 'Transports Rivière', 'Atelier Noé'][k % 5] + ` (n° ${k})`,
    what: `${svc.name} pour un nouveau client`, svcs: [{ s: pick, n: 1 + (k % 2) }], notions: [],
    flows: svc.ports.map(p => ['Internet', 'DMZ', p[0], p[1]]), rev: 500 + 150 * k, bonus: 1000 + 200 * k, unlock: [] };
}

const RANKS = [[0, 'Stagiaire'], [120, 'Technicien'], [350, 'Administrateur'], [800, 'Ingénieur'], [1600, 'Architecte datacenter']];
const DEFAULT_UNLOCKED = ['sw24', 'srv1', 'router', 'fw', 'cat6', 'dac', 'os2', 'blank', 'cm', 'ssd'];
