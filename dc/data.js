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

/* ---------- Contrats ---------- */
const CONTRACTS = [
  { id: 'c1', client: 'Le Fournil', what: "Première baie : le site vitrine de la boulangerie. Tout est à construire.", tuto: true,
    svcs: [{ s: 'web', n: 1 }], flows: [['Internet', 'DMZ', 'tcp', 443]],
    rev: 160, bonus: 800, unlock: ['cat6a', 'om4'] },
  { id: 'c2', client: 'Cabinet Marchand', what: "Logiciel de gestion avec sa base de données",
    svcs: [{ s: 'web', n: 1 }, { s: 'db', n: 1, raid: 1 }], flows: [['Internet', 'DMZ', 'tcp', 443], ['DMZ', 'SERVEURS', 'tcp', 5432]], deps: [['web', 'db']],
    rev: 380, bonus: 1200, unlock: ['srv2', 'hdd', 'ram'] },
  { id: 'c3', client: 'Mairie de Saint-Aubin', what: "DNS de la commune et messagerie des agents",
    svcs: [{ s: 'dns', n: 1 }, { s: 'mail', n: 1 }],
    flows: [['Internet', 'DMZ', 'udp', 53], ['Internet', 'DMZ', 'tcp', 53], ['Internet', 'DMZ', 'tcp', 25], ['Internet', 'DMZ', 'tcp', 587], ['Internet', 'DMZ', 'tcp', 993]],
    rev: 520, bonus: 1500, unlock: ['leaf', 'rowpower'] },
  { id: 'c4', client: 'Projet interne', internal: true, what: "Superviser la salle avec Zabbix",
    svcs: [{ s: 'mon', n: 1 }], flows: [['ADMIN', 'DMZ', 'udp', 161], ['ADMIN', 'SERVEURS', 'udp', 161]],
    rev: 0, bonus: 2500, unlock: ['nas', 'containment', 'crac'], effect: 'monitoring' },
  { id: 'c5', client: 'Nordik Shop', what: "Boutique en ligne en haute disponibilité, répartie sur deux baies",
    svcs: [{ s: 'lb', n: 1 }, { s: 'web', n: 2, antiRack: true }, { s: 'db', n: 1, raid: 10 }],
    flows: [['Internet', 'DMZ', 'tcp', 443], ['DMZ', 'SERVEURS', 'tcp', 5432]], deps: [['lb', 'web'], ['web', 'db']],
    rev: 1300, bonus: 3000, unlock: ['spine', 'inrow', 'dacq', 'ups'] },
  { id: 'c6', client: 'Projet interne', internal: true, what: "Sauvegardes 3-2-1 sur la baie de stockage",
    svcs: [{ s: 'bak', n: 1 }], flows: [['SERVEURS', 'DMZ', 'tcp', 9102]],
    rev: 0, bonus: 3000, unlock: ['gen', 'op2', 'battery'], effect: 'backup' },
  { id: 'c7', client: 'Studio Pixel', what: "Dépôt de rushs vidéo en SFTP, 3 To",
    svcs: [{ s: 'sftp', n: 1 }], flows: [['Internet', 'DMZ', 'tcp', 22]],
    rev: 2000, bonus: 4000, unlock: [] },
  { id: 'c8', client: 'Agences Plus', what: "VPN pour 40 agences et annuaire Active Directory",
    svcs: [{ s: 'vpn', n: 1 }, { s: 'ad', n: 1 }], flows: [['Internet', 'DMZ', 'udp', 51820], ['DMZ', 'SERVEURS', 'tcp', 389], ['DMZ', 'SERVEURS', 'tcp', 88]], deps: [['vpn', 'ad']],
    rev: 1400, bonus: 3000, unlock: [] },
  { id: 'c9', client: 'Campus Numérique', what: "Plateforme de cours en conteneurs : un cluster Kubernetes de 3 nœuds sur 3 baies",
    svcs: [{ s: 'lb', n: 1 }, { s: 'k8s', n: 3, antiRack: true }], flows: [['Internet', 'DMZ', 'tcp', 443], ['DMZ', 'SERVEURS', 'tcp', 30443], ['ADMIN', 'SERVEURS', 'tcp', 6443]], deps: [['lb', 'k8s']],
    rev: 3200, bonus: 6000, unlock: [] },
  { id: 'c10', client: 'Hébergeur régional', what: "Capacité web en masse, SLA 99,95 % : deux opérateurs et un groupe électrogène", final: true, needOp2: true, needGen: true,
    svcs: [{ s: 'lb', n: 2, antiRack: true }, { s: 'web', n: 4, antiRack: true }],
    flows: [['Internet', 'DMZ', 'tcp', 443]], deps: [['lb', 'web']],
    rev: 6000, bonus: 10000, unlock: [] },
];
function contractDef(id) {
  const c = CONTRACTS.find(x => x.id === id);
  if (c) return c;
  const k = +id.slice(1) - CONTRACTS.length;
  const pick = ['web', 'dns', 'mail', 'vpn'][k % 4];
  const svc = SVC[pick];
  return { id, client: ['Clinique Saint-Luc', 'Cave Bertin', 'Lycée Jean-Moulin', 'Transports Rivière', 'Atelier Noé'][k % 5] + ` (n° ${k})`,
    what: `${svc.name} pour un nouveau client`, svcs: [{ s: pick, n: 1 + (k % 2) }],
    flows: svc.ports.map(p => ['Internet', 'DMZ', p[0], p[1]]), rev: 500 + 150 * k, bonus: 1000 + 200 * k, unlock: [] };
}

const RANKS = [[0, 'Stagiaire'], [120, 'Technicien'], [350, 'Administrateur'], [800, 'Ingénieur'], [1600, 'Architecte datacenter']];
const DEFAULT_UNLOCKED = ['sw24', 'srv1', 'router', 'fw', 'cat6', 'dac', 'os2', 'blank', 'cm', 'ssd'];
