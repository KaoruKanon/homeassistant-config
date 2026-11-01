import { html, nothing } from "lit";
import { openMoreInfo, pressButton, refresh, ringPhone, setAlarm, setNumber, toggle, triggerAutomation, type AlarmMode } from "../actions.ts";
import "../components/sparkline.ts";
import { action, bigSlider, glyph, label, openPopup, refreshPopup, row, toneOf } from "../components/popup.ts";
import { config, type Computer, type Favorite } from "../config.ts";
import { ago, alarmLook, formatNumber, isActive, isUnavailable, stateLabel } from "../format.ts";
import { store } from "../store.ts";
import type { HassEntity } from "../types.ts";
import "../v3/map.ts";
import { objectIcon, type MapMarker, type MapZone } from "../v3/map.ts";

// Details popups, rebuilt from the old browser_mod popups (popup/*.yaml),
// in the V3 design. Downloaded on the first tap, through ./open.ts.

export { ago, alarmLook };

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const st = (id?: string) => (id ? store.hass?.states[id] : undefined);

const sinceText = (iso?: string) => (iso ? `depuis ${ago(iso).replace("il y a ", "")}` : "");

/** One figure: icon, label, value (greyed when unavailable). */
function stat(iconName: string, color: string, text: string, s?: HassEntity) {
  const off = isUnavailable(s);
  return html`<div class="stat ${off ? "off" : ""} t-${toneOf(color)}">
    <span class="top"><span class="ico">${glyph(iconName, 18)}</span><span class="st ell">${text}</span></span>
    <b class="num ell">${off ? "Indisponible" : stateLabel(store.hass!, s)}</b>
  </div>`;
}

/** A usage meter (CPU, RAM, disk...); a tap asks for a fresh value. */
function meter(text: string, entity: string) {
  const v = Number(st(entity)?.state);
  const color = isNaN(v) ? "grey" : v > 85 ? "red" : v > 65 ? "amber" : "teal";
  return html`<button class="meter t-${color}" type="button" aria-label="${text} : ${isNaN(v) ? "inconnu" : `${formatNumber(v, 0)} %`}. Actualiser"
    @click=${() => refresh([entity])}>
    <span class="top" aria-hidden="true"><span>${text}</span><span class="num">${isNaN(v) ? "—" : `${formatNumber(v, 0)} %`}</span></span>
    <span class="track" aria-hidden="true"><span class="fill" style="width:${isNaN(v) ? 0 : Math.min(100, v)}%"></span></span>
  </button>`;
}

/** PC: state, CPU / RAM / disks, uptime, lock, live screenshot, sleep / reboot / start. */
export function openComputer(c: Computer): void {
  openPopup({
    title: c.name,
    icon: "monitor",
    color: "blue",
    subtitle: () => {
      const s = st(c.entity);
      return s ? `${isActive(s) ? "Allumé" : "Éteint"} ${sinceText(s.last_changed)}` : undefined;
    },
    watch: [c.entity, c.busy, c.uptime, c.lock, c.camera, ...(c.stats ?? []).map((s) => s.entity)].filter((x): x is string => !!x),
    body: () => {
      const s = st(c.entity);
      const on = isActive(s);
      const busy = isActive(st(c.busy));
      const locked = isActive(st(c.lock));
      const cam = st(c.camera);
      return html`
        ${row({
          icon: "power",
          color: on ? "green" : "grey",
          label: busy ? "Démarrage ou arrêt en cours…" : on ? "Allumé" : "Éteint",
          sub: s ? sinceText(s.last_changed) : undefined,
          lit: on,
          big: true,
        })}
        ${on && c.stats?.length ? html`<div class="grid2">${c.stats.map((x) => meter(x.label, x.entity))}</div>` : nothing}
        ${on && c.uptime ? row({ icon: "timer", color: "indigo", label: "Allumé depuis", value: stateLabel(store.hass!, st(c.uptime)) }) : nothing}
        ${c.lock
          ? row({
              icon: locked ? "lock" : "unlock",
              color: locked ? "red" : "grey",
              label: "Verrou",
              sub: "Empêche l'extinction depuis Home Assistant",
              checked: locked,
              onClick: () => toggle(c.lock!, "le verrou"),
            })
          : nothing}
        ${on && cam && !isUnavailable(cam)
          ? html`<button class="shot" type="button" aria-label="Nouvelle capture d'écran de ${c.name}" @click=${() => c.screenshot && triggerAutomation(c.screenshot)}>
              <img src=${cam.attributes.entity_picture} alt="Capture d'écran de ${c.name}" />
              ${c.screenshot ? html`<span class="cap" aria-hidden="true">${glyph("camera", 14)}Nouvelle capture</span>` : nothing}
            </button>`
          : nothing}
        <div class="acts">
          ${on
            ? html`${c.sleep ? action("Mettre en veille", "moon", "indigo", () => toggle(c.sleep!, `la veille de ${c.name}`)) : nothing}
              ${c.reboot ? action("Redémarrer", "refresh", "orange", () => toggle(c.reboot!, `le redémarrage de ${c.name}`)) : nothing}`
            : c.wake
              ? action(`Démarrer ${c.name}`, "power", "green", () => toggle(c.wake!, c.name), true)
              : nothing}
        </div>
      `;
    },
  });
}

/** Position of an entity (person or tracker), if it has one. */
function coords(...states: (HassEntity | undefined)[]) {
  for (const s of states) {
    const lat = Number(s?.attributes.latitude), lon = Number(s?.attributes.longitude);
    if (isFinite(lat) && isFinite(lon) && s?.attributes.latitude !== undefined) return { lat, lon, accuracy: Number(s.attributes.gps_accuracy) || undefined };
  }
  return undefined;
}

/** The home zone, drawn on the maps. */
function homeZone(): MapZone[] {
  const z = st("zone.home");
  const c = coords(z);
  return c ? [{ lat: c.lat, lon: c.lon, radius: Number(z!.attributes.radius) || 100, label: "Maison" }] : [];
}

/** The shared V3 map with one marker (and the home zone). */
function where(marker?: MapMarker) {
  return marker
    ? html`<kh3-map class="pmap" label="Carte : ${marker.label}" reset-label="Recentrer" .markers=${[marker]} .zones=${homeZone()}></kh3-map>`
    : nothing;
}

function directions(main?: HassEntity, fallback?: HassEntity) {
  const c = coords(main, fallback);
  return c
    ? html`<a class="act t-blue" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lon}"
        >${glyph("directions", 18)}Itinéraire</a
      >`
    : nothing;
}

/** Person: where, since when, GPS and Wi-Fi, map, directions, "find my phone". */
export function openPerson(personKey: string): void {
  const id = `person.${personKey}`;
  const phone = config.people[personKey]?.phone;
  const name = () => capitalize(String(st(id)?.attributes.friendly_name ?? personKey));
  let rung = false;
  openPopup({
    title: name(),
    icon: "user",
    color: "green",
    picture: () => {
      const p = st(id);
      return { src: p?.attributes.entity_picture as string | undefined, initial: name().charAt(0), home: p?.state === "home" };
    },
    subtitle: () => {
      const p = st(id);
      return p ? `${p.state === "home" ? "À la maison" : stateLabel(store.hass!, p)} ${sinceText(p.last_changed)}` : undefined;
    },
    watch: [id, phone?.tracker, phone?.ping, "zone.home"].filter((x): x is string => !!x),
    body: () => {
      const p = st(id);
      const home = p?.state === "home";
      const gps = st(phone?.tracker);
      const wifi = st(phone?.ping);
      const c = coords(p, gps);
      return html`
        ${row({
          icon: home ? "home" : "pin",
          color: home ? "green" : "amber",
          label: home ? "À la maison" : stateLabel(store.hass!, p),
          sub: p ? sinceText(p.last_changed) : undefined,
          lit: true,
          big: true,
        })}
        ${c
          ? where({ id, lat: c.lat, lon: c.lon, label: name(), kind: "person", image: p?.attributes.entity_picture as string | undefined, home })
          : nothing}
        ${gps ? row({ icon: "gps", color: "blue", label: "GPS", sub: ago(gps.last_changed), value: stateLabel(store.hass!, gps) }) : nothing}
        ${wifi ? row({ icon: "wifi", color: isActive(wifi) ? "green" : "grey", label: "Wi-Fi de la maison", value: isActive(wifi) ? "Connecté" : "Absent" }) : nothing}
        <div class="acts">
          ${directions(p, gps)}
          ${phone?.notify
            ? html`${action(rung ? "Ça sonne" : "Trouver le téléphone", rung ? "check" : "bell", "red", () => {
                  void ringPhone(phone.notify!);
                  rung = true;
                  refreshPopup();
                })}
                <span class="sr" aria-live="polite">${rung ? `Le téléphone de ${name()} sonne` : ""}</span>`
            : nothing}
        </div>
      `;
    },
  });
}

/** A tracked object (Tile tag, phone...): where it is, since when, its accuracy. */
export function openTracker(id: string, mdi = "mdi:map-marker"): void {
  const t = config.system.trackers.find((x) => x.entity === id);
  const name = t?.name ?? capitalize(String(st(id)?.attributes.friendly_name ?? id));
  const iconName = objectIcon(t?.icon ?? mdi);
  openPopup({
    title: name,
    icon: iconName,
    color: "orange",
    subtitle: () => {
      const s = st(id);
      return s ? `Vu ${ago((s.attributes.last_seen as string | undefined) ?? s.last_updated)}` : undefined;
    },
    watch: [id, "zone.home"],
    body: () => {
      const s = st(id);
      if (!s) return nothing;
      const home = s.state === "home";
      const lost = !!s.attributes.is_lost;
      const acc = Number(s.attributes.gps_accuracy);
      const c = coords(s);
      return html`
        ${row({
          icon: home ? "home" : "pin",
          color: home ? "green" : "orange",
          label: home ? "À la maison" : s.state === "not_home" ? "Ailleurs" : stateLabel(store.hass!, s),
          sub: `vu ${ago((s.attributes.last_seen as string | undefined) ?? s.last_updated)}${isFinite(acc) ? `, précision ${formatNumber(acc, 0)} m` : ""}`,
          lit: true,
          big: true,
        })}
        ${lost ? row({ icon: "alert", color: "red", label: "Signalé perdu", lit: true }) : nothing}
        ${c
          ? where({ id, lat: c.lat, lon: c.lon, label: name, kind: "object", icon: iconName, home, tone: lost ? "red" : home ? "teal" : "amber" })
          : nothing}
        <div class="acts">${directions(s)}</div>
      `;
    },
  });
}

/** Room thermometer: values, battery, 24 h graph. */
export function openThermometer(spec: Extract<Favorite, { type: "thermometer" }>): void {
  openPopup({
    title: spec.name,
    icon: "thermo",
    color: "amber",
    watch: [spec.temperature, spec.humidity, spec.battery].filter((x): x is string => !!x),
    body: () => html`
      <div class="stats">
        ${stat("thermo", "orange", "Température", st(spec.temperature))}
        ${spec.humidity ? stat("drop", "blue", "Humidité", st(spec.humidity)) : nothing}
        ${spec.battery ? stat("battery", "green", "Pile", st(spec.battery)) : nothing}
      </div>
      ${label("24 heures")}
      <kh-sparkline
        .entities=${[
          { entity: spec.temperature, label: "Température", color: "var(--rgb-orange)", unit: "°C" },
          ...(spec.humidity ? [{ entity: spec.humidity, label: "Humidité", color: "var(--rgb-light-blue)", unit: "%" }] : []),
        ]}
      ></kh-sparkline>
    `,
  });
}

/** Windows and doors: which are open, since when. */
export function openOpenings(ids: string[]): void {
  openPopup({
    title: "Fenêtres et portes",
    icon: "window",
    color: "red",
    subtitle: () => {
      const n = ids.filter((id) => isActive(st(id))).length;
      return n ? `${n} ouverte${n > 1 ? "s" : ""}` : "Tout est fermé";
    },
    watch: ids,
    body: () =>
      html`${ids
        .map((id) => st(id))
        .filter((s): s is HassEntity => !!s)
        .sort((a, b) => Number(isActive(b)) - Number(isActive(a)))
        .map((s) =>
          row({
            icon: s.entity_id.includes("door") || s.attributes.device_class === "door" ? "door" : "window",
            color: isActive(s) ? "red" : "green",
            label: String(s.attributes.friendly_name ?? s.entity_id).replaceAll("_", " "),
            sub: ago(s.last_changed),
            value: stateLabel(store.hass!, s),
            lit: isActive(s),
            chevron: true,
            onClick: () => openMoreInfo(document.body, s.entity_id),
          }),
        )}`,
  });
}

/** Wi-Fi QR code for guests. */
export function openWifiQr(): void {
  openPopup({
    title: "Wi-Fi de la maison",
    icon: "wifi",
    color: "teal",
    subtitle: () => "Pour les invités",
    watch: [],
    body: () => html`
      <div class="qr"><img src=${config.home.wifiQr} alt="QR code du Wi-Fi" /></div>
      <p class="since" style="text-align:center">Scanne le code avec l'appareil photo pour rejoindre le Wi-Fi.</p>
    `,
  });
}

/** A Jellyfin item: artwork, summary, rating, genres, runtime. */
export function openMediaItem(item: Record<string, any>): void {
  const meta = [item.number, item.episode, item.rating, item.runtime ? `${item.runtime} min` : ""]
    .concat(String(item.genres ?? "").split(/,\s*/))
    .filter(Boolean);
  openPopup({
    title: item.title,
    icon: "film",
    color: "purple",
    watch: [],
    body: () => html`
      ${item.fanart || item.poster ? html`<img class="cover" src=${item.fanart || item.poster} alt="" />` : nothing}
      ${meta.length ? html`<div class="chips">${meta.map((m) => html`<span class="chip">${m}</span>`)}</div>` : nothing}
      ${item.summary ? html`<p class="text">${item.summary}</p>` : nothing}
    `,
  });
}

/** Wall tablet (Fully Kiosk): screen, brightness, screensaver, battery, browser. */
export function openTablet(): void {
  const t = config.system.tablet;
  if (!t) return;
  openPopup({
    title: t.name,
    icon: "tablet",
    color: "indigo",
    watch: [t.screen, t.brightness, t.screensaver, t.plugged, t.battery, t.memory, t.storage].filter((x): x is string => !!x),
    body: () => {
      const hass = store.hass!;
      const screenOn = isActive(st(t.screen));
      const bright = Number(st(t.brightness)?.state);
      const plugged = isActive(st(t.plugged));
      return html`
        ${row({ icon: "tablet", color: "indigo", label: "Écran", sub: screenOn ? "Allumé" : "Éteint", checked: screenOn, onClick: () => toggle(t.screen, "l'écran"), big: true })}
        ${t.brightness && !isNaN(bright)
          ? bigSlider({
              label: "Luminosité",
              icon: "sun",
              min: 0,
              max: 255,
              raw: bright,
              pct: (v) => (v / 255) * 100,
              on: true,
              onChange: (v) => setNumber(t.brightness!, v),
            })
          : nothing}
        ${t.screensaver
          ? row({
              icon: "moon",
              color: "purple",
              label: "Économiseur d'écran",
              sub: isActive(st(t.screensaver)) ? "Actif" : "Inactif",
              checked: isActive(st(t.screensaver)),
              onClick: () => toggle(t.screensaver!, "l'économiseur"),
            })
          : nothing}
        ${t.battery ? row({ icon: plugged ? "plug" : "battery", color: "green", label: "Batterie", sub: plugged ? "Branchée" : "Sur batterie", value: stateLabel(hass, st(t.battery)) }) : nothing}
        ${t.memory || t.storage ? html`<div class="grid2">${t.memory ? meter("Mémoire", t.memory) : nothing}${t.storage ? meter("Stockage", t.storage) : nothing}</div>` : nothing}
        <div class="acts">
          ${t.reload ? action("Recharger", "refresh", "blue", () => pressButton(t.reload!)) : nothing}
          ${t.restartBrowser ? action("Redémarrer le navigateur", "power", "orange", () => pressButton(t.restartBrowser!)) : nothing}
        </div>
      `;
    },
  });
}

const ALARM_MODES: { mode: AlarmMode; bit: number; label: string; icon: string }[] = [
  { mode: "arm_away", bit: 2, label: "Absence", icon: "leave" },
  { mode: "arm_home", bit: 1, label: "Maison", icon: "home" },
  { mode: "arm_night", bit: 4, label: "Nuit", icon: "moon" },
  { mode: "arm_vacation", bit: 32, label: "Vacances", icon: "sun" },
];

/** Alarm: its state, the arming modes it supports, disarm, and a keypad when it needs a code. */
export function openAlarm(id: string): void {
  let code = "";
  openPopup({
    title: capitalize(String(st(id)?.attributes.friendly_name ?? "Alarme")),
    icon: "shield",
    color: "red",
    subtitle: () => {
      const s = st(id);
      return s ? `${alarmLook(s.state).label} ${sinceText(s.last_changed)}` : undefined;
    },
    watch: [id],
    body: () => {
      const s = st(id);
      if (!s) return nothing;
      const look = alarmLook(s.state);
      const features = Number(s.attributes.supported_features ?? 0);
      const format = s.attributes.code_format as string | null | undefined;
      const armed = s.state !== "disarmed";
      const needsCode = !!format && (armed || s.attributes.code_arm_required !== false);
      const send = async (mode: AlarmMode) => {
        await setAlarm(id, mode, needsCode ? code : undefined);
        code = "";
        refreshPopup();
      };
      const key = (k: string) => {
        code = k === "⌫" ? code.slice(0, -1) : (code + k).slice(0, 12);
        refreshPopup();
      };
      return html`
        ${row({ icon: look.icon, color: look.color, label: look.label, sub: sinceText(s.last_changed), lit: look.color !== "grey", big: true })}
        ${needsCode
          ? html`<div class="code" role="status" aria-live="polite" aria-label=${code ? `${code.length} chiffre${code.length > 1 ? "s" : ""} saisi${code.length > 1 ? "s" : ""}` : "Code vide"}>
                ${code ? "•".repeat(code.length) : html`<span class="ph">Code</span>`}
              </div>
              ${format === "number"
                ? html`<div class="keypad" role="group" aria-label="Clavier du code">
                    ${["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0"].map(
                      (k) => html`<button class="key" type="button" aria-label=${k === "⌫" ? "Effacer" : k} @click=${() => key(k)}>
                        ${k === "⌫" ? glyph("backspace", 24) : k}</button>`,
                    )}
                  </div>`
                : html`<input class="code-input" type="password" autocomplete="off" placeholder="Code" aria-label="Code de l'alarme" .value=${code}
                    @input=${(e: Event) => (code = (e.target as HTMLInputElement).value)} />`}`
          : nothing}
        ${armed
          ? action("Désarmer", "shieldOff", "orange", () => send("disarm"))
          : html`<div class="grid2">
              ${ALARM_MODES.filter((m) => features & m.bit).map((m) => action(m.label, m.icon, "green", () => send(m.mode)))}
            </div>`}
      `;
    },
  });
}
