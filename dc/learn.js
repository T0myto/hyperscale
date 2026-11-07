'use strict';
/* =========================================================
   Hyperscale — fiches de cours, quiz et incidents
   Contenu tiré du vault « cours-sisr-main », complété.
   ========================================================= */
const FICHES = [
  { id: 'baie', title: 'La baie et ses unités', vault: 'Architecture réseau · Bases', html: `
<p>Une baie standard mesure <b>19 pouces</b> de large et <b>42U</b> de haut. Une unité (<b>1U</b>) vaut 44,45 mm. Un serveur fin occupe 1U, une baie de stockage 2U.</p>
<p>La <b>face avant</b> donne sur l'allée froide : c'est là que l'air frais entre, et là qu'on change les disques à chaud. La <b>face arrière</b> donne sur l'allée chaude : on y trouve les ports, les alimentations et les PDU, donc tout le câblage.</p>
<table><tr><th>Élément</th><th>Rôle</th></tr>
<tr><td>Rails et unités</td><td>Repérer l'emplacement exact : « baie A1, U24 »</td></tr>
<tr><td>Obturateur</td><td>Fermer une unité vide pour que l'air chaud ne revienne pas devant</td></tr>
<tr><td>Guide-câbles</td><td>Ranger les cordons, garder l'accès aux équipements</td></tr>
<tr><td>Étiquettes</td><td>Nom d'hôte sur l'équipement, repère aux deux bouts de chaque câble</td></tr></table>`,
    retenir: "19 pouces, 42U, 1U = 44,45 mm. Face avant = air froid et disques, face arrière = câbles et alimentations. Chaque unité vide reçoit un obturateur.",
    quiz: [
      { q: "Combien mesure une unité de baie (1U) ?", o: ['44,45 mm', '19 pouces', '10 cm', '1 pouce'], a: 0, e: "1U = 1,75 pouce = 44,45 mm. 19 pouces, c'est la largeur." },
      { q: "À quoi sert un obturateur ?", o: ["Empêcher l'air chaud de revenir en face avant", 'Bloquer les câbles', "Protéger d'un vol", 'Isoler un VLAN'], a: 0, e: "Une unité ouverte laisse l'air chaud de l'arrière recirculer vers l'avant, donc vers l'entrée d'air des serveurs." },
      { q: "Où branche-t-on les cordons réseau dans une salle avec allées chaude et froide ?", o: ["Côté allée chaude, à l'arrière", "Côté allée froide, à l'avant", 'Sous le faux plancher uniquement', "Sur le toit de la baie"], a: 0, e: "Les ports et les alimentations sont à l'arrière des serveurs, côté allée chaude." }] },
  { id: 'elec', title: 'Alimentation : PSU, PDU, voies A et B', vault: 'Architectures réseau (redondance)', html: `
<p>Chaque équipement sérieux a <b>deux blocs d'alimentation</b> (PSU). Chaque baie a <b>deux PDU</b> : le PDU A est relié à la voie A du bâtiment, le PDU B à la voie B, chacune avec son propre onduleur.</p>
<p>La règle : <b>PSU1 sur A, PSU2 sur B</b>. Si une voie tombe, l'autre prend tout.</p>
<p>Puissance : <b>P = U × I</b>. Un PDU de 16 A sous 230 V supporte <b>3 680 W</b>. Au-delà, son disjoncteur saute.</p>
<table><tr><th>Charge par PDU</th><th>Conséquence si l'autre voie tombe</th></tr>
<tr><td>Moins de 50 %</td><td>Le PDU restant absorbe tout : aucune coupure</td></tr>
<tr><td>Plus de 50 %</td><td>Le PDU restant dépasse 100 % et disjoncte : toute la baie s'éteint</td></tr></table>`,
    retenir: "Deux PSU sur deux voies (A et B). P = U × I : 16 A × 230 V = 3 680 W. Chaque PDU reste sous 50 % pour pouvoir porter seul la baie.",
    quiz: [
      { q: "Un serveur a ses deux PSU branchées sur le PDU A. La voie A tombe. Que se passe-t-il ?", o: ["Il s'éteint", 'Il bascule sur B', 'Rien, il a deux PSU', 'Il passe sur batterie interne'], a: 0, e: "Deux PSU ne servent à rien si elles dépendent de la même voie." },
      { q: "Quelle puissance supporte un PDU 16 A en 230 V ?", o: ['3 680 W', '1 600 W', '230 W', '16 kW'], a: 0, e: "P = U × I = 230 × 16 = 3 680 W." },
      { q: "Pourquoi garder chaque PDU sous 50 % de charge ?", o: ["Pour qu'il puisse reprendre la charge de l'autre en cas de panne", "Pour économiser de l'électricité", 'Parce que le câble chauffe', 'Pour la garantie'], a: 0, e: "En redondance N+N, chaque côté doit pouvoir porter 100 % de la baie." }] },
  { id: 'cuivre', title: 'Câblage cuivre', vault: 'Câblage fibre SFP et PoE', html: `
<table><tr><th>Catégorie</th><th>Débit</th><th>Distance</th><th>Usage</th></tr>
<tr><td>Cat 5e</td><td>1 Gbit/s</td><td>100 m</td><td>Anciens sites</td></tr>
<tr><td>Cat 6</td><td>1 Gbit/s, 10 Gbit/s jusqu'à 55 m</td><td>100 m</td><td>Postes, BMC</td></tr>
<tr><td>Cat 6A</td><td>10 Gbit/s</td><td>100 m</td><td>Standard actuel</td></tr>
<tr><td>Cat 8</td><td>25 à 40 Gbit/s</td><td>30 m</td><td>Baie à baie</td></tr></table>
<p><b>Règle des 100 m</b> : 90 m de câble fixe et 10 m de cordons. Les normes T568A et T568B se valent, la seule règle est d'utiliser la même partout. Grâce à l'<b>Auto-MDIX</b>, droit ou croisé n'a plus d'importance.</p>
<p>Dans une baie, on utilise aussi le <b>DAC</b> : un câble cuivre avec des modules SFP+ intégrés, très bon marché, limité à quelques mètres.</p>`,
    retenir: "Cat 6A pour le 10 Gbit/s cuivre, 100 m maximum cordons compris. DAC pour quelques mètres entre cages SFP+.",
    quiz: [
      { q: "Quel câble pour du 10 Gbit/s cuivre sur 80 m ?", o: ['Cat 6A', 'Cat 6', 'Cat 5e', 'DAC'], a: 0, e: "La Cat 6 ne tient le 10 Gbit/s que jusqu'à 55 m." },
      { q: "Quelle est la longueur maximale d'un lien cuivre, cordons compris ?", o: ['100 m', '55 m', '300 m', '10 m'], a: 0, e: "90 m de câble fixe et 10 m de cordons." },
      { q: "Un DAC de 5 m doit relier deux baies distantes de 8 m. Que faire ?", o: ['Passer en fibre OM4 avec des modules SR', 'Mettre deux DAC bout à bout', 'Utiliser un DAC quand même', 'Passer en Cat 5e'], a: 0, e: "Un DAC est limité à quelques mètres. La fibre multimode convient dans le bâtiment." }] },
  { id: 'fibre', title: 'Fibre optique et modules', vault: 'Câblage fibre SFP et PoE', html: `
<table><tr><th>Fibre</th><th>Gaine</th><th>10 Gbit/s</th><th>Usage</th></tr>
<tr><td>OM3 / OM4 multimode</td><td>Turquoise</td><td>300 / 400 m</td><td>Dans le bâtiment, la salle</td></tr>
<tr><td>OS2 monomode</td><td>Jaune</td><td>10 km et plus</td><td>Entre bâtiments, opérateurs</td></tr></table>
<table><tr><th>Module</th><th>Débit</th><th>Fibre</th></tr>
<tr><td>SFP+ SR</td><td>10 Gbit/s</td><td>Multimode</td></tr>
<tr><td>SFP+ LR</td><td>10 Gbit/s</td><td>Monomode</td></tr>
<tr><td>QSFP+ SR4 / LR4</td><td>40 Gbit/s</td><td>Multimode / monomode</td></tr></table>
<p><b>Les 3 erreurs classiques</b> : deux modules différents sur un même lien (SR d'un côté, LR de l'autre) ; un module LR sur de la multimode ; émission et réception inversées. Vérifier avec <code>show interfaces transceiver</code> : une puissance reçue vers −40 dBm veut dire « plus de lumière ».</p>
<p>Ne regarde jamais l'extrémité d'une fibre active : le laser est invisible et dangereux pour l'œil.</p>`,
    retenir: "Multimode OM4 (turquoise) dans la salle avec des modules SR. Monomode OS2 (jaune) vers les opérateurs avec des modules LR. Même module aux deux bouts.",
    quiz: [
      { q: "Quelle fibre et quels modules pour relier l'opérateur, à 3 km ?", o: ['OS2 monomode et modules LR', 'OM4 et modules SR', 'Cat 6A', 'DAC 40G'], a: 0, e: "Au-delà de quelques centaines de mètres, il faut du monomode et des modules LR." },
      { q: "Un lien fibre neuf ne monte pas, les modules sont bons. Que tenter ?", o: ['Inverser TX et RX sur un bout', 'Changer de VLAN', 'Redémarrer le serveur', 'Passer le port en trunk'], a: 0, e: "En duplex, l'émission d'un côté doit arriver sur la réception de l'autre." },
      { q: "show interfaces transceiver affiche Rx −40 dBm. Qu'en conclure ?", o: ["Aucune lumière ne revient : module, fibre ou module d'en face", 'Le lien est parfait', 'Le VLAN est faux', 'Le port est en shutdown'], a: 0, e: "Une réception normale se situe autour de −1 à −7 dBm." }] },
  { id: 'switch', title: 'Switch, VLAN et 802.1Q', vault: "Fonctionnement d'un switch · Cisco - VLAN STP VTP", html: `
<p>Un switch apprend les <b>adresses MAC</b> source et transmet chaque trame vers le bon port. S'il ne connaît pas la destination, il <b>inonde</b> le VLAN.</p>
<p>Un <b>VLAN</b> découpe un switch en plusieurs réseaux isolés : chaque VLAN est un domaine de broadcast.</p>
<table><tr><th>Mode du port</th><th>Ce qu'il transporte</th><th>Usage</th></tr>
<tr><td>access</td><td>Un seul VLAN, sans étiquette</td><td>Un équipement qui n'appartient qu'à une zone</td></tr>
<tr><td>trunk</td><td>Plusieurs VLAN, étiquetés 802.1Q</td><td>Switch vers switch, switch vers pare-feu, switch vers hyperviseur</td></tr></table>
<p>Sur un trunk, chaque trame reçoit 4 octets dont le <b>VID</b> sur 12 bits : 4 094 VLAN possibles. Le <b>VLAN natif</b> passe sans étiquette et doit être identique des deux côtés. On n'utilise jamais le VLAN 1.</p>
<p>Un VLAN doit être <b>autorisé sur chaque trunk</b> du chemin, de la VM jusqu'au pare-feu.</p>`,
    retenir: "Access = un VLAN. Trunk = plusieurs VLAN étiquetés. Le VLAN doit être autorisé sur tous les trunks du chemin. VLAN natif identique des deux côtés, jamais le VLAN 1.",
    quiz: [
      { q: "Un hyperviseur héberge des VM en DMZ et en SERVEURS. Comment configurer son port de switch ?", o: ['En trunk avec les VLAN 10 et 20', 'En access VLAN 10', 'En access VLAN 1', 'En shutdown'], a: 0, e: "Un port access ne transporte qu'un VLAN. Le vault le dit : le port physique de l'hyperviseur passe en trunk." },
      { q: "show interfaces trunk n'affiche que le VLAN 10. Le VLAN 20 ne passe pas. Pourquoi ?", o: ["Le VLAN 20 n'est pas autorisé sur le trunk", 'Le câble est abîmé', "L'IP est fausse", 'Le pare-feu bloque'], a: 0, e: "switchport trunk allowed vlan doit lister chaque VLAN utile." },
      { q: "Combien de VLAN permet le champ VID ?", o: ['4 094', '256', '1 024', '16 millions'], a: 0, e: "12 bits = 4 096 valeurs, moins 0 et 4 095. 16 millions, c'est le VXLAN." }] },
  { id: 'ip', title: "Plan d'adressage IPv4", vault: 'Adressage IPv4 et sous-réseaux · Aide-mémoire', html: `
<p>Chaque VLAN routé reçoit un réseau. Ici, tous sont en <b>/24</b> : masque 255.255.255.0, 254 adresses utilisables.</p>
<table><tr><th>VLAN</th><th>Réseau</th><th>Passerelle</th></tr>
<tr><td>10 DMZ</td><td>172.16.10.0/24</td><td>172.16.10.1</td></tr>
<tr><td>20 SERVEURS</td><td>10.20.0.0/24</td><td>10.20.0.1</td></tr>
<tr><td>30 STOCKAGE</td><td>10.30.0.0/24</td><td>aucune (non routé)</td></tr>
<tr><td>99 ADMIN</td><td>10.99.0.0/24</td><td>10.99.0.1</td></tr></table>
<p>Dans un /24, la première adresse (.0) est le <b>réseau</b>, la dernière (.255) le <b>broadcast</b>. On réserve .1 à la passerelle. Bloc = 256 − octet du masque.</p>
<p>Plages privées : <code>10.0.0.0/8</code>, <code>172.16.0.0/12</code>, <code>192.168.0.0/16</code>.</p>`,
    retenir: "Une VM prend une IP du réseau de son VLAN. .0 = réseau, .255 = broadcast, .1 = passerelle. /24 = 254 hôtes.",
    quiz: [
      { q: "Une VM du VLAN 10 a l'adresse 10.20.0.15. Que se passe-t-il ?", o: ["Elle ne joint pas sa passerelle : l'IP n'est pas dans son réseau", 'Tout fonctionne', 'Elle passe dans le VLAN 20', 'Le pare-feu corrige'], a: 0, e: "L'adresse doit appartenir au réseau du VLAN : 172.16.10.0/24." },
      { q: "Combien d'hôtes dans un /26 ?", o: ['62', '64', '126', '30'], a: 0, e: "Bloc de 64, moins le réseau et le broadcast." },
      { q: "Quelle plage est privée ?", o: ['172.16.0.0/12', '8.8.8.0/24', '203.0.113.0/24', '1.1.1.0/24'], a: 0, e: "10/8, 172.16/12 et 192.168/16 sont les trois plages privées." }] },
  { id: 'pf', title: 'Pare-feu, DMZ et matrice de flux', vault: 'Pare-feu et DMZ', html: `
<p>Le pare-feu <b>avec état</b> se souvient des connexions : on autorise la requête, la réponse revient toute seule.</p>
<p>La <b>DMZ</b> héberge ce qui est exposé à Internet. Si un serveur de la DMZ est compromis, l'attaquant n'est pas dans le réseau interne.</p>
<p>Avant d'écrire une règle, on remplit la <b>matrice de flux</b> : qui parle à qui, sur quel port.</p>
<table><tr><th>Source → destination</th><th>Exemple</th></tr>
<tr><td>Internet → DMZ</td><td>TCP 443 vers le site web, rien d'autre</td></tr>
<tr><td>DMZ → SERVEURS</td><td>Seulement le web vers la base, TCP 5432</td></tr>
<tr><td>Internet → SERVEURS</td><td>Interdit</td></tr>
<tr><td>ADMIN → tout</td><td>SSH, SNMP, depuis le réseau d'administration seulement</td></tr></table>
<p>Principe : <b>tout est interdit, sauf ce qui est explicitement autorisé</b>, y compris en sortie. Équivalent nftables : <code>policy drop;</code> puis une règle <code>accept</code> par flux.</p>`,
    retenir: "Stateful = se souvient des connexions. La DMZ isole ce qui est exposé. La matrice de flux avant les règles. Tout est interdit sauf exception.",
    quiz: [
      { q: "Un serveur web exposé doit-il être dans la zone SERVEURS ?", o: ['Non, en DMZ', 'Oui', 'Dans ADMIN', 'Dans STOCKAGE'], a: 0, e: "Ce qui est joignable depuis Internet va en DMZ." },
      { q: "Le web en DMZ doit lire la base en SERVEURS. Quelle règle ?", o: ['DMZ → SERVEURS TCP 5432 uniquement', 'DMZ → SERVEURS tout', 'Internet → SERVEURS 5432', 'Mettre la base en DMZ'], a: 0, e: "Uniquement le flux nécessaire, sur le seul port nécessaire." },
      { q: "Pourquoi un pare-feu avec état simplifie-t-il les règles ?", o: ['La réponse est autorisée automatiquement', 'Il ne filtre rien', 'Il chiffre le trafic', 'Il remplace le switch'], a: 0, e: "Il suit la connexion : pas besoin d'ouvrir les ports dynamiques au retour." }] },
  { id: 'ports', title: 'TCP, UDP et ports à connaître', vault: 'TCP UDP et protocoles essentiels', html: `
<p><b>TCP</b> établit une connexion (SYN, SYN-ACK, ACK) et garantit la livraison. <b>UDP</b> envoie sans connexion, plus vite.</p>
<table><tr><th>Port</th><th>Service</th><th>Port</th><th>Service</th></tr>
<tr><td>22 TCP</td><td>SSH, SFTP</td><td>443 TCP</td><td>HTTPS</td></tr>
<tr><td>25, 587 TCP</td><td>SMTP</td><td>993 TCP</td><td>IMAPS</td></tr>
<tr><td>53 UDP et TCP</td><td>DNS</td><td>5432 TCP</td><td>PostgreSQL</td></tr>
<tr><td>123 UDP</td><td>NTP</td><td>161, 162 UDP</td><td>SNMP</td></tr>
<tr><td>514 UDP</td><td>Syslog</td><td>51820 UDP</td><td>WireGuard</td></tr></table>
<p>Dans une capture, <b>SYN sans réponse</b> = filtré, <b>SYN puis RST</b> = la machine répond mais rien n'écoute sur ce port.</p>`,
    retenir: "TCP = fiable avec handshake, UDP = rapide sans connexion. 22, 53, 123, 161, 443, 514, 5432 sont à connaître par cœur.",
    quiz: [
      { q: "Quel port ouvrir pour un DNS faisant autorité ?", o: ['53 en UDP et en TCP', '53 en UDP seulement', '853', '443'], a: 0, e: "Le DNS passe en UDP, et en TCP pour les grandes réponses et les transferts de zone." },
      { q: "SYN puis RST dans Wireshark : que conclure ?", o: ["La machine répond mais aucun service n'écoute", 'Le pare-feu filtre', 'Le câble est coupé', 'Le DNS est faux'], a: 0, e: "Un filtrage donnerait plutôt un SYN sans réponse." },
      { q: "Quel protocole utilise WireGuard ?", o: ['UDP 51820', 'TCP 443', 'UDP 500', 'TCP 1194'], a: 0, e: "UDP 500 et 4500, c'est IPsec (IKE et NAT-T)." }] },
  { id: 'virtu', title: 'Virtualisation', vault: 'Virtualisation', html: `
<p>Un <b>hyperviseur de type 1</b> (Proxmox, ESXi, Hyper-V, KVM) s'installe directement sur le serveur et fait tourner des machines virtuelles.</p>
<table><tr><th>Ressource</th><th>Surallocation</th></tr>
<tr><td>vCPU</td><td>Acceptable : les VM n'utilisent pas toutes leur processeur en même temps</td></tr>
<tr><td>RAM</td><td>Risquée : si la mémoire manque, le noyau tue des processus</td></tr>
<tr><td>Disque</td><td>Limité par l'espace utile de la grappe</td></tr></table>
<p>Un <b>switch virtuel</b> (vmbr0) relie les VM ; chaque VM reçoit une étiquette de VLAN (<code>tag=10</code>). Le port physique de l'hyperviseur passe donc en <b>trunk</b>.</p>
<p>Un <b>snapshot n'est pas une sauvegarde</b> : il vit sur le même stockage que la VM.</p>
<p>Anti-affinité : deux VM qui se secourent ne doivent jamais être sur le même hôte.</p>`,
    retenir: "Type 1 sur le matériel. vCPU surallouables, RAM non. Port de l'hyperviseur en trunk. Snapshot ≠ sauvegarde. Anti-affinité pour la haute disponibilité.",
    quiz: [
      { q: "Quelle ressource ne faut-il pas surallouer ?", o: ['La RAM', 'Les vCPU', 'Les ports réseau', 'Les VLAN'], a: 0, e: "Quand la mémoire manque, le noyau tue des processus (OOM killer)." },
      { q: "Deux serveurs web d'un même site sont sur le même hôte. Quel risque ?", o: ["Une panne de l'hôte coupe les deux", 'Aucun', 'Un conflit IP', 'Le VLAN sature'], a: 0, e: "C'est le rôle de l'anti-affinité." },
      { q: "Un snapshot protège-t-il d'une panne de disque ?", o: ['Non, il est sur le même stockage', 'Oui', 'Seulement en RAID 0', 'Seulement la nuit'], a: 0, e: "Snapshot = retour arrière rapide, pas une copie indépendante." }] },
  { id: 'raid', title: 'RAID', vault: 'Linux - RAID', html: `
<table><tr><th>RAID</th><th>Disques min.</th><th>Capacité utile</th><th>Tolérance</th></tr>
<tr><td>0</td><td>2</td><td>100 %</td><td>aucune</td></tr>
<tr><td>1</td><td>2</td><td>50 %</td><td>1 disque</td></tr>
<tr><td>5</td><td>3</td><td>N − 1</td><td>1 disque</td></tr>
<tr><td>6</td><td>4</td><td>N − 2</td><td>2 disques</td></tr>
<tr><td>10</td><td>4</td><td>50 %</td><td>1 par miroir</td></tr></table>
<p>Exemple : 4 disques de 8 To en RAID 5 = 3 × 8 = <b>24 To</b> utiles. En RAID 6 = 16 To.</p>
<p>Pendant la <b>reconstruction</b>, la grappe n'a plus de marge. Avec de gros disques lents, elle dure longtemps : c'est pour ça qu'on préfère le RAID 6 pour les gros HDD et le RAID 10 pour les bases de données.</p>
<p><b>RAID ≠ sauvegarde</b> : il protège d'une panne de disque, pas d'une suppression, d'un rançongiciel ou d'un incendie. Suivi : <code>cat /proc/mdstat</code> affiche [UU] quand tout va bien, [U_] quand un disque manque.</p>`,
    retenir: "0 = vitesse, 1 = miroir, 5 = compromis, 6 = deux pannes, 10 = vitesse et sûreté. RAID ≠ sauvegarde.",
    quiz: [
      { q: "6 disques de 2 To en RAID 6 : capacité utile ?", o: ['8 To', '10 To', '12 To', '6 To'], a: 0, e: "(N − 2) × taille = 4 × 2 To." },
      { q: "cat /proc/mdstat affiche [UU_U]. Qu'est-ce que ça signifie ?", o: ['Un disque manque, la grappe est dégradée', 'Tout va bien', 'La grappe est en RAID 0', 'Le disque 3 est un spare'], a: 0, e: "Chaque U est un disque actif, chaque _ un disque absent ou en panne." },
      { q: "Un RAID 1 protège-t-il d'une suppression accidentelle ?", o: ['Non, la suppression est copiée sur le miroir', 'Oui', 'Seulement avec un spare', 'Oui en RAID 10'], a: 0, e: "Le miroir reproduit tout, y compris les erreurs." }] },
  { id: 'bak', title: 'Sauvegardes 3-2-1', vault: 'Sauvegardes', html: `
<p><b>Règle 3-2-1</b> : 3 copies des données, sur 2 supports différents, dont 1 hors site (et idéalement une hors ligne contre les rançongiciels).</p>
<table><tr><th>Type</th><th>Copie</th></tr>
<tr><td>Complète</td><td>Tout, à chaque fois : simple mais lourde</td></tr>
<tr><td>Différentielle</td><td>Ce qui a changé depuis la dernière complète</td></tr>
<tr><td>Incrémentale</td><td>Ce qui a changé depuis la dernière sauvegarde</td></tr></table>
<p><b>RPO</b> : combien de données peut-on perdre ? Une sauvegarde par nuit = RPO de 24 h. <b>RTO</b> : en combien de temps doit-on repartir ?</p>
<p>Une sauvegarde jamais restaurée n'existe pas : on teste les restaurations.</p>`,
    retenir: "3 copies, 2 supports, 1 hors site. RPO = perte acceptable, RTO = délai de reprise. Tester les restaurations. RAID ≠ sauvegarde.",
    quiz: [
      { q: "Une sauvegarde par nuit à 2 h. Quel RPO ?", o: ['24 h', '2 h', '0', '1 semaine'], a: 0, e: "Au pire, on perd une journée de données." },
      { q: "L'incrémentale copie ce qui a changé depuis…", o: ['la dernière sauvegarde, quelle qu’elle soit', 'la dernière complète', 'le début', 'hier midi'], a: 0, e: "La différentielle, elle, repart de la dernière complète." },
      { q: "Pourquoi une copie hors ligne ?", o: ['Un rançongiciel ne peut pas la chiffrer', 'Elle est plus rapide', 'Elle évite le RAID', 'Elle est gratuite'], a: 0, e: "Ce qui est joignable par le réseau peut être chiffré par l'attaquant." }] },
  { id: 'sup', title: 'Supervision : SNMP, Syslog, NTP', vault: 'Supervision SNMP Syslog NTP', html: `
<p>Objectif : être prévenu d'une panne <b>avant les utilisateurs</b>.</p>
<table><tr><th>Outil</th><th>Répond à</th><th>Port</th></tr>
<tr><td>SNMP</td><td>L'équipement va-t-il bien ? Le lien est-il saturé ?</td><td>UDP 161, traps 162</td></tr>
<tr><td>Syslog</td><td>Que s'est-il passé, et quand ?</td><td>UDP 514</td></tr>
<tr><td>NetFlow</td><td>Qui consomme le lien ?</td><td>UDP</td></tr>
<tr><td>NTP</td><td>Une heure commune pour relier les journaux</td><td>UDP 123</td></tr></table>
<p>Gravités Syslog : 0 Emergency, 1 Alert, 2 Critical, 3 Error, 4 Warning, 5 Notification, 6 Informational, 7 Debugging. Mnémo : <i>Every Awesome Cisco Engineer Will Need Ice cream Daily</i>.</p>
<p>Les pannes matérielles (PSU, disque, température) remontent par le <b>BMC</b> (iDRAC, IPMI) : son port doit être câblé dans le VLAN d'administration. On utilise <b>SNMPv3 authPriv</b>.</p>`,
    retenir: "NTP d'abord. SNMPv3 authPriv sur UDP 161/162. Syslog UDP 514, de 0 (grave) à 7. Le BMC câblé dans l'ADMIN pour voir le matériel.",
    quiz: [
      { q: "%LINK-3-UPDOWN : quelle gravité ?", o: ['3, Error', '5, Notification', '1, Alert', '7, Debugging'], a: 0, e: "Le chiffre entre les tirets donne la gravité." },
      { q: "Pourquoi configurer NTP avant Syslog ?", o: ['Pour corréler les journaux de plusieurs équipements', 'Pour chiffrer', 'Pour aller plus vite', 'Pour le DNS'], a: 0, e: "Sans heure commune, impossible de reconstituer une chronologie." },
      { q: "Comment la supervision voit-elle une alimentation en panne sur un serveur ?", o: ['Par le BMC (IPMI), câblé dans le VLAN ADMIN', 'Par le DNS', 'Par le client', 'Par le VLAN natif'], a: 0, e: "Le contrôleur de gestion du serveur surveille capteurs, PSU et disques." }] },
  { id: 'dep', title: 'Méthode de dépannage', vault: 'Méthode de dépannage réseau', html: `
<p>Ne pas modifier au hasard : <b>observer, supposer, tester, documenter</b>.</p>
<ol><li><b>Définir</b> le problème : qui, quoi, depuis quand ? Qu'est-ce qui a changé ?</li>
<li><b>Collecter</b> : commandes show, journaux, supervision.</li>
<li><b>Hypothèse</b>, puis <b>tester un seul changement à la fois</b>.</li>
<li><b>Vérifier et documenter</b> dans une fiche d'incident.</li></ol>
<table><tr><th>Couche</th><th>Ce qu'on vérifie</th></tr>
<tr><td>1 Physique</td><td>Énergie, câble, module, voyants, erreurs CRC</td></tr>
<tr><td>2 Liaison</td><td>VLAN, trunk, MAC, err-disabled, STP</td></tr>
<tr><td>3 Réseau</td><td>Adresse IP, passerelle, routes</td></tr>
<tr><td>4 Transport</td><td>Règles du pare-feu, ports</td></tr>
<tr><td>7 Application</td><td>Service démarré, disque, mémoire, certificat</td></tr></table>
<table><tr><th>Compteur</th><th>Cause probable</th></tr>
<tr><td>CRC, input errors</td><td>Câble ou connecteur abîmé</td></tr>
<tr><td>late collision</td><td>Duplex différent de chaque côté</td></tr>
<tr><td>output drops</td><td>Interface saturée</td></tr></table>`,
    retenir: "Définir, collecter, supposer, tester un seul changement, documenter. De bas en haut : énergie, câble, VLAN, IP, règles, service. CRC = câble, late collision = duplex.",
    quiz: [
      { q: "Beaucoup de late collisions sur un port. Cause probable ?", o: ['Duplex différent de chaque côté', 'Câble abîmé', 'Mauvais VLAN', 'Certificat expiré'], a: 0, e: "Un côté en full, l'autre retombé en half duplex." },
      { q: "ping 8.8.8.8 répond mais pas ping google.com. Couche en cause ?", o: ['Application : le DNS', 'Physique', 'Liaison', 'Transport'], a: 0, e: "Le réseau fonctionne, c'est la résolution de noms qui échoue." },
      { q: "Quelle est la première étape ?", o: ['Définir le problème : qui, quoi, depuis quand', 'Redémarrer', 'Changer le câble', 'Appeler le fournisseur'], a: 0, e: "On ne corrige bien que ce qu'on a compris." }] },
  { id: 'l2sec', title: 'Sécurité de niveau 2', vault: 'Sécurité de niveau 2', html: `
<table><tr><th>Attaque</th><th>Protection</th></tr>
<tr><td>Switch pirate, prise de rôle STP</td><td>BPDU Guard sur les ports d'accès</td></tr>
<tr><td>MAC flooding</td><td>Port Security</td></tr>
<tr><td>Faux serveur DHCP</td><td>DHCP Snooping</td></tr>
<tr><td>VLAN hopping</td><td>Forcer access ou trunk, nonegotiate, VLAN natif dédié</td></tr>
<tr><td>Tempête de broadcast</td><td>Storm Control</td></tr></table>
<p>Un port protégé par BPDU Guard passe en <b>err-disabled</b> dès qu'un BPDU arrive. Pour le relancer : retirer la cause, puis <code>shutdown</code> et <code>no shutdown</code>.</p>
<p>Les <b>ports inutilisés</b> sont coupés (<code>shutdown</code>) et placés dans un VLAN poubelle.</p>`,
    retenir: "BPDU Guard et PortFast sur les ports d'accès. Ports inutilisés en shutdown. err-disabled : enlever la cause, puis shutdown / no shutdown.",
    quiz: [
      { q: "Un port passe en err-disabled juste après le branchement d'un petit switch. Quelle fonction a réagi ?", o: ['BPDU Guard', 'Port Security', 'DHCP Snooping', 'NTP'], a: 0, e: "Le petit switch envoie des BPDU Spanning Tree." },
      { q: "Comment relancer un port err-disabled ?", o: ['Retirer la cause, puis shutdown et no shutdown', 'Redémarrer le serveur', 'Changer de VLAN', 'Attendre'], a: 0, e: "Sans retirer la cause, le port retombe aussitôt." },
      { q: "Que faire des ports inutilisés ?", o: ['Les couper et les mettre dans un VLAN poubelle', 'Les laisser en VLAN 1', 'Les passer en trunk', 'Les mettre en DMZ'], a: 0, e: "Un port actif dans le VLAN 1 est une porte ouverte." }] },
  { id: 'froid', title: 'Refroidissement et PUE', vault: 'Bases de l’informatique (chaleur)', html: `
<p>Presque toute l'électricité consommée par un serveur devient de la <b>chaleur</b>. L'air froid entre en face avant, ressort chaud à l'arrière.</p>
<p>Recommandation ASHRAE : air d'entrée entre <b>18 et 27 °C</b>. Au-delà, les serveurs réduisent leur fréquence, puis s'arrêtent pour se protéger.</p>
<table><tr><th>Mesure</th><th>Effet</th></tr>
<tr><td>Allées chaude et froide</td><td>On ne souffle pas l'air chaud d'une baie dans l'entrée de la suivante</td></tr>
<tr><td>Obturateurs</td><td>L'air chaud ne recircule plus par les unités vides</td></tr>
<tr><td>Confinement</td><td>L'air froid va là où il sert</td></tr>
<tr><td>Clim en rangée</td><td>Le froid est produit au plus près de la chaleur</td></tr></table>
<p><b>PUE</b> = énergie totale du site ÷ énergie des équipements informatiques. 2,0 = autant d'énergie pour refroidir que pour calculer. Les meilleurs sites sont vers 1,1 à 1,2.</p>`,
    retenir: "Entrée d'air 18 à 27 °C. Obturateurs, allées et confinement. PUE = total ÷ informatique, plus il est proche de 1, mieux c'est.",
    quiz: [
      { q: "Un site consomme 500 kW, dont 400 kW pour l'informatique. PUE ?", o: ['1,25', '0,8', '1,5', '100'], a: 0, e: "500 ÷ 400 = 1,25." },
      { q: "Quelle plage de température d'entrée recommande l'ASHRAE ?", o: ['18 à 27 °C', '5 à 15 °C', '30 à 40 °C', '0 à 10 °C'], a: 0, e: "Au-dessus, on gaspille la durée de vie et on risque l'arrêt." },
      { q: "Le moyen le moins cher de baisser la température d'entrée ?", o: ['Poser des obturateurs sur les unités vides', 'Acheter un serveur', 'Passer en fibre', 'Couper le pare-feu'], a: 0, e: "Quelques euros par unité, et l'air chaud ne revient plus." }] },
  { id: 'archi', title: 'Redondance et spine-leaf', vault: 'Architectures réseau · EtherChannel et LACP', html: `
<p>Règle d'or : <b>aucun point unique de panne</b>.</p>
<table><tr><th>À sécuriser</th><th>Solution</th></tr>
<tr><td>Alimentation</td><td>Deux PSU, voies A et B</td></tr>
<tr><td>Lien</td><td>Deux câbles (LACP), deux switches</td></tr>
<tr><td>Disque</td><td>RAID avec tolérance</td></tr>
<tr><td>Hôte</td><td>Plusieurs VM sur des hôtes différents, derrière un répartiteur</td></tr>
<tr><td>Accès Internet</td><td>Deux opérateurs et BGP</td></tr></table>
<p>Dans un datacenter, le trafic va surtout de serveur à serveur. Le modèle <b>spine-leaf</b> relie chaque leaf (switch de baie, « top of rack ») à chaque spine : deux serveurs sont toujours à deux sauts.</p>
<p>Une redondance non testée n'existe pas : on simule la panne.</p>`,
    retenir: "Pas de point unique de panne. Spine-leaf dans le datacenter : chaque leaf relié à chaque spine. Deux opérateurs avec BGP. Tester les bascules.",
    quiz: [
      { q: "Dans un spine-leaf, à quoi est relié chaque leaf ?", o: ['À chaque spine', 'Aux autres leafs', 'À un seul spine', 'Directement à Internet'], a: 0, e: "Pas de lien entre leafs ni entre spines." },
      { q: "Un switch d'accès n'a qu'une alimentation. Est-ce un point unique de panne ?", o: ['Oui', 'Non', 'Seulement en 10G', 'Seulement en trunk'], a: 0, e: "Sa PSU ou sa voie électrique tombe, tout ce qui en dépend tombe." },
      { q: "Comment survivre à la coupure d'un opérateur ?", o: ['Un second opérateur et BGP', 'Un câble plus long', 'Un VLAN de plus', 'Un RAID 6'], a: 0, e: "BGP retire automatiquement les routes du lien tombé." }] },
  { id: 'tls', title: 'Certificats TLS', vault: 'Cryptographie PKI et TLS', html: `
<p>Un <b>certificat</b> lie un nom (<code>www.client.fr</code>) à une clé publique, signé par une <b>autorité de certification</b>. La clé privée ne quitte jamais le serveur.</p>
<p>Il a une <b>date d'expiration</b>. Let's Encrypt délivre des certificats de 90 jours : on les renouvelle automatiquement avec ACME (certbot).</p>
<p>Vérifier : <code>openssl s_client -connect site:443</code> puis <code>openssl x509 -noout -dates</code>. TLS 1.2 ou 1.3 uniquement.</p>`,
    retenir: "Un certificat expire : renouvellement automatique ACME et surveillance de l'échéance. La clé privée reste sur le serveur.",
    quiz: [
      { q: "Le site affiche « certificat expiré ». Que faire durablement ?", o: ['Renouveler et activer le renouvellement automatique ACME', 'Désactiver HTTPS', 'Changer de VLAN', 'Redémarrer le switch'], a: 0, e: "Le renouvellement manuel finit toujours par être oublié." },
      { q: "Que contient un certificat ?", o: ['Un nom et une clé publique signés par une CA', 'La clé privée', 'Le mot de passe admin', "L'adresse MAC"], a: 0, e: "La clé privée ne sort jamais du serveur." },
      { q: "Quelle durée pour un certificat Let's Encrypt ?", o: ['90 jours', '10 ans', '1 jour', '5 ans'], a: 0, e: "Des durées courtes limitent l'impact d'une clé volée." }] },
  { id: 'attaques', title: 'Attaques et défense', vault: 'Durcissement et recommandations ANSSI', html: `
<table><tr><th>Attaque</th><th>Signe</th><th>Défense</th></tr>
<tr><td>Balayage de ports</td><td>Refus en série dans les journaux</td><td>Politique par défaut drop, lire les journaux</td></tr>
<tr><td>Force brute SSH</td><td>« Failed password » en rafale</td><td>SSH seulement depuis l'ADMIN, clés, fail2ban</td></tr>
<tr><td>DDoS volumétrique</td><td>Lien opérateur à 100 %</td><td>Filtrage en amont chez l'opérateur</td></tr>
<tr><td>SYN flood</td><td>Table de sessions pleine</td><td>Limiter les SYN, SYN cookies</td></tr>
<tr><td>Rançongiciel</td><td>Fichiers renommés, demande de rançon</td><td>Isoler, restaurer, sauvegardes hors ligne</td></tr></table>
<p>Recommandations ANSSI : moindre privilège, administration séparée, couper l'inutile, tout tracer, tout mettre à jour.</p>`,
    retenir: "Fermer l'inutile, administrer depuis un réseau dédié, lire les journaux. DDoS volumétrique : on filtre chez l'opérateur. Rançongiciel : isoler, restaurer, ne pas payer.",
    quiz: [
      { q: "Le lien Internet est saturé par 25 Gbit/s d'attaque sur 10 Gbit/s. Que faire ?", o: ["Demander le filtrage à l'opérateur, en amont", 'Ajouter une règle sur le pare-feu', 'Redémarrer le routeur', 'Changer le VLAN'], a: 0, e: "Le tuyau est plein avant même d'atteindre ton pare-feu." },
      { q: "Première action face à un rançongiciel ?", o: ['Isoler la machine du réseau', 'Payer', 'Éteindre la clim', 'Supprimer les sauvegardes'], a: 0, e: "On stoppe la propagation, puis on restaure." },
      { q: "D'où administrer les serveurs en SSH ?", o: ["Uniquement depuis le réseau d'administration", "Depuis Internet", 'Depuis la DMZ', "Depuis n'importe où avec un bon mot de passe"], a: 0, e: "Administration séparée : principe de base de l'ANSSI." }] },
  { id: 'salle', title: "Urbanisation d'une salle", vault: 'Architectures réseau (datacenter)', html: `
<p>Une salle est organisée en <b>rangées</b> de baies. Deux rangées se font face par l'avant autour d'une <b>allée froide</b> ; elles se tournent le dos autour d'une <b>allée chaude</b>. On n'aspire ainsi jamais l'air rejeté par la rangée d'en face.</p>
<table><tr><th>Espace</th><th>Rôle</th></tr>
<tr><td>Allée froide</td><td>Face avant des baies, dalles perforées, air soufflé par les climatiseurs</td></tr>
<tr><td>Allée chaude</td><td>Face arrière : câbles, PDU, air chaud qui repart vers les climatiseurs</td></tr>
<tr><td>Salle opérateurs (MMR)</td><td>Arrivée des fibres des opérateurs ; on s'y relie par un <b>cross-connect</b></td></tr>
<tr><td>Chemins de câbles</td><td>En hauteur, au-dessus des rangées : cuivre et fibre séparés</td></tr>
<tr><td>Local électrique</td><td>TGBT, onduleurs, batteries ; groupe électrogène à l'extérieur</td></tr></table>
<p>Une baie se repère par sa rangée et sa position : <b>B04</b> = rangée B, quatrième baie. Un câble entre baies passe par le chemin de câbles : sa longueur suit les allées, pas la ligne droite.</p>`,
    retenir: "Rangées face à face autour de l'allée froide, dos à dos autour de l'allée chaude. Les opérateurs arrivent en salle MMR. Les câbles entre baies passent en hauteur.",
    quiz: [
      { q: "De quel côté se trouve la face avant des baies ?", o: ["Du côté de l'allée froide", "Du côté de l'allée chaude", 'Contre le mur', 'Peu importe'], a: 0, e: "Les serveurs aspirent l'air par l'avant : l'avant doit donner sur l'air froid." },
      { q: "Où arrivent les fibres des opérateurs ?", o: ['En salle opérateurs (MMR)', 'Directement dans chaque baie', 'Dans le local électrique', 'Sur le toit'], a: 0, e: "On les rejoint par un cross-connect, souvent en fibre monomode." },
      { q: "Pourquoi deux rangées voisines se tournent-elles le dos ?", o: ["Pour que leurs sorties d'air chaud se rejoignent dans la même allée", 'Pour gagner de la place', 'Pour la sécurité', 'Pour les opérateurs'], a: 0, e: "C'est le principe des allées chaudes et froides." }] },
  { id: 'onduleur', title: 'Onduleurs, batteries et groupe électrogène', vault: 'Architectures réseau (redondance)', html: `
<p>La chaîne électrique d'un datacenter : <b>arrivée EDF → TGBT → onduleurs A et B → gaines à barres de chaque rangée → PDU des baies</b>.</p>
<table><tr><th>Élément</th><th>Rôle</th></tr>
<tr><td>TGBT</td><td>Tableau général basse tension : répartit l'arrivée du secteur</td></tr>
<tr><td>Onduleur (UPS)</td><td>Fournit un courant propre et prend le relais instantanément sur ses batteries</td></tr>
<tr><td>Batteries</td><td>Tiennent quelques minutes : juste le temps que le groupe démarre</td></tr>
<tr><td>Groupe électrogène</td><td>Moteur diesel qui démarre en quelques secondes et tient des heures</td></tr></table>
<p>Un onduleur se dimensionne en <b>kVA</b> (puissance apparente) ; les serveurs consomment des <b>kW</b>. kW = kVA × facteur de puissance (environ 0,9).</p>
<p>En redondance <b>2N</b>, deux chaînes complètes (A et B) alimentent chaque baie. Chacune doit pouvoir porter seule toute la salle : on garde chaque onduleur sous 50 % de charge.</p>`,
    retenir: "EDF → TGBT → onduleurs → gaines → PDU. Les batteries tiennent des minutes, le groupe des heures. En 2N, chaque onduleur reste sous 50 %.",
    quiz: [
      { q: "Une coupure EDF dure une heure, les batteries tiennent 15 minutes, pas de groupe. Que se passe-t-il ?", o: ["La salle s'éteint au bout de 15 minutes", 'Rien', 'Les onduleurs rechargent', 'Les serveurs ralentissent seulement'], a: 0, e: "Les batteries ne servent qu'à faire la jonction avec le groupe électrogène." },
      { q: "Un onduleur de 100 kVA avec un facteur de puissance de 0,9 fournit…", o: ['90 kW', '100 kW', '111 kW', '9 kW'], a: 0, e: "kW = kVA × facteur de puissance." },
      { q: "Les deux onduleurs sont chargés à 70 %. L'onduleur A tombe. Que se passe-t-il ?", o: ["B doit porter 140 % : il disjoncte, toute la salle tombe", 'B prend tout sans problème', 'Les serveurs passent sur une seule PSU sans souci', 'Rien'], a: 0, e: "D'où la règle des 50 % par voie." }] },
  { id: 'recette', title: 'Recette : tester avant de livrer', vault: 'Méthode de dépannage réseau · Outils réseau', html: `
<p>La <b>recette</b> vérifie qu'un service fonctionne <b>avant</b> de le livrer au client. On teste de bas en haut, depuis l'endroit où se trouve l'utilisateur.</p>
<table><tr><th>Test</th><th>Commande</th><th>Ce qu'il prouve</th></tr>
<tr><td>Passerelle</td><td><code>ping -c 3 172.16.10.1</code></td><td>Câble, VLAN, IP corrects</td></tr>
<tr><td>Port ouvert depuis Internet</td><td><code>nmap -Pn -p 443 203.0.113.10</code></td><td>Routage, NAT et règle du pare-feu</td></tr>
<tr><td>Application</td><td><code>curl -sI https://www.client.fr</code></td><td>Service démarré, certificat valide</td></tr>
<tr><td>Dépendance</td><td><code>psql -h 10.20.0.10 -c "select 1"</code></td><td>Flux entre zones autorisé</td></tr></table>
<p>On ajoute une <b>recette qualité</b> : double alimentation, RAID, obturateurs, BPDU Guard, étiquetage. Elle ne bloque pas la livraison, mais elle évite les pannes de demain.</p>
<p>Le résultat est consigné dans un procès-verbal de recette, signé par le client.</p>`,
    retenir: "Tester de bas en haut, depuis la place de l'utilisateur : ping, port, application, dépendances. Puis la qualité : alimentation, RAID, obturateurs, étiquettes.",
    quiz: [
      { q: "nmap affiche 443/tcp filtered depuis Internet. Que soupçonner ?", o: ['Une règle de pare-feu manquante', 'Un disque plein', 'Un certificat expiré', 'Un VLAN natif'], a: 0, e: "filtered = aucune réponse : quelque chose bloque en chemin." },
      { q: "curl répond « certificate has expired ». Quelle couche ?", o: ['Application (7)', 'Physique (1)', 'Liaison (2)', 'Réseau (3)'], a: 0, e: "Le réseau fonctionne, c'est le service qui a un problème." },
      { q: "Pourquoi tester depuis Internet et pas depuis le switch ?", o: ["Pour passer par le même chemin que les vrais utilisateurs", 'Parce que le switch ne sait pas pinguer', 'Pour aller plus vite', 'Par habitude'], a: 0, e: "Un test qui ne traverse pas le pare-feu ne prouve rien sur les règles." }] },
  { id: 'ad', title: 'Active Directory et Kerberos', vault: 'Windows Server 2022 - Active Directory', html: `
<p><b>Active Directory</b> est l'annuaire de Windows Server : comptes, groupes, ordinateurs, stratégies (GPO). Il repose sur trois protocoles :</p>
<table><tr><th>Protocole</th><th>Port</th><th>Rôle</th></tr>
<tr><td>LDAP / LDAPS</td><td>TCP 389 / 636</td><td>Interroger l'annuaire</td></tr>
<tr><td>Kerberos</td><td>TCP et UDP 88</td><td>Authentifier par tickets</td></tr>
<tr><td>DNS</td><td>53</td><td>Trouver les contrôleurs de domaine (enregistrements SRV)</td></tr></table>
<p>Kerberos refuse l'authentification si l'horloge du client s'écarte de plus de <b>5 minutes</b> de celle du contrôleur : <b>NTP</b> est indispensable.</p>
<p>L'annuaire reste en zone SERVEURS : les utilisateurs distants l'atteignent à travers le VPN, jamais directement depuis Internet.</p>`,
    retenir: "AD = LDAP 389/636 + Kerberos 88 + DNS. Écart d'horloge maximal 5 minutes : NTP obligatoire. Jamais exposé directement à Internet.",
    quiz: [
      { q: "Quel port pour LDAP chiffré ?", o: ['636', '389', '88', '443'], a: 0, e: "LDAPS sur 636 ; 389 est le LDAP classique." },
      { q: "Les connexions échouent avec « clock skew too great ». Cause ?", o: ["L'horloge du client s'écarte de plus de 5 minutes", 'Le DNS', 'Le port 389 fermé', 'Le disque plein'], a: 0, e: "Kerberos protège ses tickets avec l'heure : NTP partout." },
      { q: "Les agences doivent joindre l'annuaire. Comment ?", o: ['Par le VPN, puis DMZ → SERVEURS sur les seuls ports utiles', "En ouvrant 389 depuis Internet", "En mettant l'AD en DMZ", 'Par FTP'], a: 0, e: "Un annuaire exposé à Internet est une cible de choix." }] },
  { id: 'k8s', title: 'Conteneurs et Kubernetes', vault: 'Kubernetes - Introduction · Docker - Cours', html: `
<p>Un <b>conteneur</b> embarque une application et ses dépendances, sans système complet : il démarre en une seconde. <b>Kubernetes</b> répartit les conteneurs sur un groupe de serveurs, les <b>nœuds</b>, et les relance si un nœud tombe.</p>
<table><tr><th>Élément</th><th>Rôle</th></tr>
<tr><td>Pod</td><td>Un ou plusieurs conteneurs qui vivent ensemble</td></tr>
<tr><td>Nœud</td><td>Machine qui exécute les pods (kubelet, containerd)</td></tr>
<tr><td>API</td><td>TCP 6443, pour <code>kubectl</code>, réservée à l'administration</td></tr>
<tr><td>Service NodePort</td><td>Publie une application sur un port de 30000 à 32767 de chaque nœud</td></tr></table>
<p>Pour survivre à la perte d'une baie, on répartit les nœuds sur <b>plusieurs baies</b>, et un répartiteur de charge en DMZ envoie le trafic vers les NodePorts.</p>`,
    retenir: "Conteneur = application + dépendances. Kubernetes répartit les pods sur des nœuds. API sur 6443 pour l'admin, NodePort de 30000 à 32767. Nœuds répartis sur plusieurs baies.",
    quiz: [
      { q: "Dans quelle plage se trouvent les ports NodePort ?", o: ['30000 à 32767', '1 à 1023', '8000 à 8080', '49152 à 65535'], a: 0, e: "C'est la plage par défaut de Kubernetes." },
      { q: "Qui doit pouvoir joindre l'API Kubernetes (6443) ?", o: ["Uniquement l'administration", 'Tout Internet', 'La DMZ', 'Le stockage'], a: 0, e: "L'API pilote tout le cluster : on la protège comme un accès administrateur." },
      { q: "Pourquoi trois nœuds dans trois baies ?", o: ["Pour qu'une baie en panne ne coupe pas le service", 'Pour aller plus vite', 'Pour économiser', 'Parce que Kubernetes l’impose'], a: 0, e: "Une baie partage une alimentation et un switch : c'est un domaine de panne." }] },
];
const FICHE = id => FICHES.find(f => f.id === id);

/* =========================================================
   Incidents
   ========================================================= */
const pick = a => a[Math.floor(Math.random() * a.length)];
const vmOk = v => v.st === 'running' && D.vm[v.id] && D.vm[v.id].st !== 'down';
const activeVMs = () => S.vms.filter(v => v.k && S.contracts.some(c => c.id === v.k && c.state === 'active') && vmOk(v));
function quiz2(cause, prev) { return { cause, prev }; }

const INCIDENTS = {
  psu: {
    title: "Bloc d'alimentation en panne", fiche: 'elec', detect: 'hw',
    pick() {
      const list = Object.values(S.devs).filter(d => CAT[d.type].psu && D.powered[d.id] && d.psus.every(p => p.ok) && kindOf(d) !== 'odf');
      const pref = list.filter(d => kindOf(d) === 'server' && S.vms.some(v => v.host === d.id));
      const d = pick(pref.length ? pref : list); if (!d) return null;
      const plugged = d.psus.map((p, i) => p.out ? i : -1).filter(i => i >= 0);
      return { d: d.id, i: plugged.length === 1 ? plugged[0] : Math.floor(Math.random() * d.psus.length) };
    },
    apply(x) { const d = dev(x.d); d.psus[x.i].ok = false; syslog(d, 1, kindOf(d) === 'server' ? `ipmi: PS${x.i + 1} Status: Power Supply Failure detected` : `%PLATFORM_ENV-1-PWR: Power supply ${x.i + 1} has failed or been turned off`); },
    fixed: x => !dev(x.d) || dev(x.d).psus[x.i].ok,
    alert: x => `${nameOf(dev(x.d))} : PSU${x.i + 1} en défaut`,
    cmd: x => kindOf(dev(x.d)) === 'server' ? 'ipmitool sdr type "Power Supply"' : 'show environment power',
    hints: x => ["Commence par la couche 1 : l'énergie. Regarde les voyants en face arrière.", `Sur ${nameOf(dev(x.d))}, la console affiche l'état des alimentations.`, `Remplace la PSU${x.i + 1} de ${nameOf(dev(x.d))} : face arrière, clique sur l'alimentation orange.`],
    quiz: () => quiz2(["Un bloc d'alimentation est tombé en panne", 'Un câble réseau est abîmé', 'Le VLAN est mal configuré', 'La RAM est saturée'],
      ["Deux PSU sur deux voies différentes (A et B), et une supervision qui alerte", 'Brancher les deux PSU sur le même PDU', 'Désactiver les alarmes du BMC', 'Ajouter un obturateur']),
  },
  disk: {
    title: 'Disque en panne', fiche: 'raid', detect: 'hw',
    pick() {
      const list = [];
      for (const d of Object.values(S.devs)) (d.disks || []).forEach((x, i) => { if (x && x.st === 'ok' && D.powered[d.id]) list.push({ d: d.id, bay: i, used: S.vms.some(v => v.sto === d.id) }); });
      const pref = list.filter(x => x.used);
      const r = pick(pref.length ? pref : list); return r ? { d: r.d, bay: r.bay } : null;
    },
    apply(x) { const d = dev(x.d); d.disks[x.bay].st = 'failed'; syslog(d, 3, `kernel: blk_update_request: I/O error, dev ${diskName(x.bay).slice(5)}, sector 2093056`); syslog(d, 2, `md/raid:md0: Disk failure on ${diskName(x.bay).slice(5)}1, disabling device.`); },
    fixed: x => { const d = dev(x.d); if (!d) return true; const k = d.disks[x.bay]; return k && k.st !== 'failed' && !S.vms.some(v => v.sto === d.id && v.st === 'lost'); },
    alert: x => `${nameOf(dev(x.d))} : RAID dégradé, disque ${diskName(x.bay)} en défaut`,
    cmd: () => 'cat /proc/mdstat',
    hints: x => ["Couche 1 : un disque. En face avant, un voyant orange trahit le disque en panne.", `Sur ${nameOf(dev(x.d))}, cat /proc/mdstat montre un « _ » à la place d'un « U ».`, `Remplace le disque de la baie ${x.bay} à chaud (face avant). Si la grappe est détruite, restaure les VM depuis la sauvegarde.`],
    quiz: () => quiz2(["Un disque de la grappe RAID a lâché", 'Le processeur surchauffe', 'Une règle de pare-feu manque', 'Le DNS ne répond plus'],
      ["Un RAID avec tolérance, un disque de rechange et la supervision des grappes", 'Passer en RAID 0 pour aller plus vite', 'Faire un snapshot de la VM', 'Ajouter de la RAM']),
  },
  feed: {
    title: "Perte d'une voie électrique", fiche: 'elec', detect: 'facility',
    pick() { return S.feeds.A && S.feeds.B ? { p: Math.random() < 0.5 ? 'A' : 'B' } : null; },
    apply(x) { S.feeds[x.p] = false; S.timers['feed' + x.p] = S.t + 90; logEvent(`Voie ${x.p} du bâtiment coupée : onduleur ${x.p} en défaut.`, 'bad'); },
    fixed: x => S.feeds[x.p] && S.racks.every(r => !r.trip.A && !r.trip.B),
    alert: x => `GTB : perte de la voie électrique ${x.p} (onduleur ${x.p} en défaut, retour estimé 90 min)`,
    cmd: () => 'show environment power',
    hints: x => [`La voie ${x.p} revient seule : l'électricien du site intervient.`, "Pendant ce temps, tout repose sur l'autre voie : vérifie que chaque équipement a une PSU sur A et une sur B.", "Surveille la charge des PDU restants : au-delà de 3 680 W, leur disjoncteur saute. Si c'est arrivé, réarme-les après avoir réduit la charge."],
    quiz: () => quiz2(["Une voie d'alimentation du bâtiment est tombée", 'Un disque est en panne', 'Le pare-feu a redémarré', 'Un câble Cat 6 est trop long'],
      ["Double alimentation A et B partout, et des PDU chargés à moins de 50 %", 'Tout brancher sur la voie A', 'Retirer les obturateurs', 'Passer les ports en trunk']),
  },
  breaker: {
    title: 'Disjoncteur de PDU déclenché', fiche: 'elec', detect: 'facility', natural: true,
    fixed: x => !S.racks[x.rack].trip[x.pdu],
    alert: x => `GTB : disjoncteur du PDU ${x.pdu} de la baie ${rackName(x.rack)} ouvert (surcharge)`,
    cmd: () => 'show environment power',
    hints: x => ["Un disjoncteur saute quand la charge dépasse sa capacité : 16 A × 230 V = 3 680 W.", "Réduis la charge de la baie (déplace des serveurs, ou répartis-les dans une autre baie).", `Puis réarme le PDU ${x.pdu} : face arrière, clique sur la barre du PDU.`],
    quiz: () => quiz2(["La charge du PDU a dépassé 16 A (3 680 W)", 'Un câble réseau est en court-circuit', 'La température est trop basse', 'Un VLAN boucle'],
      ["Garder chaque PDU sous 50 % pour qu'il puisse reprendre la charge de l'autre", 'Brancher plus de serveurs sur le même PDU', 'Supprimer les PSU redondantes', 'Couper la climatisation']),
  },
  crc: {
    title: 'Erreurs CRC sur un lien', fiche: 'dep', detect: 'svc',
    pick() {
      const paths = new Set(); for (const v of activeVMs()) D.vm[v.id].path.forEach(id => paths.add(id));
      const list = S.cables.filter(c => paths.has(c.id) && D.link[c.id].up && !c.dmg && c.type !== 'os2');
      const c = pick(list); return c ? { c: c.id } : null;
    },
    apply(x) { const c = S.cables.find(k => k.id === x.c); c.dmg = true; c.crcT = S.t; },
    fixed: x => { const c = S.cables.find(k => k.id === x.c); return !c || !c.dmg; },
    alert: x => { const c = S.cables.find(k => k.id === x.c); return c ? `Erreurs en hausse sur ${c.a.p} ↔ ${c.b.p}` : 'Erreurs réseau'; },
    cmd: x => { const c = S.cables.find(k => k.id === x.c); return c ? `show interfaces ${switchEnd(c).p}` : 'show interfaces status'; },
    target: x => { const c = S.cables.find(k => k.id === x.c); return c ? switchEnd(c).d : null; },
    hints: x => ["Des lenteurs sans coupure : regarde les compteurs d'erreurs des interfaces.", "show interfaces <port> : un compteur CRC qui augmente désigne un câble ou un connecteur abîmé.", "Remplace le câble : face arrière, clique sur le câble puis « Remplacer »."],
    quiz: () => quiz2(["Un câble ou un connecteur abîmé produit des trames corrompues (CRC)", 'Un duplex incohérent', 'Un VLAN manquant sur le trunk', 'Un certificat expiré'],
      ["Des câbles de qualité, un cheminement propre sans écrasement, et la supervision des erreurs", 'Forcer la vitesse à 100 Mbit/s', 'Désactiver le contrôle CRC', 'Passer en VLAN 1']),
  },
  sfp: {
    title: 'Module optique défaillant', fiche: 'fibre', detect: 'svc',
    pick() {
      const list = [];
      for (const c of S.cables) if (CABLES[c.type].ends === 'fiber' && D.link[c.id].up) for (const e of [c.a, c.b]) if (!portDef(dev(e.d), e.p).op) list.push(e);
      const e = pick(list); return e ? { d: e.d, p: e.p } : null;
    },
    apply(x) { const d = dev(x.d); d.modFail[x.p] = true; syslog(d, 3, `%SFF8472-3-THRESHOLD_VIOLATION: ${x.p}: Rx power low alarm; Operating value: -40.0 dBm, Threshold value: -14.0 dBm`); },
    fixed: x => !dev(x.d) || !dev(x.d).modFail[x.p],
    alert: x => `${nameOf(dev(x.d))} : lien ${x.p} tombé (Rx power low alarm)`,
    cmd: x => kindOf(dev(x.d)) === 'server' ? `ethtool -m ${x.p}` : 'show interfaces transceiver',
    hints: x => ["Le lien est tombé d'un coup : couche 1.", `Lis la puissance optique reçue : vers −40 dBm, il n'y a plus de lumière.`, `Remplace le module de ${x.p} sur ${nameOf(dev(x.d))} (face arrière, clique sur la cage).`],
    quiz: () => quiz2(["Un module optique ne reçoit ou n'émet plus de lumière", 'Le câble Cat 6 est trop long', 'Le VLAN natif est différent', 'La RAM est pleine'],
      ["Des liens doublés et des modules de rechange en stock", 'Regarder dans la fibre pour vérifier', 'Remplacer la fibre par du DAC de 20 m', 'Couper la supervision']),
  },
  duplex: {
    title: 'Duplex incohérent', fiche: 'dep', detect: 'svc',
    pick() {
      const list = S.cables.filter(c => D.link[c.id].up && portDef(dev(c.a.d), c.a.p).t === 'rj45').map(c => switchEnd(c)).filter(e => e && kindOf(dev(e.d)) === 'switch' && cfg(dev(e.d), e.p).duplex === 'auto');
      const e = pick(list); return e ? { d: e.d, p: e.p } : null;
    },
    apply(x) { const d = dev(x.d); Object.assign(cfg(d, x.p), { duplex: 'full', speed: '1000' }); syslog(d, 5, `%SYS-5-CONFIG_I: Configured from console by jdupont on vty0 (10.99.0.42)`); },
    fixed: x => { const d = dev(x.d); if (!d) return true; const c = portCable(x.d, x.p); return !c || !D.link[c.id].mismatch; },
    alert: x => `${nameOf(dev(x.d))} : late collisions en hausse sur ${x.p}`,
    cmd: x => `show interfaces ${x.p}`,
    target: x => x.d,
    hints: x => ["Quelque chose a changé récemment ? Les journaux du switch le disent (%SYS-5-CONFIG_I).", `show interfaces ${x.p} : des late collisions = duplex différent de chaque côté.`, `Remets ${x.p} en speed auto / duplex auto (Équipement → port → Vitesse et duplex).`],
    quiz: () => quiz2(["Le duplex a été forcé d'un côté et laissé en automatique de l'autre", 'Le câble est sectionné', 'Le module SFP est mort', 'La passerelle est fausse'],
      ["Laisser l'auto-négociation des deux côtés, et tracer chaque changement de configuration", 'Forcer le half duplex partout', 'Désactiver les journaux', 'Utiliser le VLAN 1']),
  },
  rogue: {
    title: 'Équipement non autorisé', fiche: 'l2sec', detect: 'svc',
    pick() {
      const list = [];
      for (const d of devsOfKind('switch')) for (const p of CAT[d.type].ports) if (p.t === 'rj45' && !portCable(d.id, p.id) && p.role !== 'mgmt') list.push({ d: d.id, p: p.id });
      return pick(list) || null;
    },
    apply(x) {
      const sw = dev(x.d), c = cfg(sw, x.p);
      if (!c.admin) { x.blocked = true; logEvent(`Un prestataire a branché un petit switch sur ${x.p} de ${sw.host} : le port était coupé, rien ne s'est passé.`, 'good'); S.xp += 20; return; }
      const r = addDevice('rogue', sw.rack, 0);
      r.host = 'inconnu'; x.r = r.id;
      plugPSU(r, 0, 'A', true);
      S.cables.push({ id: 'c' + (++S.seq.c), type: 'cat6', a: { d: r.id, p: 'p1' }, b: { d: sw.id, p: x.p }, len: 30, dmg: false });
      if (c.bpdu) {
        c.err = 'bpduguard';
        syslog(sw, 2, `%SPANTREE-2-BLOCK_BPDUGUARD: Received BPDU on port ${x.p} with BPDU Guard enabled. Disabling port.`);
        syslog(sw, 4, `%PM-4-ERR_DISABLE: bpduguard error detected on ${x.p}, putting ${x.p} in err-disable state`);
      } else {
        S.flags.stp = { sw: sw.id };
        for (let k = 0; k < 4; k++) syslog(sw, 5, `%SPANTREE-5-TOPOTRAP: Topology Change Trap for instance 0`);
        syslog(sw, 5, `%SPANTREE-5-ROOTCHANGE: Root Changed for vlan 1: New Root Port is ${x.p}. New Root Mac Address is 0011.2233.4455`);
      }
    },
    fixed: x => x.blocked || (!dev(x.r) && !cfg(dev(x.d) || { cfg: {} }, x.p).err),
    alert: x => `${nameOf(dev(x.d))} : ${S.flags.stp ? 'changements de topologie Spanning Tree en rafale' : `port ${x.p} passé en err-disabled`}`,
    cmd: () => 'show logging',
    target: x => x.d,
    hints: x => ["Qu'est-ce qui a changé ? Lis les journaux du switch.", `Un équipement inconnu est branché sur ${x.p} : il est posé dans la baie ${rackName(dev(x.d).rack)}, en face arrière.`, `Retire l'équipement inconnu, puis si le port est err-disabled : shutdown puis no shutdown. Active BPDU Guard sur les ports d'accès et coupe les ports inutilisés.`],
    quiz: () => quiz2(["Un switch non autorisé a été branché sur un port d'accès", 'Une voie électrique est tombée', 'Un disque est en panne', 'La DMZ est saturée'],
      ["BPDU Guard sur les ports d'accès et ports inutilisés coupés", 'Mettre tous les ports en trunk', 'Désactiver le Spanning Tree', 'Laisser les ports libres dans le VLAN 1']),
  },
  ddos: {
    title: 'Attaque par déni de service', fiche: 'attaques', detect: 'svc',
    pick() { return activeVMs().some(v => SVC[v.svc].pub) && !S.flags.ddos ? (Math.random() < 0.55 ? { kind: 'vol', mbps: 25000 } : { kind: 'syn', mbps: 3000 }) : null; },
    apply(x) { S.flags.ddos = { kind: x.kind, mbps: x.mbps }; S.timers.ddos = S.t + 150; const fw = devsOfKind('fw')[0]; if (fw) syslog(fw, 4, x.kind === 'syn' ? 'kernel: nf_conntrack: table full, dropping packet' : 'kernel: wan0: rx_missed_errors increasing'); },
    fixed: x => !S.flags.ddos || (x.kind === 'vol' ? S.fwopt.scrub : S.fwopt.syn),
    alert: x => x.kind === 'vol' ? "Lien Internet à 100 % : trafic entrant anormal" : "Pare-feu : table de sessions pleine (SYN_RECV)",
    cmd: x => x.kind === 'vol' ? 'show interfaces Te0/0/0' : 'conntrack -S',
    target: x => x.kind === 'vol' ? (D.inet.rtr || null) : (devsOfKind('fw')[0] || {}).id,
    hints: x => x.kind === 'vol'
      ? ["Les sites publics rament tous en même temps : regarde le lien Internet.", "Le routeur reçoit 25 Gbit/s sur un lien de 10 : c'est une attaque volumétrique, le tuyau est plein avant ton pare-feu.", "Pare-feu → Protection : demande le filtrage à l'opérateur (anti-DDoS en amont)."]
      : ["Les sites publics rament : regarde l'état du pare-feu.", "Des milliers de connexions SYN jamais terminées remplissent la table du pare-feu.", "Pare-feu → Protection : active la limitation des SYN."],
    quiz: x => x.kind === 'vol'
      ? quiz2(["Une attaque DDoS volumétrique sature le lien opérateur", 'Un disque est en panne', 'Le DNS est faux', 'Un câble est abîmé'], ["Un service anti-DDoS chez l'opérateur, en amont du lien", 'Une règle de plus sur le pare-feu', 'Un câble Cat 6A', 'Un RAID 10'])
      : quiz2(["Un SYN flood remplit la table de sessions du pare-feu", 'Une voie électrique est tombée', 'Le certificat a expiré', 'Le trunk refuse le VLAN 10'], ["Limiter les SYN et activer les SYN cookies", 'Ouvrir tous les ports', 'Augmenter le RAID', 'Mettre le site en VLAN 1']),
  },
  scan: {
    title: 'Balayage de ports', fiche: 'attaques', detect: 'fw',
    pick() { return devsOfKind('fw').length ? { ip: `45.155.205.${10 + Math.floor(Math.random() * 200)}` } : null; },
    apply(x) { const fw = devsOfKind('fw')[0]; for (const p of [22, 23, 445, 3389, 3306, 5432, 8080, 161]) syslog(fw, 4, `kernel: DROP IN=wan0 SRC=${x.ip} DST=203.0.113.10 PROTO=${p === 161 ? 'UDP' : 'TCP'} DPT=${p}`); },
    fixed: x => !!S.flags.readLog,
    alert: x => `IDS : balayage de ports depuis ${x.ip}`,
    cmd: () => 'show log',
    target: () => (devsOfKind('fw')[0] || {}).id,
    hints: x => ["Commence par lire : les journaux du pare-feu disent ce qui s'est passé.", `Ouvre la console de ${(devsOfKind('fw')[0] || {}).host} et lance « show log ».`, "Tout a été refusé (DROP) : la politique par défaut a fonctionné. Tu peux bloquer l'adresse si tu veux."],
    quiz: () => quiz2(["Un balayage de ports depuis Internet, entièrement refusé par la politique par défaut", 'Une panne de disque', 'Un DDoS volumétrique', 'Un conflit IP'],
      ["Tout refuser sauf le nécessaire, et lire régulièrement les journaux", 'Ouvrir les ports scannés', 'Désactiver les journaux', 'Exposer SSH pour voir']),
  },
  brute: {
    title: 'Force brute sur SSH', fiche: 'attaques', detect: 'svc',
    pick() {
      const ok = S.rules.some(r => (r.src === 'Internet' || r.src === 'any') && (r.port === 22 || r.port === 'any'));
      if (!ok) return null;
      const v = pick(activeVMs().filter(v => v.vlan === 10 && !v.f2b)); return v ? { vm: v.id, ip: `185.220.101.${10 + Math.floor(Math.random() * 200)}` } : null;
    },
    apply(x) { const v = S.vms.find(k => k.id === x.vm); v.brute = x.ip; S.timers['comp' + x.vm] = S.t + 240; },
    fixed: x => { const v = S.vms.find(k => k.id === x.vm); if (!v) return true; return v.f2b || S.fwopt.block.includes(x.ip) || !S.rules.some(r => (r.src === 'Internet' || r.src === 'any') && (r.port === 22 || r.port === 'any') && (r.dst === 'DMZ' || r.dst === 'any')); },
    alert: x => `Échecs d'authentification SSH en rafale sur ${(S.vms.find(k => k.id === x.vm) || {}).name}`,
    cmd: () => 'journalctl -u ssh -n 15',
    vmTarget: x => x.vm,
    hints: x => ["Lis le journal SSH de la VM visée.", `Des centaines de « Failed password » depuis ${x.ip} : quelqu'un essaie des mots de passe.`, "Active fail2ban sur la VM, bloque l'adresse sur le pare-feu, et n'ouvre SSH depuis Internet que si c'est le service vendu (SFTP)."],
    quiz: () => quiz2(["Une attaque par force brute sur SSH exposé à Internet", 'Un module optique HS', 'Un PDU en surcharge', 'Un VLAN natif différent'],
      ["SSH réservé au réseau d'administration, authentification par clé et fail2ban", 'Un mot de passe plus court', 'Ouvrir SSH à tout Internet', 'Désactiver les journaux']),
  },
  ransom: {
    title: 'Rançongiciel', fiche: 'bak', detect: 'svc',
    pick() { const v = pick(activeVMs().filter(v => ['db', 'web', 'sftp', 'mail'].includes(v.svc))); return v ? { vm: v.id } : null; },
    apply(x) { const v = S.vms.find(k => k.id === x.vm); v.st = 'encrypted'; v.encrypted = true; logEvent(`${v.name} : des fichiers .locked apparaissent partout.`, 'bad'); },
    fixed: x => { const v = S.vms.find(k => k.id === x.vm); return !v || v.st === 'running'; },
    alert: x => `${(S.vms.find(k => k.id === x.vm) || {}).name} : modification massive de fichiers (extension .locked)`,
    cmd: () => 'ls /srv/data',
    vmTarget: x => x.vm,
    hints: x => ["Le service est à terre et les fichiers ont changé d'extension : rançongiciel.", "Isole d'abord la VM (Équipement → la VM → Isoler) pour stopper la propagation. Ne paie pas.", "Restaure depuis la sauvegarde si elle existe. Sinon, il faut réinstaller et les données sont perdues."],
    quiz: () => quiz2(["Un rançongiciel a chiffré les fichiers de la VM", 'Un disque est plein', 'Un câble est abîmé', 'Le certificat a expiré'],
      ["Des sauvegardes 3-2-1 dont une hors ligne, testées, et le moindre privilège", 'Payer la rançon', 'Un RAID 1', 'Un snapshot sur le même stockage']),
  },
  crac: {
    title: 'Climatiseur en panne', fiche: 'froid', detect: 'facility',
    pick() { const c = pick(S.cool.cracs.filter(c => c.ok && !S.timers['crac' + c.slot])); return c ? { slot: c.slot } : null; },
    apply(x) { S.cool.cracs.find(c => c.slot === x.slot).ok = false; logEvent(`Le climatiseur CRAC-${x.slot + 1} est en défaut.`, 'bad'); },
    fixed: x => { const c = S.cool.cracs.find(k => k.slot === x.slot); return !c || c.ok; },
    alert: x => `GTB : CRAC-${x.slot + 1} en défaut (compresseur). Il reste ${S.cool.cracs.filter(c => c.ok).length * CRAC_KW} kW de froid en salle.`,
    cmd: () => 'ipmitool sdr type Temperature',
    hints: x => ["La salle chauffe : compare le froid restant à la chaleur des baies (onglet Salle, Refroidissement).", `Appelle le frigoriste : clique CRAC-${x.slot + 1} dans la salle, ou onglet Salle.`, "Pour ne plus le subir : un climatiseur de plus que nécessaire (N+1), des obturateurs et le confinement des allées froides."],
    quiz: () => quiz2(['Un climatiseur de la salle est tombé en panne', 'Le pare-feu est saturé', 'Un VLAN boucle', 'Le DNS ne répond plus'],
      ["Des climatiseurs en N+1, des obturateurs et une alerte sur la température d'entrée", 'Ouvrir la porte de la salle', 'Retirer les obturateurs', 'Monter la consigne à 35 °C']),
  },
  edf: {
    title: 'Coupure du secteur EDF', fiche: 'onduleur', detect: 'facility',
    pick() { return S.power.edf ? { dur: 50 + Math.floor(Math.random() * 30) } : null; },
    apply(x) { S.power.edf = false; S.timers.edf = S.t + x.dur; logEvent('Coupure du secteur EDF : les onduleurs passent sur batteries.', 'bad'); },
    fixed: () => S.power.edf,
    alert: () => `GTB : perte du secteur EDF. Onduleurs sur batteries (${Math.round(S.power.batt)} min d'autonomie), ${S.power.gen ? 'groupe électrogène en démarrage' : 'aucun groupe électrogène'}`,
    cmd: () => 'show environment power',
    hints: () => ["Rien à réparer chez toi : le secteur revient seul, dans environ une heure.", "Pendant ce temps, la salle vit sur les batteries des onduleurs : regarde leur autonomie dans l'onglet Salle.", "Si la coupure dure plus longtemps que les batteries, tout s'éteint. Un groupe électrogène démarre en quelques secondes et tient des heures."],
    quiz: () => quiz2(['Une coupure du réseau électrique public', 'Un PDU en surcharge', 'Un câble abîmé', 'Un climatiseur en panne'],
      ["Un groupe électrogène testé régulièrement, et des batteries qui tiennent jusqu'à son démarrage", 'Plus de serveurs', 'Un second opérateur', 'Débrancher la voie B']),
  },
  upsover: {
    title: 'Onduleur en surcharge', fiche: 'onduleur', detect: 'facility', natural: true,
    fixed: x => !S.power.ups[x.p].trip,
    alert: x => `GTB : onduleur ${x.p} en surcharge, sortie coupée`,
    cmd: () => 'show environment power',
    hints: x => ["Un onduleur coupe sa sortie quand on lui demande plus que sa puissance.", "Regarde la charge des deux voies dans l'onglet Salle : chaque onduleur doit pouvoir porter seul toute la salle.", `Réduis la charge ou ajoute un module onduleur, puis réarme l'onduleur ${x.p} (onglet Salle).`],
    quiz: () => quiz2(["La charge de la voie a dépassé la puissance de l'onduleur", 'Le secteur EDF est coupé', 'Une baie est mal confinée', 'Un VLAN est faux'],
      ["Garder chaque voie sous 50 % de son onduleur et ajouter des modules avant d'ajouter des serveurs", 'Tout brancher sur la voie A', 'Retirer les batteries', 'Couper la climatisation']),
  },
  cert: {
    title: 'Certificat TLS expiré', fiche: 'tls', detect: 'svc', natural: true,
    fixed: x => { const v = S.vms.find(k => k.id === x.vm); return !v || v.cert > S.t; },
    alert: x => `${(S.vms.find(k => k.id === x.vm) || {}).name} : le certificat TLS a expiré`,
    cmd: () => 'openssl s_client -connect localhost:443',
    vmTarget: x => x.vm,
    hints: x => ["Les clients voient « Votre connexion n'est pas privée » : couche 7.", "openssl s_client affiche la date notAfter du certificat.", "Renouvelle le certificat (Équipement → la VM → Renouveler) et active le renouvellement automatique ACME."],
    quiz: () => quiz2(['Le certificat TLS a dépassé sa date de fin de validité', 'Le lien est saturé', 'Le port 443 est fermé', 'Un disque est en panne'],
      ["Renouvellement automatique ACME et supervision de l'échéance", 'Désactiver HTTPS', 'Prendre un certificat de 30 ans', 'Mettre le site en VLAN 20']),
  },
  oom: {
    title: 'Mémoire épuisée', fiche: 'virtu', detect: 'svc',
    pick() { const v = pick(activeVMs().filter(v => !v.leak)); return v ? { vm: v.id } : null; },
    apply(x) { const v = S.vms.find(k => k.id === x.vm); v.leak = 0.01; },
    fixed: x => { const v = S.vms.find(k => k.id === x.vm); return !v || (v.st === 'running' && !v.leak); },
    alert: x => `${(S.vms.find(k => k.id === x.vm) || {}).name} : mémoire utilisée au-delà de 90 %`,
    cmd: () => 'free -h',
    vmTarget: x => x.vm,
    hints: x => ["Le service consomme de plus en plus de mémoire puis tombe.", "free -h et journalctl -k montrent l'OOM killer : le noyau tue le processus le plus gourmand.", "Redémarre la VM pour repartir, et donne-lui plus de RAM si l'hôte en a."],
    quiz: () => quiz2(['Une fuite mémoire a épuisé la RAM de la VM (OOM killer)', 'Un câble est abîmé', 'Le RAID est dégradé', 'Le pare-feu bloque'],
      ['Surveiller la mémoire, dimensionner la RAM et ne pas la surallouer', 'Surallouer la RAM', 'Désactiver le swap et les alertes', 'Mettre la VM en DMZ']),
  },
  full: {
    title: 'Disque de VM plein', fiche: 'sup', detect: 'svc',
    pick() { const v = pick(activeVMs().filter(v => !v.filling)); return v ? { vm: v.id } : null; },
    apply(x) { const v = S.vms.find(k => k.id === x.vm); v.filling = true; v.fill = Math.max(v.fill, 0.7); },
    fixed: x => { const v = S.vms.find(k => k.id === x.vm); return !v || (!v.filling && v.fill < 0.9); },
    alert: x => `${(S.vms.find(k => k.id === x.vm) || {}).name} : /var à plus de 90 %`,
    cmd: () => 'df -h',
    vmTarget: x => x.vm,
    hints: x => ["Le service ne peut plus écrire : regarde l'espace disque.", "df -h montre /var plein, du -sh /var/log/* désigne des journaux énormes.", "Purge les journaux et active la rotation (Équipement → la VM → Purger les journaux)."],
    quiz: () => quiz2(['Les journaux ont rempli le disque de la VM', 'Le certificat a expiré', 'Un SFP est mort', 'Le VLAN est faux'],
      ['Rotation des journaux (logrotate) et alerte à 80 %', 'Supprimer la VM', 'Désactiver les journaux', 'Passer en RAID 0']),
  },
  ipdup: {
    title: "Conflit d'adresse IP", fiche: 'ip', detect: 'svc',
    pick() {
      const v = pick(activeVMs().filter(v => VLANS[v.vlan].gw)); const hosts = devsOfKind('server');
      return v && hosts.length ? { vm: v.id, ip: v.ip, host: pick(hosts).id } : null;
    },
    apply(x) {
      const v = S.vms.find(k => k.id === x.vm);
      const t = { id: 'vt' + (++S.seq.v), vmid: 900 + S.seq.v, name: 'test-jdupont', svc: 'web', k: null, host: x.host, vlan: v.vlan, ip: x.ip, vcpu: 1, ram: 1, disk: 10, sto: x.host, st: 'running', cert: S.t + 99999, fill: 0.2, leak: 0, rogue: true };
      S.vms.push(t); x.t = t.id; S.flags.ipdup = { ip: x.ip };
    },
    fixed: x => !S.vms.some(k => k.id === x.t),
    alert: x => `Conflit d'adresse détecté sur ${x.ip} (deux adresses MAC répondent)`,
    cmd: x => `arping -I vmbr0 ${x.ip}`,
    target: x => x.host,
    hints: x => ["Le service répond une fois sur deux : deux machines ont peut-être la même IP.", `arping ${x.ip} montre deux adresses MAC différentes.`, `Cherche une VM de test sur tes hôtes (qm list) : « test-jdupont » utilise ${x.ip}. Supprime-la.`],
    quiz: () => quiz2(['Deux machines utilisent la même adresse IP', 'Le câble est trop long', 'Le PDU est en surcharge', 'Le DNS est faux'],
      ["Un plan d'adressage à jour et une IPAM, aucune IP posée sans la noter", 'Utiliser le DHCP en DMZ sans réservation', 'Tout mettre en /16', 'Désactiver ARP']),
  },
  op: {
    title: 'Coupure opérateur', fiche: 'archi', detect: 'facility',
    pick() { return !S.flags.op1down ? { n: 1 } : null; },
    apply(x) { S.flags['op' + x.n + 'down'] = true; S.timers['op' + x.n] = S.t + 150; logEvent(`Opérateur ${x.n} : fibre coupée par des travaux de voirie.`, 'bad'); },
    fixed: x => !S.flags['op' + x.n + 'down'],
    alert: x => `Opérateur ${x.n} : incident sur la fibre, rétablissement estimé 2 h 30`,
    cmd: () => 'show bgp summary',
    target: () => D.inet.rtr || (devsOfKind('router')[0] || {}).id,
    hints: x => ["Le lien opérateur est tombé : tu ne peux rien réparer côté opérateur.", "show bgp summary montre la session BGP avec l'opérateur 1 tombée.", "Avec un second opérateur câblé sur OP2, BGP bascule seul. Sinon, il faut attendre."],
    quiz: () => quiz2(["La fibre de l'opérateur a été coupée", 'Le routeur est mal configuré', 'Un disque est en panne', 'Le pare-feu bloque le port 443'],
      ['Deux opérateurs et BGP pour une bascule automatique', 'Un câble plus long', 'Un VLAN de plus', 'Un RAID 6']),
  },
  hot: {
    title: 'Point chaud dans une baie', fiche: 'froid', detect: 'hw', natural: true,
    fixed: x => (D.temp[x.rack] || 0) < 27,
    alert: x => `Baie ${rackName(x.rack)} : température d'entrée au-dessus de 27 °C`,
    cmd: () => 'ipmitool sdr type Temperature',
    hints: x => [`La baie ${rackName(x.rack)} chauffe : regarde sa température d'entrée.`, "Compte les unités vides sans obturateur, et la puissance de la baie.", "Pose des obturateurs, répartis la charge sur une autre baie, ou améliore le froid (confinement, clim en rangée)."],
    quiz: () => quiz2(["L'air chaud recircule ou la baie dépasse la capacité de froid", 'Un câble est abîmé', 'Un VLAN manque', 'Le DNS est faux'],
      ['Obturateurs, confinement et répartition de la charge entre les baies', 'Retirer les obturateurs', 'Mettre les serveurs en face arrière', 'Couper la supervision']),
  },
};
const TEACH = { c1: ['psu'], c2: ['disk', 'scan'], c3: ['crc', 'duplex'], c4: ['rogue', 'feed'], c5: ['ddos', 'oom', 'crac'], c6: ['ransom', 'full', 'edf'], c7: ['brute', 'sfp'], c8: ['op', 'ipdup'] };
function switchEnd(c) { for (const e of [c.a, c.b]) if (kindOf(dev(e.d)) === 'switch') return e; return c.a; }

/* ---------- Tickets ---------- */
function openTickets() { return S.tickets.filter(t => !t.closed); }
function raiseIncident(type, ctx, already) {
  const key = type + JSON.stringify(ctx);
  if (S.tickets.some(t => !t.closed && t.key === key)) return null;
  const def = INCIDENTS[type];
  if (!already && def.apply) def.apply(ctx);
  if (ctx.blocked) return null;
  const t = { id: ++S.seq.t, type, ctx, key, t0: S.t, det: null, by: null, fixedAt: null, closed: false, hints: 0 };
  S.tickets.push(t);
  touch();
  return t;
}
function monitoredDevice(d) {
  if (!D.monitoring || !d) return false;
  const p = CAT[d.type].ports.find(x => x.role === 'bmc' || x.role === 'mgmt');
  if (!p) return true;
  const c = portCable(d.id, p.id);
  if (!c || !D.link[c.id].up) return false;
  const sw = otherEnd(c, d.id, p.id);
  return carries(sw, 99);
}
function impactsClients() { return S.contracts.some(c => c.state === 'active' && D.ct[c.id] && D.ct[c.id].st !== 'ok'); }
function ticketImpacts(t) {
  const x = t.ctx, bad = v => v.k && D.vm[v.id] && D.vm[v.id].st !== 'ok';
  if (x.vm) { const v = S.vms.find(k => k.id === x.vm); return !!(v && bad(v)); }
  if (x.c) return S.vms.some(v => bad(v) && D.vm[v.id].path.includes(x.c));
  if (x.d) {
    const d = dev(x.d); if (!d) return false;
    if (['switch', 'router', 'fw'].includes(kindOf(d))) return impactsClients() && (!D.powered[d.id] || S.vms.some(v => bad(v) && D.vm[v.id].path.some(id => { const c = S.cables.find(k => k.id === id); return c && (c.a.d === d.id || c.b.d === d.id); })));
    return S.vms.some(v => (v.host === d.id || v.sto === d.id) && bad(v));
  }
  return impactsClients();
}
function detectTicket(t, by) {
  t.det = S.t; t.by = by;
  const def = INCIDENTS[t.type];
  logEvent(`Ticket n° ${t.id} ouvert (${by}) : ${def.title}.`, 'bad');
  if (typeof onTicket === 'function') onTicket(t);
}
function incidentTick(dt) {
  // incidents naturels
  for (const v of S.vms) if (SVC[v.svc].cert && v.st === 'running' && v.cert < S.t && v.k) raiseIncident('cert', { vm: v.id }, true);
  S.racks.forEach((_, i) => { if ((D.temp[i] || 0) > 30) raiseIncident('hot', { rack: i }, true); });
  for (const t of S.tickets) {
    if (t.closed) continue;
    const def = INCIDENTS[t.type];
    if (!t.det) {
      if (def.detect === 'facility') detectTicket(t, 'GTB');
      else if (def.detect === 'fw') detectTicket(t, 'pare-feu');
      else if (D.monitoring && (def.detect === 'svc' || monitoredDevice(dev(t.ctx.d)))) detectTicket(t, 'Zabbix');
      else if (ticketImpacts(t)) { t.imp = (t.imp || 0) + dt; if (t.imp >= 20) detectTicket(t, 'client'); }
    }
    if (!t.fixedAt && def.fixed(t.ctx)) {
      t.fixedAt = S.t;
      if (!t.det) detectTicket(t, 'toi');
      logEvent(`Ticket n° ${t.id} : le problème est corrigé. Rédige le rapport.`, 'good');
      if (typeof onTicketFixed === 'function') onTicketFixed(t);
    }
  }
  // nouvel incident
  if (S.t >= S.nextInc && openTickets().length < 2 && S.contracts.some(c => c.state === 'active')) {
    let type = null, ctx = null;
    while (S.teach.length && !ctx) { type = S.teach.shift(); ctx = INCIDENTS[type].pick(); }
    if (!ctx) {
      const pool = ['psu', 'disk', 'crc', 'sfp', 'duplex', 'rogue', 'ddos', 'scan', 'brute', 'oom', 'full', 'ipdup', 'feed', 'crac', 'op', 'ransom', 'edf'];
      for (let k = 0; k < 8 && !ctx; k++) { type = pick(pool); ctx = INCIDENTS[type].pick(); }
    }
    if (ctx) raiseIncident(type, ctx);
    S.nextInc = S.t + 240 + Math.random() * 300;
  }
}
function onTimer(k) {
  if (k === 'feedA' || k === 'feedB') { S.feeds[k.slice(4)] = true; logEvent(`Voie ${k.slice(4)} rétablie.`, 'good'); }
  else if (k.startsWith('crac')) { const c = S.cool.cracs.find(x => x.slot === +k.slice(4)); if (c) c.ok = true; logEvent(`Climatiseur CRAC-${+k.slice(4) + 1} réparé.`, 'good'); }
  else if (k === 'edf') { S.power.edf = true; logEvent('Le secteur EDF est revenu.', 'good'); }
  else if (k === 'op1' || k === 'op2') { delete S.flags[k + 'down']; logEvent(`Opérateur ${k.slice(2)} rétabli.`, 'good'); }
  else if (k === 'ddos') { delete S.flags.ddos; S.fwopt.scrub = false; logEvent("L'attaque s'est arrêtée.", 'info'); }
  else if (k.startsWith('comp')) {
    const id = k.slice(4), v = S.vms.find(x => x.id === id);
    const t = S.tickets.find(x => x.type === 'brute' && x.ctx.vm === id);
    if (v && t && !t.fixedAt) { logEvent(`${v.name} a été compromise après la force brute SSH.`, 'bad'); raiseIncident('ransom', { vm: id }); }
  }
}
function onContractActive(cs) {
  const list = TEACH[cs.id];
  if (list) { S.teach.push(...list); S.nextInc = Math.min(S.nextInc, S.t + 90); }
}
function learnHook(ev, a) {
  const map = { place: d => ({ switch: 'switch', server: 'virtu', nas: 'raid', blank: 'froid', fw: 'pf' }[kindOf(d)]), cable: c => CABLES[c.type].ends === 'fiber' || c.type === 'dac' ? 'fibre' : 'cuivre', rule: () => 'pf', deploy: v => ({ ad: 'ad', k8s: 'k8s' }[v.svc] || 'ip'), portcfg: () => 'switch', rack: () => 'salle', inrow: () => 'froid', crac: () => 'froid' };
  const id = map[ev] && map[ev](a);
  if (id && !S.codex.seen[id]) { S.codex.seen[id] = true; if (typeof onFiche === 'function') onFiche(FICHE(id)); }
}

/* ---------- Recette d'un contrat ---------- */
function recetteTests(cs) {
  const def = contractDef(cs.id), vms = S.vms.filter(v => v.k === cs.id), T = [];
  const pubIp = '203.0.113.10';
  const dom = def.client.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.fr';
  const st = v => D.vm[v.id] || { st: 'down', R: [{ lvl: 1, sev: 'down', msg: 'VM introuvable' }] };
  const first = v => { const r = st(v).R.filter(x => x.sev !== 'info').sort((a, b) => a.lvl - b.lvl)[0]; return r ? r.msg : ''; };
  for (const v of vms) {
    const s = SVC[v.svc], r = st(v), gw = VLANS[v.vlan].gw;
    const net = !r.R.some(x => x.sev === 'down' && x.lvl <= 3);
    if (gw) T.push({ who: v.name, cmd: `ping -c 3 ${gw}`, ok: net, out: net ? '3 packets transmitted, 3 received, 0% packet loss' : `100% packet loss. ${first(v)}` });
    const ok = r.st !== 'down';
    if (s.pub) for (const [proto, port] of s.ports) T.push({ who: 'sonde Internet', cmd: `nmap -Pn ${proto === 'udp' ? '-sU ' : ''}-p ${port} ${pubIp}`, ok, out: ok ? `${port}/${proto} open` : `${port}/${proto} filtered. ${first(v)}` });
    const app = {
      web: [`curl -sI https://www.${dom}`, 'HTTP/2 200'], lb: [`curl -sI https://www.${dom}`, 'HTTP/2 200 (via HAProxy)'],
      db: [`psql -h ${v.ip} -U app -c "select 1"`, '?column? = 1 (1 ligne)'], dns: [`dig @${pubIp} ${dom} SOA +short`, `ns1.${dom}. hostmaster.${dom}. 2026110601`],
      mail: [`openssl s_client -starttls smtp -connect mail.${dom}:587`, '250 STARTTLS, certificat vérifié'], vpn: ['wg show wg0 latest-handshakes', 'dernier échange il y a 12 secondes'],
      sftp: [`sftp -P 22 client@${pubIp}`, `Connected to ${pubIp}.`], mon: [`zabbix_get -s ${v.ip} -k agent.ping`, '1'],
      bak: ["echo 'status storage' | bconsole", 'Device "FileStorage" is mounted'], ad: [`ldapsearch -H ldap://${v.ip} -x -s base namingContexts`, 'namingContexts: DC=agences,DC=local'],
      k8s: ['kubectl get nodes', `${v.name}   Ready   worker   v1.31`],
    }[v.svc];
    if (app) T.push({ who: ['db', 'ad', 'k8s'].includes(v.svc) ? 'depuis la DMZ' : v.name, cmd: app[0], ok, out: ok ? app[1] : first(v) || 'échec' });
  }
  const R = D.ct[cs.id] ? D.ct[cs.id].R.filter(x => !x.msg.includes(' · couche ') && x.sev !== 'info') : [];
  for (const x of R) T.push({ who: 'exigences du contrat', cmd: '# vérification', ok: false, out: x.msg });
  const hosts = [...new Set(vms.map(v => v.host))].map(dev).filter(Boolean);
  const swEnds = d => CAT[d.type].ports.filter(p => p.role !== 'bmc').map(p => portCable(d.id, p.id)).filter(Boolean).map(c => otherEnd(c, d.id, c.a.d === d.id ? c.a.p : c.b.p)).filter(o => kindOf(dev(o.d)) === 'switch');
  const racks = [...new Set(hosts.map(d => d.rack))];
  const Q = [
    { label: 'Chaque hôte a une alimentation sur la voie A et une sur la voie B', ok: hosts.length > 0 && hosts.every(d => d.psus.length === 2 && d.psus.every(p => p.out) && d.psus[0].out.pdu !== d.psus[1].out.pdu) },
    { label: 'Les unités vides des baies utilisées sont obturées', ok: racks.length > 0 && racks.every(r => { const m = slotMap(r); for (let u = 1; u <= RACK_U; u++) if (!m[u]) return false; return true; }) },
    { label: 'Les données sont sur un RAID tolérant aux pannes', ok: vms.length > 0 && vms.every(v => { const s = dev(v.sto); return s && s.raid !== 'none' && s.raid !== '0'; }) },
    { label: 'Les ports de switch vers les serveurs ont BPDU Guard', ok: hosts.length > 0 && hosts.every(d => swEnds(d).every(o => cfg(dev(o.d), o.p).bpdu)) },
    { label: 'Les ports de switch utilisés ont une description', ok: hosts.length > 0 && hosts.every(d => swEnds(d).every(o => !!cfg(dev(o.d), o.p).desc)) },
  ];
  return { T, Q, pass: T.length > 0 && T.every(t => t.ok) };
}
