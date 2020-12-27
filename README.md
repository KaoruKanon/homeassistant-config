# Home assistant configuration 
[![Demandez moi n'importe quoi !](https://img.shields.io/badge/Demandez%20moi-n'%20importe%20quoi-1abc9c.svg)](https://github.com/KaoruKanon/homeassistant-config) [![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://GitHub.com/Naereen/StrapDown.js/graphs/commit-activity) [![Twitter](https://img.shields.io/twitter/follow/kaorussh?style=social)](https://twitter.com/kaorussh)   [![GitHub stars](https://img.shields.io/github/stars/KaoruKanon/homeassistant-config?style=social)](https://github.com/KaoruKanon/homeassistant-config)




Bienvenue sur le repo github de ma configuration d'home assistant. Cette configuration est basée sur celle de matt8707 [ [github](https://github.com/matt8707/hass-config) / [forum anglais](https://community.home-assistant.io/t/a-different-take-on-designing-a-lovelace-ui/162594) ] 

Mon Home assistant tourne sous un raspberry pi 3B+, avec lequel j'utilise une tablette Lenovo wall mounted, avec un chageur magnétique. Tout comme matt87087, j'utilise [applicationize](https://applicationize.me/) pour crée une webapp sous chrome en mode kiosk.

N'hésitez à mettre une ⭐ sur mon repo. 
* [![Twitter](https://img.shields.io/twitter/follow/kaorussh?style=social)](https://twitter.com/kaorussh) 
* [Profil HACF](https://forum.hacf.fr/u/kaoru)
* [Topic de mon dashboard sur HACF](https://forum.hacf.fr/t/mon-dashboard-kaoru/1022)

![dashboard]
![tablette-jour]



## Equipement et configuration 

- HASS supervised tourne sur mon Raspberry 3B+
- 6 ampoules yeelight
- 5 Xiaomi mijia Temperature Humidity 2019
- 3 Xiaomi Mi Wireless Switch
- Xiaomi Gateway V2
- tablette Lenovo TAB M10+ avec Fully Kiosk Browser 

D'autres ampoules et boutons sans-fil devraient arriver d'ici quelques semaines pour terminer la domotisation des lumières 



## Les fonctionnalités créées par moi.
Je vous invite à consulter son repo github pour y voir les fonctionalités de bases proposées par son dashboard. J'ai créé de nouvelles fonctionallités pour répondre à mes besoins.

### Card de mes thermomètre 
Card des thermomètre basé sur le design des boutons. Il affiche le graph de la température des 12 dernières heures. Le popup avec témpérature et humidité à l'instant T, avec un graphique des 48 dernières heures.

![thermometre]
<img src="/images/thermometre-popup.jpg" height="367">

### Media
* Intégration officielle de spotify en tant que mediaplayer pour l'ajouter avec les chromecast des medias. Popup avec l'utilisation du frontend [Spotify Lovelace Card](https://github.com/custom-cards/spotify-card) pour lancer une playlist sur une chromecast. Fonctionne grâce au custom component [Start Spotify on chromecast](https://github.com/fondberg/spotcast)

<img src="/images/spotify-card.jpg" height="130"> <img src="/images/spotify-active.jpg" height="130">

<img src="/images/spotify-popup.jpg" height="366">

* Popup qui permet de contrôler le volume ou skip la musique sur les chromecast. 

<img src="/images/media-player-control.jpg" height="200">

### Popup automation 
Popup via le bouton Partir, qui permet via un switch de couper l'automation qui éteint les lumières quand nous sommes absents tous les deux. 

<img src="/images/automation-popup.jpg" height="200">

### Bouton et automation des snapshots.
J'ai ajouté dans le popup information un bouton pour faire un snapshot manuelle depuis le dashboard. J'ai également mis en place une automation qui fait un snapshot tous les jours à miniuit. 

<img src="/images/bouton-snapshot.jpg" height="300">

### Afficher le timer en cours du google home de la cuisne
J'utilise le travail de [chvancooten](https://github.com/chvancooten/homeassistant-googletokenretriever) pour récupérer le miniteur du google home. 

## Ma façon d'implémenter son code
L'auteur est suédois et nous n'avons pas les mêmes équipements.

### Consomation électrique

Pour la consommation électrique, j'utilise le custom component [myEnedis](https://github.com/saniho/apiEnedis). L'auteur utilise un script python qui va chercher sa consommation chez son fourniseur et rempli un fichier dont le contenu est lu par home assistant. La consommation de chaque mois est découpé par un capteur. Il y a donc 12 capteurs utilisés utilisé par son popup consomation. Pour garder sa base, j'ai créé un script python qui garde le même principe, mais récupère la consomation du sensor myEnedis avec l'api de Home assistant. Je sais dit comme ça, c'est un peu particulier.

Home Assistant lance le script toutes les heures via une automation. 

### Météo 

Météo avec l'api MétéoFrance et son intégration officiel. 

### Monitoring des PC

Utilisation de [IOT Link](https://iotlink.gitlab.io/) pour contrôler les PC sous Windows car matt8707 est sous mac et utilise du SSH. 

## TODO et idées..

### Implémentations restantes à finir
* Terminer le popup consomation électrique (calculer coût et bouton pour lancer manuellement le rafraichissement de la consomation electrique).
* Ajouter la tv samsung.
* Find my phone rencontre des problèmes.


### Problèmes
* Téléphone connecté ou non au wifi de la maison avec le popup de la personne dans la section Maison.
* Notifications de mise à jour de HASS, etc...
* Améliorer la carte thermomètre : En cas de forte différence de température entre le minimum et le maximum, la courbe est coupée par la card.

### Idées
* Batterie des capteurs et ping des équipements réseaux.
* QR code pour le Wifi.
* Version mobile.
* Prise en charge par le dashboard de futures caméras.



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
