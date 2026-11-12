# Hyperscale — simulateur pédagogique de datacenter

Jeu de gestion d'une salle de datacenter pour réviser le **BTS SIO option SISR** : on part d'une salle vide avec 10 000 €, on construit des baies, on câble, on configure, on teste, puis on livre des contrats de plus en plus complexes. Chaque contrat introduit une notion de cours, des bases vues en première année jusqu'aux ACL.

## Jouer

- **En ligne** : https://t0myto.github.io/hyperscale/
- **En local** : ouvre `index.html` dans un navigateur. Le dossier `dc/` doit rester à côté.

La partie est sauvegardée toute seule dans le navigateur (`localStorage`). Le bouton **Sauvegarde** permet de l'enregistrer à la main (Ctrl+S), de la télécharger dans un fichier, de recharger un fichier et de recommencer une partie.

## Progression

26 exercices et contrats en 4 chapitres. Les notions arrivent **par facilité, puis par priorité** : d'abord le plus facile, et à difficulté égale le plus important pour le BTS SIO SISR. L'urbanisation de la salle est la première notion. Une **mission** se valide dès que ses objectifs sont atteints ; un **contrat client** se livre par une recette (tests d'acceptation).

| Chapitre | Contrats | Notions, dans l'ordre |
|---|---|---|
| 1 · Les bases (facile) | Ta première baie, Le réseau local, Cabinet Marchand, Énergie secourue et froid | salle, baie, alimentation A/B, câble cuivre, switch et VLAN, adressage IP, virtualisation, RAID, onduleurs, refroidissement |
| 2 · Ouvrir sur Internet | Raccorder la salle, Le Fournil, Mairie de Saint-Aubin, Immo Laurent | fibre, ports TCP/UDP, pare-feu et DMZ, méthode de dépannage, certificats TLS |
| 3 · Exploiter et protéger (intermédiaire) | Sauvegardes 3-2-1, Supervision, Sécuriser les ports du switch, Studio Pixel | sauvegardes, supervision, sécurité de niveau 2, attaques |
| 4 · Notions avancées (difficile) | Protéger l'accès au routeur, Filtrer en bordure, Agences Plus, Nordik Shop, Campus Numérique, Hébergeur régional | ACL standard puis étendue, Active Directory, redondance et spine-leaf, Kubernetes |

- **Guide pas à pas** : chaque étape a un bouton « Montrer » qui amène au bon endroit, et un lien « Pourquoi ? » vers la fiche de cours.
- **Avant et après chaque contrat** : les notions à apprendre, puis ce qu'il faut retenir, avec un lien vers chaque fiche.
- **Pannes progressives** : après chaque contrat arrive une panne liée à ce qui vient d'être installé ; seules reviennent au hasard les pannes déjà rencontrées.

## Contenu

- **Salle** de 6 rangées (A à F) avec allées, salle opérateurs (MMR), énergie (EDF, TGBT, onduleurs A/B, batteries, groupe électrogène) et froid (CRAC, in-row, confinement).
- **Baie** en vue avant et arrière : routeur, pare-feu, switchs d'accès, leaf et spine, serveurs, baies de stockage, câbles cuivre, fibre et DAC.
- **PC portable** (bouton Portable) : c'est le seul endroit où l'on configure. PuTTY ouvre une session en **console** (câble branché sur l'appareil) ou en **SSH** (adresse IP, compte, mot de passe). S'y ajoutent une invite de commandes (`ping`, `ipconfig`, `tracert`), la carte réseau du portable et un navigateur.
- **Tout se tape, rien ne se clique** : Cisco IOS sur les switchs et le routeur (modes `>`, `#`, `(config)#`, aide `?`, abréviations, `write memory` sinon la configuration est perdue au redémarrage), vraies commandes Linux sur le pare-feu (`nft`, `ip link`), les serveurs et le stockage (`mdadm`, `qm`, `ip addr`).
- **Parcours guidé** : chaque exercice débloque la suite (portable, invite de commandes, SSH, navigateur). Ce qui n'est pas encore débloqué reste visible, grisé, avec le nom de l'exercice qui l'ouvre.
- **Fenêtre de chaque équipement** (double-clic), pour le matériel seulement (les lignes ci-dessous décrivent l'ancienne version à quatre onglets ; il reste Physique, État en lecture seule, et Aide) :
  - **Physique** : alimentations, ports, câbles et disques ;
  - **Config** : ports et VLAN, RAID et VM, matrice de flux du pare-feu, ACL et lignes VTY du routeur, avec un testeur de paquets ;
  - **CLI** : vraies commandes Cisco IOS (`conf t`, `interface range`, `switchport`, `access-list`, `ip access-group`, `line vty`…) ;
  - **Aide** : mode d'emploi et fiches liées.
- **Modules de cage**, comme dans Packet Tracer : dans l'onglet Physique, on choisit un module (SX, LX, SR, LR ou cuivre T) et on l'insère dans une cage SFP+ ou QSFP+. Une fibre demande le même module aux deux bouts, adapté à la fibre ; un DAC n'en a pas besoin.
- **Console** avec des sorties réalistes (Cisco IOS, Linux, Proxmox, nftables) et la commande équivalente de chaque action.
- **Incidents** (pannes matérielles, coupures, attaques) détectés par la supervision, le client ou l'IDS, avec une méthode de dépannage par couches OSI.
- **24 fiches de cours**, classées par facilité puis par priorité (pastille de niveau et étoiles sur chaque fiche) : le résumé du jeu, puis la note de cours complète du vault cours-sisr-main (tableaux, encadrés, schémas Mermaid, images). Les 4 sujets propres au datacenter (baie, froid, salle, onduleurs) n'ont pas de note de cours : la fiche du jeu en tient lieu.
- Pas de factures : seuls les contrats en service rapportent de l'argent.
- **Sons d'interface** discrets (réussite, refus, alerte, contrat livré), fabriqués par le navigateur. Le bouton haut-parleur ou la touche M les coupe.
- **Souris, clavier et tactile** : glisser et molette, flèches et touches + − 0, un doigt pour déplacer et deux doigts pour zoomer.
- **Hors ligne** : en ligne, le jeu garde une copie de lui-même (service worker) et se relance sans connexion. Il peut aussi s'installer comme une application depuis le navigateur.

## Structure

| Fichier | Rôle |
|---|---|
| `hyperscale.html` | Corps de la page : mise en forme et interface (source) |
| `index.html` | Page complète générée par `tools/build.js` |
| `dc/data.js` | Catalogue, prix, salle, chapitres et contrats |
| `dc/sim.js` | État du jeu, énergie, froid, réseau, ACL, contrats, argent |
| `dc/actions.js` | Actions du joueur (acheter, placer, câbler, configurer) |
| `dc/learn.js` | Fiches, incidents, tickets, recette |
| `dc/cours.js` | Notes de cours embarquées (généré par `tools/gen-cours.js`) |
| `dc/md.js` | Affichage des notes de cours (Markdown Obsidian, schémas Mermaid) |
| `cours/img/` | Images des notes de cours |
| `dc/console.js` | Console, sorties des commandes, mode configuration Cisco IOS |
| `dc/view.js` | Vue SVG d'une baie |
| `dc/room.js` | Vue de la salle (sol, allées, rangées, énergie, froid) |
| `dc/ui.js` | Panneaux, guide des contrats, fenêtres à onglets, sauvegarde, boucle de jeu |
| `dc/audio.js` | Sons d'interface (Web Audio, aucun fichier son) |
| `dc/os.js` | Systèmes des appareils : modes IOS, comptes, SSH, configuration de démarrage, commandes Linux, réseau du portable |
| `dc/laptop.js` | Fenêtre du PC portable, panneaux en lecture seule |
| `sw.js` | Service worker : copie hors ligne du jeu, le réseau d'abord |
| `manifest.webmanifest`, `icon.svg`, `icon-*.png` | Fiche et icônes de l'application installable |

## Outils

```bash
node tools/build.js
```
Régénère `index.html` après une modification de `hyperscale.html`.

```bash
node tools/test.js
```
Lance les tests automatiques des règles du jeu (données, modules et câbles, réseau, trois jours de simulation, sauvegarde), sans navigateur. À relancer après chaque modification de `dc/`.

```bash
node tools/test-cli.js
```
Joue le parcours au clavier, comme un joueur : console, SSH, VLAN, RAID, machines virtuelles, pare-feu, durcissement.

```bash
node tools/gen-icons.js
```
Régénère les icônes PNG de l'application.

```bash
node tools/gen-cours.js "<chemin du vault cours-sisr-main>"
```
Reprend les notes de cours liées à chaque fiche (`dc/cours.js`) et leurs images (`cours/img/`). À relancer après une modification de ces notes.

```bash
node tools/gen-vault.js . "<chemin du vault Obsidian>"
node tools/checklinks.js "<chemin du vault Obsidian>"
```
Génèrent les notes Obsidian (parcours, fiches, incidents, références, aide-mémoire, progression) à partir des données du jeu, puis vérifient les liens. Les cases déjà cochées sont conservées et les notes devenues obsolètes sont retirées.
