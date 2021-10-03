# Home assistant configuration
[![Demandez moi n'importe quoi !](https://img.shields.io/badge/Demandez%20moi-n'%20importe%20quoi-1abc9c.svg)](https://github.com/KaoruKanon/homeassistant-config) [![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://GitHub.com/Naereen/StrapDown.js/graphs/commit-activity) [![Twitter](https://img.shields.io/twitter/follow/kaorussh?style=social)](https://twitter.com/kaorussh)   [![GitHub stars](https://img.shields.io/github/stars/KaoruKanon/homeassistant-config?style=social)](https://github.com/KaoruKanon/homeassistant-config)


Cette configuration est basée sur celle de matt8707 [ [github](https://github.com/matt8707/hass-config) / [forum anglais](https://community.home-assistant.io/t/a-different-take-on-designing-a-lovelace-ui/162594) ]

Mon Home assistant tourne sous un Raspberry Pi 3B+, avec lequel j'utilise une tablette Lenovo wall mounted avec [Fullykiosk](https://play.google.com/store/apps/details?id=de.ozerov.fully&hl=fr&gl=US), avec un chageur magnétique. J'utilise [applicationize](https://applicationize.me/) pour créer une webapp sous chrome en mode kiosk.

T'aimes mon repo ? Laisse une ⭐.
* [![Twitter](https://img.shields.io/twitter/follow/kaorussh?style=social)](https://twitter.com/kaorussh)
* [Profil HACF](https://forum.hacf.fr/u/kaoru)
* [Topic de mon dashboard sur HACF](https://forum.hacf.fr/t/mon-dashboard-kaoru/1022)

![dashboard]
![tablette-jour]


## Equipement et configuration

- HASS supervised tourne sur mon Raspberry 3B+

| Icon | Device | Total |
|------|:--------------:|:------:|
| 💻 | Gateway Xiaomi V2  | 1 |
| 🖥️ |️ Ordinateurs | 2 |
| 🌡️ | Xiaomi mijia Temperature Humidity 2019 | 5 |
| 📱 | Smartphone | 2 |
| 📱 | Lenovo TAB M10+ & Fully Kiosk Browser | 1 |
| 💡 | Bulb E27 yeelight & yeelight strip | 7 |
| 🔘 | Switch Xiaomi | 3 |
| 📺 | Samsung TV | 1 |
| ⚡ | Enedis | 1 |

D'autres ampoules et boutons sans-fil devraient arriver d'ici prochainement pour terminer la domotisation des lumières

## Les fonctionnalités créées par moi
Je vous invite à consulter son repo github pour y voir les fonctionalités de bases proposées par son dashboard. J'ai créé de nouvelles fonctionallités pour répondre à mes besoins.

### Thermomètre
`custom:button-card` des thermomètre avec un `custom:mini-graph-card`. Il affiche le graph de la température des 12 dernières heures. Il est accompagné d'un popup avec témpérature et humidité à l'instant T, avec un graphique des 48 dernières heures.

![thermometre]
![thermometre-popup]

### Météo

Popup météo qui donne la prévision des prochains jours `weather-forecast`,`custom:mini-graph-card` de la témpérature et humidité des ces dernières 24h et les images satellites grâce à  [Windy](https://windy.com) contenu dans un `iframe`. Plus d'information via ce [lien](https://www.youtube.com/watch?v=U8j5p-DUdAE)

### Media

* Intégration officielle de Spotify et Plex en tant que mediaplayer pour l'ajouter avec les chromecast des medias.
* Popup [Spotify Lovelace Card](https://github.com/custom-cards/spotify-card) pour lancer une playlist sur un chromecast. Fonctionne grâce au custom component [Start Spotify on chromecast](https://github.com/fondberg/spotcast)

<img src="/images/spotify-card.jpg" height="130"> <img src="/images/spotify-active.jpg" height="130">

<img src="/images/spotify-popup.jpg" height="366">

<img src="/images/media-player-control.jpg" height="200">

### Popup automation

Popup accessible depuis le bouton Partir, qui permet via un switch de couper l'automation qui éteint les lumières pour éviter les démarrage d'automation lorsque des invités sont présents chez soi.

<img src="/images/automation-popup.jpg" height="200">


### Afficher le timer en cours du google home de la cuisne

Affichage du timer du google home en bas de l'interface grâce au travail [chvancooten](https://github.com/chvancooten/homeassistant-googletokenretriever)

<img src="/images/google-timer.jpg" height="100"> <img src="/images/google-timer-no-timer.jpg" height="100">

### Sidebar

#### Bouton et automation des snapshots.
* Ajout dans le menu update de la sidebar d'un bouton pour faire une snapshot manuelle depuis le dashboard.
* Mise en place une automation qui fait un snapshot tous les jours à miniuit.

<img src="/images/bouton-snapshot.jpg" height="300">

#### Monitoring des batteries, services, systèmes et réseaux

Création d'un popup qui me permet de monitorer rapidement l'infrascture et la domotique :

* Réseaux et systèmes des équipements grâce à la platform ping.
* Monitoring des services web hébergés
* Barre de progression des équipements domotiques sous batterie

![monitoring](https://github.com/KaoruKanon/homeassistant-config/tree/master/imagesmonitoring-battery-service.jpg)

#### Monitoring de la bbox

Ajout d'un pop qui le monitoring la bbox avec les différentes stats accessible via son API.
La platerform [bbox](https://www.home-assistant.io/integrations/bbox/) officiel de home assistant ne fonctionne pas correctement. J'ai créé un script python qui utilise l'API d'HA et [ppybox](https://github.com/HydrelioxGitHub/pybbox). Ce dernier a été modifié pour le débugger mais également créer de nouvelles méthodes pour mon utilisation.  

<img src="/images/bbox-monitoring.jpg" height="500">

#### Horaire des prochains bus

Implémentations des horaires de bus d'Ilévia via l'[API officiel de la Métropole Européenne de Lille](https://opendata.lillemetropole.fr/explore/dataset/ilevia-prochainspassages/information/?flg=fr)  

<img src="/images/bus.jpg" height="500">

#### QR-CODE du WiFi

Ajout d'un QR-Code du WiFi accessible facilement depuis la tablette pour les invités. Le SSID et le password est accessible en clair également.

<img src="/images/wifi-qrcode.jpg" height="500">

## Ma façon d'implémenter son code

matt8707 est suédois et nous n'avons pas les mêmes équipements et services pour la notre domotique.

### Consomation électrique

matt8707 utilisait un script python qui récupère sa consommation chez son fourniseur et rempli un fichier dont le contenu est lu par home assistant. La consommation de chaque mois est découpé par un capteur qui lui est dédié (12 captures).
Pour garder cette base, j'ai créé un script python qui fait la même chose, mais je ne récupère pas les stats d'Enedis depuis leur API moi-même mais grâce au custom component [myEnedis](https://github.com/saniho/apiEnedis) depuis l'API d'Home Assistant.  

Home Assistant lance le script toutes les heures via une automation. Possible de le faire manuellement depuis un boutton.

### Météo

Météo avec l'api [Météo-France](https://www.home-assistant.io/integrations/meteo_france/) et son intégration officiel.

### Monitoring des PC

Utilisation de [IOT Link](https://iotlink.gitlab.io/) pour contrôler les PC sous Windows car matt8707 est sous mac et utilise du SSH.

## TODO et idées..

### Implémentations restantes à finir
* TV samsung (en cours)

### Problèmes
* Améliorer les cards thermomètre : En cas de forte différence de température entre le minimum et le maximum, la courbe est coupée par la card.

### Idées
* Prise en charge par le dashboard de futures caméras.
* Système d'alarme
* Robot aspirateur
* Consommation eau et chauffage


<!-- MARKDOWN LINKS & IMAGES -->
[dashboard]: /images/dashboard.jpg
[media-player-control]: /images/media-player-control.jpg
[spotify-active]: /images/spotify-active.jpg
[spotify-card]: /images/spotify-card.jpg
[spotify-popup]: /images/spotify-popup.jpg
[tablette-jour]: /images/tablette-jour.jpg
[tablette-nuit]: /images/tablette-nuit.jpg
[thermometre-popup]: /images/thermometre-popup.jpg
[thermometre]: /images/thermometre.gif
[automation-popup]: /images/automation-popup.jpg
[bouton-snapshot]: images/bouton-snapshot.jpg
[weather]: images/weather.jpg
