# Home assistant configuration
[![Demandez moi n'importe quoi !](https://img.shields.io/badge/Demandez%20moi-n'%20importe%20quoi-1abc9c.svg)](https://github.com/KaoruKanon/homeassistant-config) [![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://GitHub.com/Naereen/StrapDown.js/graphs/commit-activity) [![Twitter](https://img.shields.io/twitter/follow/kaorussh?style=social)](https://twitter.com/kaorussh)   [![GitHub stars](https://img.shields.io/github/stars/KaoruKanon/homeassistant-config?style=social)](https://github.com/KaoruKanon/homeassistant-config)


Cette configuration est basée sur ce repo [ [github](https://github.com/sga-noud/adaptive-mushroom) / [forum anglais](https://community.home-assistant.io/t/adaptive-mushroom/640308) ]

Initialement, ma config était basée sur https://github.com/matt8707/hass-config. Depuis 2025, ma config home assistant a migré vers Adaptative Mushroom. De plus matt8707 ne maintient plus sa config inspiré de homekit pour se consacrer sur un autre projet.

Point fort du projet Adaptive Mushroom :

* Meilleur responsive
* Personalisation des dashboard par user plus facile
* Système de menu pour naviguer entre dashboard
* Modularité par dahsboard plus importante 

Mon Home assistant tourne sous un PC dell pro récupéré, avec lequel j'utilise une tablette Lenovo wall mounted sous [Fullykiosk](https://play.google.com/store/apps/details?id=de.ozerov.fully&hl=fr&gl=US). La tablette est raccordé avec un chageur magnétique.

T'aimes mon repo ? Laisse une ⭐.
* [![Twitter](https://img.shields.io/twitter/follow/kaorussh?style=social)](https://twitter.com/kaorussh)
* [Profil HACF](https://forum.hacf.fr/u/kaoru)
* [Topic de mon dashboard sur HACF](https://forum.hacf.fr/t/mon-dashboard-kaoru/1022)

![dashboard]
![tablette-jour]

<img src="/images/mobile-home.png" height="500"> <img src="/images/mobile-appareil.jpg" height="500"> <img src="/images/mobile-notif.jpg" height="500"> <img src="/images/mobile-automation.jpg" height="500"> <img src="/images/mobile-system.jpg" height="500">

## Equipement et configuration

- HASS supervised tourne avec debian 11 sur machine DELL de récupération. 

| Icon | Device | Total |
|------|:--------------:|:------:|
| 🖥️ |️ Ordinateurs | 2 |
| 🌡️ | Xiaomi mijia Temperature Humidity 2019 | 5 |
| 📱 | Smartphone | 2 |
| 📱 | Lenovo TAB M10+ & Fully Kiosk Browser | 1 |
| 💡 | Bulb E27 yeelight & yeelight strip | 7 |
| 🔘 | Switch Xiaomi | 3 |
| 📺 | Samsung TV | 1 |
| ⚡ | Lixee Zlinky TIC | 1 |
| 🔌 | Tuya Smart Plug Zigbee 3.0 | 4 |
| 🗝️ | Sonoff Zigbee 3.0 USB Dongle Plus | 1 |
| 👁️ | Zigbee PIR Module TS0202 | 3 | 
| ☀️ | Zigbee Tyua PIR Luminance TS0601 | 1 | 
| 🔛 | Zigbee E1 Wall Switch QBKG38LM  | 1 | 
| 🚪 | Zigbee Déctereur Ouverture Porte et Fenêtre eWeLink SNZB-04 | 6 |

D'autres ampoules et boutons et interrupteur zigbee, etc devraient arriver d'ici prochainement pour terminer la domotisation des lumières

## Liste des intégrations et frontend HASS : 

| Dépendance | Usage |
| --- | --- |
|Mushroom| Collection de cartes pour home assistant |
|mini-graph-card| Carte basique pour des graphiques |
|button-card| Bouton custom |
|Mini Media Player| Carte pour les appareils de type mediaplayer |
|browser_mod| Affichage de popup |
|apexcharts-card| Carte pour les graphiques avancées
|card_mod| Modification de l'apparence avec du CSS pour Home assistant
|layout-card| Création de layout pour les cartes
|Spotcast| Intégration de spotify supplémentaire |
|Calendar Card Pro| Carte pour calendrier |
|Horizon Card| Carte pour les événements 
|Kiosk Mode| Transforme home assistant en kiosk |
|Xiaomi Mi Smart Pedestal Fan Integration| Integration pour ventalitateur xiaomi connecté | 
|Bar Card| Carte pour des barres de progression |
|Decluterring Card| Template de carte réutilsable | 
|Average Sensor| Capteur pour faire des moyennes de capteur |
|Hourly Weather Card| Prévision météo en forme de barres |
|Stack in Card| Carte pour combiner en pile les cartes |
|Swipe Card| Carte swipable |
|card-tools| Dépendance pour d'autres modules |
|search-card| Barre de recherche d'entités |
|Plex Recently Added| Module pour récupérer les derniers nouveautés de plex |
|Yahoo Finance| Module pour récupérer les actions en bourses |

## Liste des fonctionnalités de Home assistant  
* Suivi de la météo
* Suivi de la consommation du linky
* Suivi de plex 
* Suivi de la température intérieure
* Suivi de la consommation des appareils sous batteries
* Suivi des personnes 
* Suivi rapide des cours de la bourse
* Dashboard personnalisable par personne 
* Gestion des lampes et automatisation associés
* Gestion de spotify, des googles home et TV.
* Gestion des prises connectées
* Gestion des ordinateurs 
* Gestion des Télévisions et Audio/Spotify 
* Gestion du ventilateur connecté
* Autres : Affiche le QR Code pour le wifi, agenda perso..

## Détails de certaines fonctionalités pour vos inspirations 
### Animation 

Un certains nombres d'animation dans le dahsboard ont été mis en place pour le rendre un peu plus vivant.

Source des inspirations : https://community.home-assistant.io/t/mushroom-cards-build-a-beautiful-dashboard-easily-part-1/388590/3238

* Blink de l'icone TV quand la TV est allumé 

![](/images/tv-blink.gif)

* Chargement de la barre quand le téléphone se charge 

![](/images/smartphone-charging.gif)

* L'icon du mediaplayer qui se secoue lorsqu'une musique est joué 

![](/images/audio-boom.gif)

* L'icone des boutons des automations scintille qunand elle est activé (pas en cours d'exécution forcément)

![](/images/automation-enabled-blink.gif)

* Respiration du badge en fonction de la couleur, vert pour la présence ou rouge pour l'absence 

![](/images/person-live.gif)

* Led du PC qui clignote quand il est allumé 

![](/images/computer-led.gif)

* Boucle de chargement quand le pc s'éteint ou s'allume

![](/images/computer-stop.gif)

Les icons SVG utiliser pour la météo provient de ce repo : https://github.com/basmilius/weather-icons

### Thermomètre
Inspiration des boutons thermomètre : https://community.home-assistant.io/t/mushroom-cards-build-a-beautiful-dashboard-easily-part-1/388590/1034?u=kaoru

![thermometer]

Popup custom pour mieux suivre les indicateurs du thermomètres 

![thermometer-popup]

### Météo

Popup météo qui donne la prévision des prochains jours `weather-forecast`,`custom:mini-graph-card` de la témpérature et humidité des ces dernières 24h et les images satellites grâce à  [Windy](https://windy.com) contenu dans un `iframe`. Plus d'information via ce [lien](https://www.youtube.com/watch?v=U8j5p-DUdAE)

### Afficher le timer en cours du google home de la cuisne

Affichage du timer du google home avec les badges se trouvant en haut du dashboard

Source de la récupération des timer : [chvancooten](https://github.com/chvancooten/homeassistant-googletokenretriever)

<img src="/images/google-timer.gif" height="100"> <img src="/images/google-timer-no-timer.png" height="100">

Celui-ci clignote chaque seconde grâce au card_mod lorsque le timer est actif.

#### QR-CODE du WiFi

Ajout d'un QR-Code du WiFi accessible facilement depuis la tablette pour les invités. Le SSID et le password est accessible en clair également.

<img src="/images/wifi-qrcode.png" height="500">

### Consomation électrique

La consommation est récupérée avec le module tic Lixee Zlinky qui fonctionne en zigbee. Fonctionnement plus faible que l'API Enedis. 

https://www.gotronic.fr/art-module-zlinky-tic-avec-antenne-38788.htm

### Météo

Météo avec l'api [Météo-France](https://www.home-assistant.io/integrations/meteo_france/) + [Openweathermap](https://www.home-assistant.io/integrations/openweathermap/) en complément.

### Monitoring et gestion des PCs

Utilisation de [HASS Agent](https://github.com/LAB02-Research/HASS.Agent) pour contrôler les PC Windows.

Mise en place du screenshot : 

Source : https://hassagent.readthedocs.io/en/latest/examples/#command-grab-screenshot-using-powershell

* Création d'un script powershell (voir dossier du repo. cf adapter le powe)
* Mise en place d'un button screenshot dans HASS.agent qui exécute le script powershell
* Automation qui executer l'entity screenshot disponible via mqtt
* Création d'une entity camera via fichier 

### Spotify 

Création d'une carte qui combine mushroom-media-player-card et la barre du mini-media-player. La pochette de la musique s'affiche en album. Le concept est repris pour les google home.

![spotify-active]

## Kaoru Home

Kaoru Home est le front-end sur mesure de cette configuration : un panneau Home Assistant écrit en Lit + TypeScript, compilé avec Vite, pensé pour la tablette murale (Lenovo M10 sous Fully Kiosk), l'application Companion et le PC. Il reprend les fonctionnalités du dashboard Adaptive Mushroom, en plus rapide et plus cohérent. Les pièces viennent des zones de Home Assistant ; `app/src/config.ts` ajoute seulement ce que le registre ne sait pas (noms, ordre des pièces, favoris par personne, confirmations, plan de l'appartement).

Deux panneaux, déclarés en `panel_custom` dans `configuration.yaml` et servis par le même bundle :

| Panneau | URL | Contenu |
|---|---|---|
| Maison (V1) | `/maison` | l'accueil Mushroom refait : colonnes, swipe cards, popups |
| Maison V2 | `/maison-v2` | la refonte : tuiles « bento », scènes illustrées, plan 2D / 3D |

### Maison V2 : interface

* **Navigation** : un dock flottant en bas (téléphone, PC), un rail d'icônes à gauche sur la tablette murale ; six thèmes : Accueil, Maison, Médias, Météo, Énergie, Système.
* **Accueil** : bandeau avec la grenouille météo, l'heure, les personnes et les badges aux couleurs du Lovelace (température, minuteur, lumières, fenêtres, alarme avec son popup et son clavier). Tuiles : lumières (variateur au glissé), lecture en cours (carte Spotify façon Lovelace), Jellyfin, climat par pièce avec courbes, énergie, prévisions, favoris, ordinateurs, bourse, raccourcis. Sur la tablette, tout tient sur un écran : trois colonnes équilibrées selon la hauteur réelle des tuiles.
* **Maison** : le **plan de l'appartement** (depuis `app/assets/plan/appartement.drawio`), en 2D ou en vraie 3D (three.js, chargé seulement quand on choisit la 3D). Pièces allumées, fenêtres ouvertes, présence, TV et PC en direct ; un appui ouvre une pièce, allume une lampe ou un PC. Puis une carte illustrée par pièce (Tomo, le chat noir de l'app Tomo, y vit).
* **Pièce** : sa scène, ses lumières, prises (protégées), médias, ouvertures, présence, climat sur 24 h.
* **Médias, Météo, Énergie, Système** : scènes animées ; télécommande de la box, affiches Jellyfin, heures et jours, radar Windy, graphe Linky jour / 7 jours, carte de la famille (carte native de HA), Internet, mises à jour, automatisations, batteries, recherche.

Règles de design :

* Une couleur par thème ou par pièce, en dégradés doux ; tuiles à la hauteur de leur contenu, jamais étirées.
* Scènes en aplats sans contour, dans le style de la grenouille météo de Google ; la nuit, tout s'assombrit, une pièce allumée devient chaude.
* Animations sobres et utiles (pression, apparition, lumière), coupées si le système demande moins d'animations.
* Responsive : téléphone (une colonne, favoris en haut), tablette (un écran sans défilement), PC (marges égales autour du rail).

### Sécurité des actions

* Les prises Tuya du homelab (`switch.smart_plug_*`) et tout ce qui est rattaché à leur appareil demandent une confirmation, dans les deux sens, et ne sont jamais groupées dans un « tout éteindre ».
* Un PC démarre sur un simple appui ; l'éteindre demande une confirmation (`confirmOffOnly`). Un appui long ou un double appui ouvre ses détails ; une barre de progression s'affiche tant qu'il démarre ou s'arrête.
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
* `app/dev/` : déploiement sur l'instance de test (`deploy-dev.sh`), tests dans Chrome avec un faux Home Assistant (`harness.mjs`), audit de mise en page sur dix tailles d'écran (`layout-audit.mjs`), captures (`screens.mjs`), mesures (`perf.mjs`). Les tests n'actionnent que des entités simulées.

### Déployer en production

1. Fusionner la branche dans `master`.
2. Poser un tag sur `master` (ex. `2026.10.0`) : l'action *Create Config Zip* compile le panneau et publie `homeassistant-config-<tag>.zip` dans la release GitHub.
3. Dans `ansible-infra`, passer `homeassistant_config_version` à ce tag (`production/group_vars/hass/vars`) par une PR : la CI joue `playbook_hass.yml`, qui télécharge le zip, le décompresse dans `/opt/homeassistant/config` sur hass01 et redémarre Home Assistant.
4. Les panneaux « Maison » et « Maison V2 » apparaissent dans la barre latérale ; le dashboard Lovelace reste disponible.

## TODO et idées..

### Road-map 
* Vielle smartTV samsung (en cours)
* Consommation eau et chauffage (Proof of conception dans le premier semestre)
* Conservation des métriques sur le long terme dans influxdb (projet en cours avec migration sous proxmox)

### Problèmes à fix

* Kaoru Home : les plafonniers et la lampe japonaise de la chambre William n'ont pas de zone dans Home Assistant (ils sont rattachés à la pièce par `config.plan.lights`).

### Idées
* Prise en charge par le dashboard de futures caméras.
* Kaoru Home : placer chaque lumière et chaque capteur sur le plan (positions à ajouter au drawio).
* Système d'alarme
* Robot aspirateur
* Vanne thermostatique connecté

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
