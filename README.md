# Hyperscale — simulateur pédagogique de datacenter

Jeu de gestion d'une salle de datacenter pour réviser le **BTS SIO option SISR** : on part d'une salle vide avec 10 000 €, on construit des baies, on câble, on configure, on teste, puis on livre des contrats de plus en plus complexes.

## Jouer

- **En ligne** : https://t0myto.github.io/hyperscale/
- **En local** : ouvre `index.html` dans un navigateur. Le dossier `dc/` doit rester à côté.

La partie est sauvegardée dans le navigateur (`localStorage`).

## Contenu

- **Salle** de 6 rangées (A à F) avec allées, salle opérateur (MMR), énergie (EDF, TGBT, onduleurs A/B, batteries, groupe électrogène) et froid (CRAC, in-row, confinement).
- **Baie** en vue avant / arrière : routeurs, pare-feu, switchs d'accès, leaf / spine, serveurs, baies de stockage, câbles cuivre, fibre et DAC.
- **Configuration** dans des fenêtres déplaçables (double-clic sur un équipement) : ports, VLAN 802.1Q, règles de pare-feu, RAID, VM et services.
- **Console** avec des sorties réalistes (Cisco IOS, Linux, Proxmox, nftables) et la commande équivalente de chaque action.
- **Contrats** : offre → installation → recette (tests d'acceptation) → mise en service.
- **Incidents** (pannes matérielles, coupures, attaques) détectés par la supervision, le client ou l'IDS, avec une méthode de dépannage par couches OSI.
- **23 fiches de cours** et des quiz.
- Pas de factures : seuls les contrats en service rapportent de l'argent.

## Structure

| Fichier | Rôle |
|---|---|
| `hyperscale.html` | Corps de la page : mise en forme et interface (source) |
| `index.html` | Page complète générée par `tools/build.js` |
| `dc/data.js` | Catalogue, prix, salle, contrats |
| `dc/sim.js` | État du jeu, énergie, froid, réseau, argent |
| `dc/actions.js` | Actions du joueur (acheter, placer, câbler, configurer) |
| `dc/learn.js` | Fiches, incidents, tickets, recette |
| `dc/console.js` | Commandes et sorties de la console |
| `dc/view.js` | Vue SVG d'une baie |
| `dc/room.js` | Vue de la salle, déplacement dans les allées |
| `dc/ui.js` | Panneaux, fenêtres de configuration, tutoriel |

## Outils

```bash
node tools/build.js
```
Régénère `index.html` après une modification de `hyperscale.html`.

```bash
node tools/gen-vault.js . "<chemin du vault Obsidian>"
node tools/checklinks.js "<chemin du vault Obsidian>"
```
Génèrent les notes Obsidian (fiches, incidents, références, aide-mémoire, progression) à partir des données du jeu, puis vérifient les liens.
