# Hyperscale — simulateur pédagogique de datacenter

Jeu de gestion d'une salle de datacenter pour réviser le **BTS SIO option SISR** : on part d'une salle vide avec 10 000 €, on construit des baies, on câble, on configure, on teste, puis on livre des contrats de plus en plus complexes. Chaque contrat introduit une notion de cours, des bases vues en première année jusqu'aux ACL.

## Jouer

- **En ligne** : https://t0myto.github.io/hyperscale/
- **En local** : ouvre `index.html` dans un navigateur. Le dossier `dc/` doit rester à côté.

La partie est sauvegardée dans le navigateur (`localStorage`).

## Progression

17 contrats en 4 chapitres. Une **mission** se valide dès que ses objectifs sont atteints ; un **contrat client** se livre par une recette (tests d'acceptation).

| Chapitre | Contrats | Notions |
|---|---|---|
| 1 · Les bases | Ta première baie, Le réseau local, Cabinet Marchand | baie, alimentation A/B, câble cuivre, switch et VLAN, virtualisation, adressage IP, RAID |
| 2 · Ouvrir sur Internet | Raccorder la salle, Le Fournil, Mairie de Saint-Aubin, Immo Laurent | fibre et modules, pare-feu et DMZ, trunk 802.1Q, ports TCP/UDP, TLS, routage entre VLAN |
| 3 · Exploiter la salle | Supervision, Sauvegardes 3-2-1, Sécuriser les ports du switch, Nordik Shop | SNMP et Syslog, sauvegardes, BPDU Guard et VLAN natif, haute disponibilité, refroidissement |
| 4 · Notions avancées | Studio Pixel, Protéger l'accès au routeur, Filtrer en bordure, Agences Plus, Campus Numérique, Hébergeur régional | attaques, ACL standard et lignes VTY, ACL étendue, Active Directory, Kubernetes, double opérateur |

- **Guide pas à pas** : chaque étape a un bouton « Montrer » qui amène au bon endroit, et un lien « Pourquoi ? » vers la fiche de cours.
- **Avant et après chaque contrat** : les notions à apprendre, puis ce qu'il faut retenir et le quiz.
- **Pannes progressives** : après chaque contrat arrive une panne liée à ce qui vient d'être installé ; seules reviennent au hasard les pannes déjà rencontrées.

## Contenu

- **Salle** de 6 rangées (A à F) avec allées, salle opérateurs (MMR), énergie (EDF, TGBT, onduleurs A/B, batteries, groupe électrogène) et froid (CRAC, in-row, confinement).
- **Baie** en vue avant et arrière : routeur, pare-feu, switchs d'accès, leaf et spine, serveurs, baies de stockage, câbles cuivre, fibre et DAC.
- **Fenêtre de chaque équipement** (double-clic), avec quatre onglets :
  - **Physique** : alimentations, ports, câbles et disques ;
  - **Config** : ports et VLAN, RAID et VM, matrice de flux du pare-feu, ACL et lignes VTY du routeur, avec un testeur de paquets ;
  - **CLI** : vraies commandes Cisco IOS (`conf t`, `interface range`, `switchport`, `access-list`, `ip access-group`, `line vty`…) ;
  - **Aide** : mode d'emploi et fiches liées.
- **Console** avec des sorties réalistes (Cisco IOS, Linux, Proxmox, nftables) et la commande équivalente de chaque action.
- **Incidents** (pannes matérielles, coupures, attaques) détectés par la supervision, le client ou l'IDS, avec une méthode de dépannage par couches OSI.
- **24 fiches de cours** avec quiz, dans l'ordre du parcours.
- Pas de factures : seuls les contrats en service rapportent de l'argent.

## Structure

| Fichier | Rôle |
|---|---|
| `hyperscale.html` | Corps de la page : mise en forme et interface (source) |
| `index.html` | Page complète générée par `tools/build.js` |
| `dc/data.js` | Catalogue, prix, salle, chapitres et contrats |
| `dc/sim.js` | État du jeu, énergie, froid, réseau, ACL, contrats, argent |
| `dc/actions.js` | Actions du joueur (acheter, placer, câbler, configurer) |
| `dc/learn.js` | Fiches, incidents, tickets, recette |
| `dc/console.js` | Console, sorties des commandes, mode configuration Cisco IOS |
| `dc/view.js` | Vue SVG d'une baie |
| `dc/room.js` | Vue de la salle, déplacement dans les allées |
| `dc/ui.js` | Panneaux, guide des contrats, fenêtres à onglets |

## Outils

```bash
node tools/build.js
```
Régénère `index.html` après une modification de `hyperscale.html`.

```bash
node tools/gen-vault.js . "<chemin du vault Obsidian>"
node tools/checklinks.js "<chemin du vault Obsidian>"
```
Génèrent les notes Obsidian (parcours, fiches, incidents, références, aide-mémoire, progression) à partir des données du jeu, puis vérifient les liens. Les cases déjà cochées sont conservées et les notes devenues obsolètes sont retirées.
