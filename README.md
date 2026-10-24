# Home assistant configuration
[![Demandez moi n'importe quoi !](https://img.shields.io/badge/Demandez%20moi-n'%20importe%20quoi-1abc9c.svg)](https://github.com/KaoruKanon/homeassistant-config) [![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://GitHub.com/Naereen/StrapDown.js/graphs/commit-activity) [![Twitter](https://img.shields.io/twitter/follow/kaorussh?style=social)](https://twitter.com/kaorussh)   [![GitHub stars](https://img.shields.io/github/stars/KaoruKanon/homeassistant-config?style=social)](https://github.com/KaoruKanon/homeassistant-config)

Ma configuration Home Assistant et son front-end, **Kaoru Home** : un panneau sur mesure pensé pour la tablette murale (Lenovo M10+ sous [Fully Kiosk](https://play.google.com/store/apps/details?id=de.ozerov.fully&hl=fr&gl=US), raccordée avec un chargeur magnétique), l'application Companion et le PC.

Historique du front-end :

* au départ, la config de [matt8707](https://github.com/matt8707/hass-config), inspirée de HomeKit (il ne la maintient plus) ;
* depuis 2025, [Adaptive Mushroom](https://github.com/sga-noud/adaptive-mushroom) ([forum anglais](https://community.home-assistant.io/t/adaptive-mushroom/640308)) : meilleur responsive, dashboards par personne, menu de navigation ;
* depuis 2026, **Kaoru Home**, réécrit de zéro (Lit + TypeScript) : il reprend toutes les fonctionnalités du dashboard Mushroom, en plus rapide et plus cohérent, sans carte HACS. Le dashboard Lovelace reste disponible à côté.

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

Les zones sensibles (plan de l'appartement, carte des positions, agenda) sont floutées sur les captures.

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
* `app/dev/` : tests dans Chrome avec un faux Home Assistant (`harness.mjs` : prises protégées, actions de pièce, PC), audit de mise en page sur dix tailles d'écran (`layout-audit.mjs`), captures (`screens.mjs`), mesures (`perf.mjs`). Les tests n'actionnent que des entités simulées.
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

## Dashboard Lovelace (Adaptive Mushroom)

L'ancien dashboard reste disponible. Il s'appuie sur ces cartes et intégrations :

| Dépendance | Usage |
| --- | --- |
|Mushroom| Collection de cartes pour home assistant |
|mini-graph-card| Carte basique pour des graphiques |
|button-card| Bouton custom |
|Mini Media Player| Carte pour les appareils de type mediaplayer |
|browser_mod| Affichage de popup |
|apexcharts-card| Carte pour les graphiques avancées |
|card_mod| Modification de l'apparence avec du CSS pour Home assistant |
|layout-card| Création de layout pour les cartes |
|Spotcast| Intégration de spotify supplémentaire |
|Calendar Card Pro| Carte pour calendrier |
|Horizon Card| Carte pour les événements |
|Kiosk Mode| Transforme home assistant en kiosk |
|Xiaomi Mi Smart Pedestal Fan Integration| Integration pour ventilateur xiaomi connecté |
|Bar Card| Carte pour des barres de progression |
|Decluterring Card| Template de carte réutilisable |
|Average Sensor| Capteur pour faire des moyennes de capteur |
|Hourly Weather Card| Prévision météo en forme de barres |
|Stack in Card| Carte pour combiner en pile les cartes |
|Swipe Card| Carte swipable |
|card-tools| Dépendance pour d'autres modules |
|search-card| Barre de recherche d'entités |
|Jellyfin Recently Added| Derniers ajouts de Jellyfin |
|Yahoo Finance| Cours de la bourse |

Kaoru Home n'utilise aucune de ces cartes ; Average Sensor, Spotcast, Yahoo Finance, l'intégration du ventilateur et browser_mod (tablette) restent utiles à la configuration.

![dashboard]
![tablette-jour]

<img src="/images/mobile-home.png" height="500"> <img src="/images/mobile-appareil.jpg" height="500"> <img src="/images/mobile-notif.jpg" height="500"> <img src="/images/mobile-automation.jpg" height="500"> <img src="/images/mobile-system.jpg" height="500">

### Animations

Source des inspirations : https://community.home-assistant.io/t/mushroom-cards-build-a-beautiful-dashboard-easily-part-1/388590/3238 (Kaoru Home les reprend).

* Blink de l'icone TV quand la TV est allumée

![](/images/tv-blink.gif)

* Chargement de la barre quand le téléphone se charge

![](/images/smartphone-charging.gif)

* L'icône du media player qui se secoue lorsqu'une musique est jouée

![](/images/audio-boom.gif)

* L'icône des automatisations scintille quand elle est activée

![](/images/automation-enabled-blink.gif)

* Respiration du badge, vert pour la présence, rouge pour l'absence

![](/images/person-live.gif)

* Led du PC qui clignote quand il est allumé

![](/images/computer-led.gif)

* Boucle de chargement quand le PC s'éteint ou s'allume

![](/images/computer-stop.gif)

### Thermomètre

Inspiration des boutons thermomètre : https://community.home-assistant.io/t/mushroom-cards-build-a-beautiful-dashboard-easily-part-1/388590/1034?u=kaoru

![thermometer]

![thermometer-popup]

### Spotify

Carte qui combine mushroom-media-player-card et la barre du mini-media-player, la pochette en fond (Kaoru Home reprend cette construction, et l'applique à Jellyfin).

![spotify-active]

### QR code du Wi-Fi

<img src="/images/wifi-qrcode.png" height="500">

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

<!-- MARKDOWN LINKS & IMAGES -->
[dashboard]: /images/main_tablet.png
[mobile-dasboard]: /images/main_mobile.png
[media-player-control]: /images/media-player-control.jpg
[spotify-active]: /images/spotify-active.png
[spotify-popup]: /images/spotify-popup.jpg
[tablette-jour]: /images/tablette-jour.jpg
[thermometer-popup]: /images/thermometer-popup.png
[thermometer]: /images/thermometer.png
[bouton-snapshot]: images/bouton-snapshot.jpg
[weather]: images/weather.jpg
