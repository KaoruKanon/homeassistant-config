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
| 🌉 | Gateway Xiaomi V2  | 1 |
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

Affichage du timer du google home avec les badges se trouvant en haut du dashboard [chvancooten](https://github.com/chvancooten/homeassistant-googletokenretriever)

<img src="/images/google-timer.jpg" height="100"> <img src="/images/google-timer-no-timer.png" height="100">

Celui clignote chaque seconde grâce au card_mod quand  un timer est actif.

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

## TODO et idées..

### Road-map 
* Vielle smartTV samsung (en cours)
* Consommation eau et chauffage (Proof of conception dans le premier semestre)
* Conservation des métriques sur le long terme dans influxdb (projet en cours avec migration sous proxmox)

### Problèmes à fix

* TBD

### Idées
* Prise en charge par le dashboard de futures caméras.
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
