# Home assistant configuration
[![Demandez moi n'importe quoi !](https://img.shields.io/badge/Demandez%20moi-n'%20importe%20quoi-1abc9c.svg)](https://github.com/KaoruKanon/homeassistant-config) [![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://GitHub.com/Naereen/StrapDown.js/graphs/commit-activity) [![Twitter](https://img.shields.io/twitter/follow/kaorussh?style=social)](https://twitter.com/kaorussh)   [![GitHub stars](https://img.shields.io/github/stars/KaoruKanon/homeassistant-config?style=social)](https://github.com/KaoruKanon/homeassistant-config)

Ma configuration Home Assistant et son front-end, **Kaoru Home** : un panneau sur mesure pensé pour la tablette murale (Lenovo M10+ sous [Fully Kiosk](https://play.google.com/store/apps/details?id=de.ozerov.fully&hl=fr&gl=US), raccordée avec un chargeur magnétique), l'application Companion et le PC.

Historique du front-end :

| Période | Front-end | Ce qu'il a apporté |
|---|---|---|
| Jusqu'en 2025 | [config de matt8707](https://github.com/matt8707/hass-config) | dashboard inspiré de HomeKit (projet arrêté par son auteur) |
| 2025 | [Adaptive Mushroom](https://github.com/sga-noud/adaptive-mushroom) | meilleur responsive, dashboards par personne, menu de navigation |
| Depuis 2026 | **Kaoru Home** | panneau réécrit de zéro (Lit + TypeScript), sans carte HACS : plus rapide, plus cohérent, plan 2D / 3D, scènes illustrées |

T'aimes mon repo ? Laisse une ⭐.
* [![Twitter](https://img.shields.io/twitter/follow/kaorussh?style=social)](https://twitter.com/kaorussh)
* [Profil HACF](https://forum.hacf.fr/u/kaoru)
* [Topic de mon dashboard sur HACF](https://forum.hacf.fr/t/mon-dashboard-kaoru/1022)

## Kaoru Home

Un panneau Home Assistant écrit en Lit + TypeScript, compilé avec Vite. Les pièces viennent des zones de Home Assistant ; `app/src/config.ts` ajoute seulement ce que le registre ne sait pas : noms, ordre des pièces, favoris par personne, confirmations, plan de l'appartement.

Deux panneaux, déclarés en `panel_custom` dans `configuration.yaml` et servis par le même bundle :

| Panneau | URL | Contenu |
|---|---|---|
| Maison V2 | `/maison-v2` | le front-end principal : tuiles « bento », scènes illustrées, plan 2D / 3D |
| Maison (V1) | `/maison` | l'accueil Mushroom refait, gardé temporairement avant d'être retiré |

<img src="/images/kaoru-home/pc-accueil.jpg" width="100%">

<img src="/images/kaoru-home/mobile-accueil.jpg" height="500"> <img src="/images/kaoru-home/mobile-maison.jpg" height="500"> <img src="/images/kaoru-home/mobile-piece.jpg" height="500"> <img src="/images/kaoru-home/mobile-medias.jpg" height="500"> <img src="/images/kaoru-home/mobile-meteo.jpg" height="500"> <img src="/images/kaoru-home/mobile-energie.jpg" height="500"> <img src="/images/kaoru-home/mobile-systeme.jpg" height="500">

Le plan de l'appartement, en 2D et en 3D :

<img src="/images/kaoru-home/pc-plan-2d.jpg" width="49%"> <img src="/images/kaoru-home/pc-plan-3d.jpg" width="49%">

La carte des positions et l'agenda sont floutés sur les captures.

### Maison V2 : les pages

* **Navigation** : un dock flottant en bas (téléphone, PC), un rail d'icônes à gauche sur la tablette murale ; six thèmes : Accueil, Maison, Médias, Météo, Énergie, Système.
* **Accueil** : bandeau avec la [grenouille météo de Google](https://github.com/Senexis/Google-Weather-Frog), l'heure, les personnes et les badges (température, minuteur du Google Home, lumières, fenêtres, alarme avec son popup et son clavier). Tuiles : lumières (variateur au glissé), lecture en cours (carte Spotify), Jellyfin, climat par pièce avec courbes, énergie, prévisions, favoris, ordinateurs, bourse, raccourcis. Sur la tablette, tout tient sur un écran : trois colonnes équilibrées selon la hauteur réelle des tuiles.
* **Maison** : le **plan de l'appartement**, en 2D ou en vraie 3D (three.js, rotation au doigt ou à la souris), puis une carte illustrée par pièce.
  * En direct : pièces allumées, fenêtres ouvertes, présence, température à côté du nom de chaque pièce, TV et PC.
  * Les fenêtres montrent le vrai ciel (météo et soleil : bleu, orange au lever et au coucher, gris sous la pluie, nuit) ; en 3D, la lumière du soleil entre selon sa vraie position et projette ses taches sur le sol.
  * Mobilier réel en 3D : meuble TV, vitrine, armoires, table de bar, cuisine, setup gaming à deux écrans, tours des PC, lits, salle de bain.
  * Lumières placées une par une (spots, lampe japonaise, bandeau LED), chacune dans sa couleur ; un appui allume ou éteint celle-là seulement.
  * Un appui sur une pièce l'ouvre ; sur son ampoule, toute la pièce ; sur un badge, la TV ou le PC.
* **Pièce** : sa scène, ses lumières, prises, médias, ouvertures, présence, climat sur 24 h.
* **Médias** : lecture en cours, carte Jellyfin (construite comme la carte Spotify), télécommande condensée de la box TV, affiches des films et séries ajoutés.
* **Météo** : la grenouille du moment, heures et jours, courbes 24 h, soleil et lune, radar [Windy](https://windy.com), bourse.
* **Énergie** : graphe Linky jour / 7 jours, **Sankey « Où part l'électricité »** (de la puissance du Linky vers chaque prise qui mesure, puis « Reste de la maison »), ordinateurs, prises, minuterie de la trottinette, ventilateur.
* **Système** : carte de la famille et des objets suivis (carte native de Home Assistant), Internet, Home Assistant, mises à jour, tablette, automatisations, batteries, recherche.
* **Messages** : les notifications, y compris celles de Home Assistant, s'affichent en haut, dans le style du panneau et en français.

### Design

* **Une couleur par thème et par pièce**, en dégradés doux ; tuiles « bento » à la hauteur de leur contenu, jamais étirées.
* **Scènes illustrées** en aplats sans contour, dans le style de la grenouille météo : chaque pièce a la sienne, Tomo (un chat noir) y vit ; la nuit, tout s'assombrit, une pièce allumée devient chaude.
* **Animations utiles** : pression des boutons, apparition des pages, lumière ; l'icône d'une TV allumée clignote, celle d'une musique en lecture bouge, une barre de chargement suit un PC qui démarre ou s'arrête. Elles s'arrêtent si le système demande moins d'animations.
* **Graphes** lissés, remplis, avec min / max et un curseur à parcourir du doigt, sans jamais changer la taille de leur carte.
* **Responsive** :

  | Écran | Disposition |
  |---|---|
  | Téléphone | une colonne, favoris en haut, swipe cards, menu en bas |
  | Tablette murale | un seul écran sans défilement, rail à gauche |
  | PC | marges égales autour du rail, colonnes équilibrées |

* Icônes météo : [Meteocons](https://github.com/basmilius/weather-icons) ; icônes : Material Design Icons.

### Sécurité des actions

* Les prises Tuya (`switch.smart_plug_*`) et tout ce qui est rattaché à leur appareil demandent une confirmation, dans les deux sens, et ne sont jamais groupées dans un « tout éteindre ».
* Un PC démarre sur un simple appui ; l'éteindre demande une confirmation. Un appui long ou un double appui ouvre ses détails.
* Chaque commande envoie un `turn_on` / `turn_off` explicite selon l'état vu à l'écran, jamais un `toggle`.

### Performances

Chargement à froid de l'accueil, profil tablette (1280 × 800), processeur ralenti 4 fois, médiane de 5 mesures (`app/dev/perf.mjs`) :

| | Lovelace (Adaptive Mushroom) | Maison V1 | Maison V2 |
|---|---|---|---|
| Premier vrai contenu affiché | 6,98 s | 4,83 s | 4,55 s |
| Temps de blocage | 4,13 s | 2,34 s | 2,19 s |
| JavaScript téléchargé | 2 503 Ko | 1 347 Ko | 1 396 Ko |
| Dont modules ajoutés (HACS, `/local`) | 1 209 Ko | 309 Ko | 358 Ko |
| Éléments dans la page | 1 444 | 948 | 1 024 |

Score Lighthouse « Performance » (Lighthouse 12, médiane de 3) :

| | Lovelace (Adaptive Mushroom) | Maison V1 | Maison V2 |
|---|---|---|---|
| Mobile | non mesuré | 70 | 73 |
| Ordinateur | non mesuré | 96 | 96 |
| Temps de blocage, mobile | non mesuré | 2,4 s | 1,6 s |

Chaque page de la V2 :

| Page | Mobile | Ordinateur | Décalage de mise en page |
|---|---|---|---|
| Accueil | 73 | 96 | 0,002 |
| Maison (plan) | 74 | 97 | 0 |
| Une pièce | 73 | 99 | 0 |
| Médias | 75 | 99 | 0 |
| Météo | 74 | 98 | 0,001 |
| Énergie | 74 | 99 | 0,058 |
| Système | 64 | 64 | 0,006 |

* Système est plombée par la carte native de Home Assistant (MapLibre), dessinée sans GPU par Chrome sans écran pendant la mesure.
* La colonne Lovelace date du 23 octobre 2026, avant sa suppression : même script, même profil, avec ses 28 ressources HACS et `card-mod`.
* L'essentiel du temps restant est celui du frontend de Home Assistant lui-même, commun aux trois. Kaoru Home charge environ 70 Ko gzip pour afficher l'accueil (Lit et composants communs compris) ; les autres pages arrivent à la demande, et three.js (150 Ko gzip) seulement pour le plan 3D.

### Développer

Sources : `app/` (Node 22). Le bundle (`www/kaoru-home/`) n'est pas versionné : la CI le compile à chaque release et l'inclut dans le zip.

```sh
cd app && npm ci
npm run check   # types
npm test        # tests unitaires (node:test)
npm run build   # www/kaoru-home/ : kaoru-home.js (chargeur), manifest.json, app-<hash>.js, chunks/
```

* `kaoru-home.js` ne change jamais : il lit `manifest.json` (non mis en cache) et charge la version compilée du moment, donc une mise à jour se voit sans vider le cache du navigateur.
* La V2, les pages et three.js sont des chunks séparés, téléchargés à la première visite.
* `app/dev/` : tests dans Chrome avec un faux Home Assistant (`harness.mjs` : prises protégées, actions de pièce, PC), audit de mise en page sur dix tailles d'écran (`layout-audit.mjs`), captures (`screens.mjs`), mesures de chargement (`perf.mjs`). Les tests n'actionnent que des entités simulées.
* Le plan : `app/assets/plan/appartement.drawio` est la source ; les murs, fenêtres et meubles en sont extraits dans `app/src/v2/plan-data.ts`, les modèles 3D sont dans `plan3d-models.ts`.

### Publier

Chaque tag publie une release GitHub : l'action *Create Config Zip* compile le panneau et joint `homeassistant-config-<tag>.zip`, qui contient la configuration et le panneau compilé, prêt à être décompressé dans le dossier de configuration de Home Assistant. Il faut Home Assistant 2026.10 ou plus récent (carte native utilisée par le panneau).

## Equipement

| Icon | Device | Total |
|------|:--------------:|:------:|
| 🖥️ |️ Ordinateurs | 2 |
| 🌡️ | Xiaomi mijia Temperature Humidity 2019 | 5 |
| 📱 | Smartphone | 2 |
| 📱 | Lenovo TAB M10+ & Fully Kiosk Browser | 1 |
| 💡 | Bulb E27 yeelight & yeelight strip | 7 |
| 🔘 | Switch Xiaomi | 3 |
| 📺 | Samsung TV | 2 |
| 📦 | Box TV Bouygues | 1 |
| ⚡ | Lixee Zlinky TIC | 1 |
| 🔌 | Tuya Smart Plug Zigbee 3.0 (avec mesure de consommation) | 4 |
| 🗝️ | Sonoff Zigbee 3.0 USB Dongle Plus | 1 |
| 👁️ | Zigbee PIR Module TS0202 | 3 |
| ☀️ | Zigbee Tyua PIR Luminance TS0601 | 1 |
| 🔛 | Zigbee E1 Wall Switch QBKG38LM | 1 |
| 🚪 | Zigbee Déctereur Ouverture Porte et Fenêtre eWeLink SNZB-04 | 6 |
| 🌀 | Ventilateur Xiaomi Mi Smart Pedestal Fan | 1 |

## Fonctionnalités

* Météo : [Météo-France](https://www.home-assistant.io/integrations/meteo_france/) et [OpenWeatherMap](https://www.home-assistant.io/integrations/openweathermap/), radar Windy, grenouille météo
* Consommation électrique : Linky via le module TIC [Lixee ZLinky](https://www.gotronic.fr/art-module-zlinky-tic-avec-antenne-38788.htm) (zigbee), prises qui mesurent, Sankey de répartition
* Température et humidité de chaque pièce
* Suivi des personnes et des objets (traceurs), « trouver mon téléphone »
* Alarme : état, armement par mode, clavier pour le code
* Lumières par pièce, variateur, couleurs, automatisations associées
* Spotify, Google Home, TV Samsung et box TV (télécommande)
* Jellyfin : derniers ajouts, films et séries
* Ordinateurs : allumage, veille, redémarrage, statistiques, capture d'écran ([HASS.Agent](https://github.com/LAB02-Research/HASS.Agent))
* Prises connectées (protégées) et minuterie de la trottinette
* Ventilateur connecté
* Bourse ([Yahoo Finance](https://github.com/iprak/yahoofinance))
* Batteries des appareils, mises à jour, sauvegardes, automatisations
* Dashboard par personne, QR code du Wi-Fi pour les invités, agenda

### Captures d'écran des PC

Source : https://hassagent.readthedocs.io/en/latest/examples/#command-grab-screenshot-using-powershell

* Script PowerShell (voir le dossier du repo, à adapter)
* Bouton « screenshot » dans HASS.Agent qui exécute le script
* Automatisation qui appuie sur ce bouton via MQTT
* Entité caméra qui lit le fichier

### Minuteur du Google Home de la cuisine

Le minuteur en cours s'affiche dans les badges de l'accueil et clignote tant qu'il tourne. Récupération des minuteurs : [chvancooten](https://github.com/chvancooten/homeassistant-googletokenretriever).

## TODO et idées..

### Road-map
* Vieille smart TV Samsung (en cours)
* Consommation eau et chauffage
* Conservation des métriques sur le long terme
* Kaoru Home : accueil qui s'adapte au moment de la journée (matin, journée, soir, nuit)

### Problèmes à fix

* TBD

### Idées
* Prise en charge par le dashboard de futures caméras
* Kaoru Home : placer chaque lumière et chaque capteur sur le plan (positions à ajouter au drawio)
* Robot aspirateur
* Vanne thermostatique connectée
