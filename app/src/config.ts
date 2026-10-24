// House-specific settings. Rooms come from Home Assistant areas; this file
// adds what the registry cannot say and describes the home view, after the
// old Lovelace dashboard. Patterns accept `*` wildcards.

/** One block of the per-person "Favoris" section. */
export type Favorite =
  | { type: "battery"; name: string; entity: string; charging?: string }
  | { type: "jellyfin" }
  | { type: "calendar"; entities: string[] }
  | { type: "thermometer"; name: string; temperature: string; humidity?: string; battery?: string }
  | { type: "computers" }
  | { type: "automation"; name: string; entity: string };

export interface PersonSettings {
  /** Areas shown first in Maison for this person. */
  favoriteRooms?: string[];
  /** The "Favoris" section of the home view, in order. */
  favorites?: Favorite[];
  /** Not a resident (e.g. the wall tablet's account): no presence chip. */
  device?: boolean;
  /** Person popup: phone tracking and "find my phone". */
  phone?: Phone;
}

export interface HomeLight {
  entity: string;
  name: string;
  icon?: string;
}

export interface Computer {
  entity: string;
  name: string;
  /** On while the PC is starting or shutting down. */
  busy?: string;
  /** Details popup (long press). */
  stats?: { label: string; entity: string }[];
  uptime?: string;
  lock?: string;
  camera?: string;
  /** Automation that takes a fresh screenshot. */
  screenshot?: string;
  sleep?: string;
  reboot?: string;
  wake?: string;
}

export interface Phone {
  tracker?: string;
  ping?: string;
  /** notify service, e.g. "mobile_app_oneplus12" */
  notify?: string;
}

export interface KaoruHomeConfig {
  /** Entities never shown in rooms. */
  hide: string[];
  /** Entities whose toggle asks for confirmation first. */
  confirm: string[];
  /** Among those, the ones that start without asking (a PC): only turning off is confirmed. */
  confirmOffOnly?: string[];
  /** Display names that replace the friendly name. */
  names: Record<string, string>;
  /** Weather entities, first available wins. */
  weather: string[];
  /** Area order in Maison; unlisted areas follow by name. */
  roomOrder: string[];
  /** Icons for areas that have none in Home Assistant. */
  roomIcons: Record<string, string>;
  /** Keyed by person entity id without the `person.` prefix. */
  people: Record<string, PersonSettings>;
  home: {
    chips: {
      temperature?: string;
      timer?: string;
      timerActive?: string;
      lightsOn?: string;
      windowsOpen?: string;
      alarm?: string;
    };
    spotify?: string;
    tvs: string[];
    lights: HomeLight[];
    computers: Computer[];
    jellyfin?: string;
    energy?: { power: string; today: string; pricePerKwh: number; meter: string };
    forecast?: { sensor: string; source: string };
    frog?: { status: string; image: string; location: string };
    nextRain?: string;
    outdoorTemperature?: string;
    /** `home: true` = also on the home view (the rest on Météo). */
    stocks: { entity: string; name: string; home?: boolean }[];
    leave?: string;
    wifiQr?: string;
  };
  media: {
    speakers: string[];
    box?: {
      player: string;
      remote: string;
      apps: { name: string; icon: string; activity: string; color: string }[];
    };
    jellyfin: { title: string; entity: string }[];
  };
  weatherPage: {
    feelsLike?: string;
    humidity?: string;
    windSpeed?: string;
    windBearing?: string;
    rainChance?: string;
    uv?: string;
    cloudCover?: string;
    moon?: string;
    hourly?: string;
    windy?: { lat: number; lon: number };
  };
  energyPage: {
    plugs: string[];
    spare?: {
      plug: string;
      name: string;
      duration: string;
      increment: string;
      decrement: string;
      remaining: string;
      power?: string;
      autoOff: string;
    };
    fans: string[];
  };
  /** The flat's plan (Maison page): which TV and PC sit in which room, by area id. */
  plan?: {
    tvs: Record<string, string>;
    computers: Record<string, string>;
    /** Compass bearing the windows look out to (0 = north, 90 = east…): where the sun comes in. */
    windowsFacing?: number;
    /**
     * Lights shown one by one on the plan, by room (plan units): a ceiling
     * light or a lamp at a point, a LED strip between two points. They also
     * count as the room's lights for its bulb.
     */
    lights?: Record<string, { entity: string; kind: "ceiling" | "spot" | "lamp" | "strip"; at: [number, number]; to?: [number, number] }[]>;
  };
  system: {
    trackers: { entity: string; name: string; icon: string }[];
    speedtest?: { download: string; upload: string; ping: string; run?: string };
    ethernet?: { in: string; out: string };
    ha: { disk?: string; memory?: string; cpu?: string; lastBoot?: string };
    tablet?: {
      name: string;
      screen: string;
      brightness?: string;
      screensaver?: string;
      plugged?: string;
      battery?: string;
      memory?: string;
      storage?: string;
      reload?: string;
      restartBrowser?: string;
    };
    backups?: { last: string; next: string; state: string };
    automations: { entity: string; name: string }[];
  };
}

export const config: KaoruHomeConfig = {
  hide: [
    "light.*_screen", // browser_mod screens
    "switch.*_child_lock*",
    // Wall switches not used (the kitchen, toilet and bathroom ones are).
    "light.switch_wall_chambre_papa",
    "light.*_wall",
  ],
  // The Tuya plugs power the homelab: one wrong tap can switch it off.
  // The PCs: a tap on the wall tablet must not shut one down by accident.
  confirm: [
    "switch.smart_plug_*",
    "switch.prise_protegee",
    "switch.computer_*",
    "switch.*_sleep",
    "switch.*_reboot",
    "switch.wol_*",
  ],
  confirmOffOnly: ["switch.computer_*", "switch.wol_*"],
  names: {
    "light.switch_wall_*": "Plafonnier",
    "light.chambre": "Chambre",
    "media_player.spotify": "Spotify",
    "media_player.google_home_*": "Enceinte",
    "switch.smart_plug_homelab_switch": "Homelab",
    "switch.smart_plug_shiro_switch": "Shiro",
    "switch.smart_plug_spare_switch": "Trottinette",
  },
  weather: ["weather.meteo_france", "weather.openweathermap"],
  roomOrder: ["salon", "cuisine", "chambre_william", "chambre_papa", "salle_de_bain", "toilette", "couloir"],
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
      phone: { tracker: "device_tracker.oneplus12", ping: "binary_sensor.ping_oneplus12", notify: "mobile_app_oneplus12" },
      favorites: [
        { type: "battery", name: "OnePlus 12", entity: "sensor.oneplus12_battery_level", charging: "binary_sensor.oneplus12_is_charging" },
        { type: "jellyfin" },
        { type: "calendar", entities: ["calendar.main", "calendar.anniversaires", "calendar.les_amoureux"] },
        {
          type: "thermometer",
          name: "Chambre",
          temperature: "sensor.thermometer_chambre_william_temperature",
          humidity: "sensor.thermometer_chambre_william_humidite",
          battery: "sensor.thermometer_chambre_william_batterie",
        },
        { type: "computers" },
        { type: "automation", name: "Couper en partant", entity: "automation.turn_off_gps_william_absence" },
      ],
    },
    papa: {
      favoriteRooms: ["chambre_papa"],
      phone: { tracker: "device_tracker.samsung_s24", ping: "binary_sensor.ping_samsung_s24", notify: "mobile_app_samsung_s24" },
      favorites: [
        // the old dashboard read an S10e here: the S24 is the current phone
        { type: "battery", name: "Samsung S24", entity: "sensor.samsung_s24_battery_level", charging: "binary_sensor.samsung_s24_is_charging" },
        { type: "computers" },
      ],
    },
    tablet: {
      device: true,
      favorites: [{ type: "jellyfin" }, { type: "computers" }],
    },
  },
  home: {
    chips: {
      temperature: "sensor.average_temperature",
      timer: "sensor.next_timer_cuisine_remaining",
      timerActive: "timer.timer_cuisine",
      lightsOn: "sensor.total_lights_on",
      windowsOpen: "sensor.total_open_windows",
      alarm: "alarm_control_panel.home_alarm",
    },
    spotify: "media_player.spotify",
    tvs: ["media_player.samsung_tv_salon", "media_player.samsung_tv_papa"],
    lights: [
      { entity: "light.plafond", name: "Plafond", icon: "mdi:ceiling-light" },
      { entity: "light.chambre", name: "Chambre", icon: "mdi:bed-king-outline" },
      { entity: "light.bureau", name: "Bureau", icon: "mdi:desk-lamp" },
      { entity: "light.switch_wall_cuisine", name: "Cuisine", icon: "mdi:silverware-fork-knife" },
      { entity: "light.switch_wall_toilette", name: "Toilette", icon: "mdi:toilet" },
      { entity: "light.switch_wall_salle_de_bain", name: "Salle de bain", icon: "mdi:shower" },
    ],
    computers: [
      {
        entity: "switch.computer_rig_kaoru",
        name: "Kaoru RIG",
        busy: "input_boolean.computer_rig_kaoru_load",
        stats: [
          { label: "Processeur", entity: "sensor.rig_kaoru_cpuload" },
          { label: "Mémoire", entity: "sensor.rig_kaoru_memoryusage" },
          { label: "Disque C", entity: "sensor.rig_kaoru_storage_c_used_space_percentage" },
          { label: "Disque D", entity: "sensor.rig_kaoru_storage_d_used_space_percentage" },
          { label: "Disque G", entity: "sensor.rig_kaoru_storage_g_used_space_percentage" },
        ],
        uptime: "sensor.rig_kaoru_uptime",
        lock: "input_boolean.computer_rig_kaoru_lock",
        camera: "camera.rig_kaoru",
        screenshot: "automation.rig_kaoru_screenshot",
        sleep: "switch.rig_kaoru_sleep",
        reboot: "switch.rig_kaoru_reboot",
        wake: "switch.wol_rig_kaoru",
      },
      {
        entity: "switch.computer_papa",
        name: "Papa PC",
        busy: "input_boolean.computer_papa_load",
        stats: [
          { label: "Mémoire", entity: "sensor.bruno_memoryusage" },
          { label: "Disque C", entity: "sensor.bruno_storage_c_used_space_percentage" },
          { label: "Disque D", entity: "sensor.bruno_storage_d_used_space_percentage" },
        ],
        uptime: "sensor.bruno_uptime",
        lock: "input_boolean.computer_papa_lock",
        camera: "camera.bruno",
        screenshot: "automation.bruno_screenshot",
        sleep: "switch.bruno_sleep",
        reboot: "switch.bruno_reboot",
        wake: "switch.wol_papa",
      },
    ],
    jellyfin: "sensor.jelly_jellyfin_recently_added",
    energy: {
      power: "sensor.lixee_zlinky_tic_apparent_power",
      today: "sensor.daily_energy",
      pricePerKwh: 0.2276,
      meter: "sensor.lixee_zlinky_tic_summation_delivered",
    },
    forecast: { sensor: "sensor.weather_forecast_daily", source: "weather.openweathermap" },
    frog: {
      status: "sensor.weather_frog_status",
      image: "sensor.weather_frog_image_wide",
      location: "sensor.weather_frog_location",
    },
    nextRain: "sensor.meteo_france_next_rain",
    outdoorTemperature: "sensor.openweathermap_temperature",
    stocks: [
      { entity: "sensor.yahoofinance_sxr8_de", name: "ETF S&P 500", home: true },
      { entity: "sensor.yahoofinance_aapl", name: "Apple" },
      { entity: "sensor.yahoofinance_nvda", name: "Nvidia" },
      { entity: "sensor.yahoofinance_ntoa_f", name: "Nintendo" },
      { entity: "sensor.yahoofinance_btc_eur", name: "Bitcoin" },
    ],
    leave: "script.home_leave",
    wifiQr: "/local/qr_wifi.jpg",
  },
  media: {
    speakers: ["media_player.google_home_cuisine", "media_player.google_home_chambre"],
    box: {
      player: "media_player.bouygtel4k",
      remote: "remote.bouygtel4k",
      apps: [
        { name: "YouTube", icon: "mdi:youtube", activity: "https://www.youtube.com", color: "red" },
        { name: "Netflix", icon: "mdi:netflix", activity: "netflix://", color: "red" },
        { name: "Apple TV", icon: "mdi:apple", activity: "https://tv.apple.com", color: "grey" },
        { name: "Spotify", icon: "mdi:spotify", activity: "spotify://", color: "spotify" },
      ],
    },
    jellyfin: [
      { title: "Films", entity: "sensor.jelly_jellyfin_recently_added_movies" },
      { title: "Séries", entity: "sensor.jelly_jellyfin_recently_added_tvshows" },
    ],
  },
  weatherPage: {
    feelsLike: "sensor.openweathermap_feels_like_temperature",
    humidity: "sensor.openweathermap_humidity",
    windSpeed: "sensor.openweathermap_wind_speed",
    windBearing: "sensor.openweathermap_wind_bearing",
    rainChance: "sensor.meteo_france_rain_chance",
    uv: "sensor.openweathermap_uv_index",
    cloudCover: "sensor.meteo_france_cloud_cover",
    moon: "sensor.moon_phase",
    hourly: "weather.openweathermap",
    windy: { lat: 49.966, lon: 2.557 },
  },
  energyPage: {
    plugs: ["switch.smart_plug_homelab_switch", "switch.smart_plug_shiro_switch"],
    spare: {
      plug: "switch.smart_plug_spare_switch",
      name: "Trottinette",
      duration: "input_number.smart_plug_spare_duration",
      increment: "script.smart_plug_spare_duration_increment",
      decrement: "script.smart_plug_spare_duration_decrement",
      remaining: "sensor.smart_plug_spare_remaining_time",
      power: "sensor.smart_plug_spare_active_power",
      autoOff: "automation.turn_off_smart_plug_spare_switch",
    },
    fans: ["fan.xiaomi_smart_fan_2"],
  },
  plan: {
    tvs: { salon: "media_player.samsung_tv_salon", chambre_papa: "media_player.samsung_tv_papa" },
    computers: { salon: "switch.computer_papa", chambre_william: "switch.computer_rig_kaoru" },
    windowsFacing: 225,
    lights: {
      chambre_william: [
        { entity: "light.plafond_1", kind: "spot", at: [420, 835] },
        { entity: "light.plafond_2", kind: "spot", at: [590, 835] },
        // on the desk, right of the two screens, before the tower
        { entity: "light.lampe_japonaise", kind: "lamp", at: [562, 738] },
        { entity: "light.yeelight_stripe", kind: "strip", at: [400, 724], to: [572, 724] },
      ],
    },
  },
  system: {
    trackers: [
      { entity: "device_tracker.cles", name: "Clés", icon: "mdi:key-variant" },
      { entity: "device_tracker.portefeuille", name: "Portefeuille", icon: "mdi:wallet" },
      { entity: "device_tracker.sac_photo", name: "Sac photo", icon: "mdi:camera" },
      { entity: "device_tracker.velo_de_course", name: "Vélo de course", icon: "mdi:bike" },
    ],
    speedtest: {
      download: "sensor.speedtest_download",
      upload: "sensor.speedtest_upload",
      ping: "sensor.speedtest_ping",
      run: "automation.run_speedtest_addon_every_12_hours",
    },
    ethernet: {
      in: "sensor.system_monitor_paquets_entrant_via_enp2s0",
      out: "sensor.system_monitor_paquets_sortants_via_enp2s0",
    },
    ha: {
      disk: "sensor.system_monitor_utilisation_du_disque",
      memory: "sensor.memory_use_percent",
      cpu: "sensor.processor_use",
      lastBoot: "sensor.last_boot",
    },
    tablet: {
      name: "Tablette murale",
      screen: "switch.lenovotab_screen",
      brightness: "number.lenovotab_screen_brightness",
      screensaver: "switch.lenovotab_screensaver",
      plugged: "binary_sensor.lenovotab_plugged_in",
      battery: "sensor.lenovotab_batterie",
      memory: "sensor.template_fullykiosk_memory",
      storage: "sensor.template_fullykiosk_storage",
      reload: "button.lenovotab_load_start_url",
      restartBrowser: "button.lenovotab_restart_browser",
    },
    backups: {
      last: "sensor.backup_derniere_sauvegarde_automatique_reussie",
      next: "sensor.backup_prochaine_sauvegarde_automatique_programmee",
      state: "sensor.backup_etat_du_gestionnaire_de_sauvegarde",
    },
    automations: [
      { entity: "automation.turn_off_gps_william_absence", name: "Kaoru part : couper sa chambre" },
      { entity: "automation.turn_off_gps_papa_absence", name: "Papa part : couper son PC, sa TV, sa lumière" },
      { entity: "automation.turn_off_gps_home_absence", name: "Tout le monde part : tout couper" },
    ],
  },
};
