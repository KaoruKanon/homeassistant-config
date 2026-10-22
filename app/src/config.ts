// House-specific settings. Rooms come from Home Assistant areas; this file
// only adds what the registry cannot say. Patterns accept `*` wildcards.

export interface PersonSettings {
  /** Areas shown first on the home view for this person. */
  favoriteRooms?: string[];
  /** Devices shown in "Pour toi" on the home view. */
  shortcuts?: string[];
}

export interface KaoruHomeConfig {
  /** Entities never shown in rooms. */
  hide: string[];
  /** Entities whose toggle asks for confirmation first. */
  confirm: string[];
  /** Display names that replace the friendly name. */
  names: Record<string, string>;
  /** Weather entities, first available wins. */
  weather: string[];
  /** Area order on the home view; unlisted areas follow by name. */
  roomOrder: string[];
  /** Icons for areas that have none in Home Assistant. */
  roomIcons: Record<string, string>;
  /** Keyed by person entity id without the `person.` prefix. */
  people: Record<string, PersonSettings>;
}

export const config: KaoruHomeConfig = {
  hide: [
    "light.*_screen", // browser_mod screens
    "switch.*_child_lock*",
  ],
  // The Tuya plugs power the homelab: one wrong tap can switch it off.
  confirm: ["switch.smart_plug_*", "switch.prise_protegee"],
  names: {
    "light.switch_wall_*": "Lumière",
    "light.chambre": "Lumières de la chambre",
    "media_player.spotify": "Spotify",
    "media_player.google_home_chambre": "Enceinte chambre",
    "media_player.google_home_cuisine": "Enceinte cuisine",
    "switch.smart_plug_homelab_switch": "Homelab",
    "switch.smart_plug_shiro_switch": "Shiro",
    "switch.smart_plug_spare_switch": "Prise d'appoint",
  },
  weather: ["weather.meteo_france", "weather.openweathermap"],
  roomOrder: [
    "salon",
    "cuisine",
    "chambre_william",
    "chambre_papa",
    "salle_de_bain",
    "toilette",
    "couloir",
  ],
  roomIcons: {
    salon: "mdi:sofa-outline",
    cuisine: "mdi:silverware-fork-knife",
    chambre_william: "mdi:bed-outline",
    chambre_papa: "mdi:bed-outline",
    salle_de_bain: "mdi:shower",
    toilette: "mdi:toilet",
    couloir: "mdi:door-open",
    labo: "mdi:flask-outline",
  },
  people: {
    kaoru: {
      favoriteRooms: ["chambre_william"],
      shortcuts: ["light.chambre", "media_player.spotify", "media_player.google_home_chambre"],
    },
    papa: {
      favoriteRooms: ["chambre_papa"],
      shortcuts: ["light.switch_wall_chambre_papa", "media_player.samsung_tv_papa"],
    },
  },
};
