import { html, nothing } from "lit";
import { openMoreInfo, pressButton, refresh, ringPhone, setAlarm, setNumber, toggle, triggerAutomation, type AlarmMode } from "../actions.ts";
import "../components/mini-map.ts";
import "../components/sparkline.ts";
import { openPopup, refreshPopup } from "../components/popup.ts";
import { config, type Computer, type Favorite } from "../config.ts";
import { ago, alarmLook, formatNumber, isActive, isUnavailable, stateLabel } from "../format.ts";
import { store } from "../store.ts";
import type { HassEntity } from "../types.ts";

// Details popups, rebuilt from the old browser_mod popups (popup/*.yaml).
// Downloaded on the first tap, through ./open.ts.

export { ago, alarmLook };

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const st = (id?: string) => (id ? store.hass?.states[id] : undefined);

function row(icon: string, color: string, label: string, value: string, sub?: string, onClick?: () => void) {
  const content = html`<span class="shape" style="--rgb: var(--rgb-${color})"><ha-icon icon=${icon}></ha-icon></span>
    <div><div class="primary">${label}</div>${sub ? html`<div class="secondary">${sub}</div>` : nothing}</div>
    <span class="value">${value}</span>`;
  return onClick ? html`<button class="row" @click=${onClick}>${content}</button>` : html`<div class="row">${content}</div>`;
}

/** One figure: icon, label, value (greyed when unavailable). */
function stat(icon: string, color: string, label: string, s?: HassEntity) {
  const off = isUnavailable(s);
  return html`<div class="stat" style=${off ? "opacity:.6" : ""}>
    <span class="shape" style="--rgb: var(--rgb-${color})"><ha-icon icon=${icon}></ha-icon></span>
    <span class="secondary">${label}</span>
    <b>${off ? "Indisponible" : stateLabel(store.hass!, s)}</b>
  </div>`;
}

function bar(label: string, entity: string) {
  const v = Number(st(entity)?.state);
  const color = isNaN(v) ? "grey" : v > 85 ? "red" : v > 65 ? "orange" : "green";
  return html`<button class="bar" style="--rgb: var(--rgb-${color})" title="Actualiser" @click=${() => refresh([entity])}>
    <span class="label"><span>${label}</span><span>${isNaN(v) ? "—" : `${formatNumber(v, 0)} %`}</span></span>
    <span class="track"><span class="fill" style="display:block; width:${isNaN(v) ? 0 : Math.min(100, v)}%"></span></span>
  </button>`;
}

/** PC: state, CPU / RAM / disks, uptime, lock, live screenshot, sleep / reboot / start. */
export function openComputer(c: Computer): void {
  openPopup({
    title: c.name,
    icon: "mdi:desktop-tower-monitor",
    color: "blue",
    watch: [c.entity, c.busy, c.uptime, c.lock, c.camera, ...(c.stats ?? []).map((s) => s.entity)].filter((x): x is string => !!x),
    body: () => {
      const s = st(c.entity);
      const on = isActive(s);
      const locked = isActive(st(c.lock));
      const cam = st(c.camera);
      return html`
        ${row("mdi:power", on ? "green" : "grey", on ? "Allumé" : "Éteint", "", s ? `depuis ${ago(s.last_changed).replace("il y a ", "")}` : "")}
        ${on && c.stats?.length ? html`<div class="grid2">${c.stats.map((x) => bar(x.label, x.entity))}</div>` : nothing}
        ${on && c.uptime ? row("mdi:timer-sand", "indigo", "Allumé depuis", stateLabel(store.hass!, st(c.uptime))) : nothing}
        ${c.lock
          ? row(locked ? "mdi:lock" : "mdi:lock-open-variant", locked ? "red" : "grey", "Verrou", locked ? "Activé" : "Désactivé",
              "Empêche l'extinction depuis Home Assistant", () => toggle(c.lock!, "le verrou"))
          : nothing}
        ${on && cam && !isUnavailable(cam)
          ? html`<button title="Nouvelle capture" @click=${() => c.screenshot && triggerAutomation(c.screenshot)}>
              <img class="shot" src=${cam.attributes.entity_picture} alt="Capture d'écran de ${c.name}" />
            </button>`
          : nothing}
        <div class="grid2">
          ${on
            ? html`${c.sleep
                ? html`<button class="action" style="--rgb: var(--rgb-indigo)" @click=${() => toggle(c.sleep!, `la veille de ${c.name}`)}>
                    <ha-icon icon="mdi:power-sleep"></ha-icon>Mettre en veille</button>`
                : nothing}
              ${c.reboot
                ? html`<button class="action" style="--rgb: var(--rgb-orange)" @click=${() => toggle(c.reboot!, `le redémarrage de ${c.name}`)}>
                    <ha-icon icon="mdi:restart"></ha-icon>Redémarrer</button>`
                : nothing}`
            : c.wake
              ? html`<button class="action" style="--rgb: var(--rgb-green)" @click=${() => toggle(c.wake!, c.name)}>
                  <ha-icon icon="mdi:power"></ha-icon>Démarrer ${c.name}</button>`
              : nothing}
        </div>
      `;
    },
  });
}

/** Person: where, since when, GPS and Wi-Fi, history link, "find my phone". */
export function openPerson(personKey: string): void {
  const id = `person.${personKey}`;
  const phone = config.people[personKey]?.phone;
  openPopup({
    title: capitalize(st(id)?.attributes.friendly_name ?? personKey),
    icon: "mdi:account",
    color: "green",
    watch: [id, phone?.tracker, phone?.ping].filter((x): x is string => !!x),
    body: () => {
      const p = st(id);
      const home = p?.state === "home";
      const gps = st(phone?.tracker);
      const wifi = st(phone?.ping);
      return html`
        ${row(home ? "mdi:home-account" : "mdi:map-marker-account", home ? "green" : "red", home ? "À la maison" : stateLabel(store.hass!, p), "",
          p ? `depuis ${ago(p.last_changed).replace("il y a ", "")}` : "")}
        ${gps ? row("mdi:crosshairs-gps", "blue", "GPS", stateLabel(store.hass!, gps), ago(gps.last_changed)) : nothing}
        ${wifi ? row("mdi:wifi", isActive(wifi) ? "green" : "grey", "Wi-Fi de la maison", isActive(wifi) ? "Connecté" : "Absent") : nothing}
        ${where(p, gps)}
        <div class="grid2">
          ${directions(p, gps)}
          ${phone?.notify
            ? html`<button class="action" style="--rgb: var(--rgb-red)" @click=${() => ringPhone(phone.notify!)}>
                <ha-icon icon="mdi:cellphone-sound"></ha-icon>Trouver le téléphone</button>`
            : nothing}
        </div>
      `;
    },
  });
}

/** Map of where an entity (person or tracker) is, with its photo or icon. */
function coords(...states: (HassEntity | undefined)[]) {
  for (const s of states) {
    const lat = Number(s?.attributes.latitude), lon = Number(s?.attributes.longitude);
    if (isFinite(lat) && isFinite(lon) && s?.attributes.latitude !== undefined) return { lat, lon, accuracy: Number(s.attributes.gps_accuracy) || undefined };
  }
  return undefined;
}

function where(main?: HassEntity, fallback?: HassEntity) {
  // The entity that has a position (the person, else its phone's GPS tracker).
  const located = [main, fallback].find((s) => coords(s));
  return located ? html`<kh-mini-map .entities=${[located.entity_id]}></kh-mini-map>` : nothing;
}

function directions(main?: HassEntity, fallback?: HassEntity) {
  const c = coords(main, fallback);
  return c
    ? html`<a class="action" style="--rgb: var(--rgb-blue); text-decoration:none; color:inherit" target="_blank" rel="noopener"
        href="https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lon}"><ha-icon icon="mdi:directions"></ha-icon>Itinéraire</a>`
    : nothing;
}

/** A tracked object (Tile tag, phone...): where it is, since when, its accuracy. */
export function openTracker(id: string, icon = "mdi:map-marker"): void {
  const t = config.system.trackers.find((x) => x.entity === id);
  openPopup({
    title: t?.name ?? capitalize(String(st(id)?.attributes.friendly_name ?? id)),
    icon: t?.icon ?? icon,
    color: "orange",
    watch: [id],
    body: () => {
      const s = st(id);
      if (!s) return nothing;
      const home = s.state === "home";
      const acc = Number(s.attributes.gps_accuracy);
      return html`
        ${row(home ? "mdi:home-map-marker" : "mdi:map-marker-radius", home ? "green" : "orange", home ? "À la maison" : s.state === "not_home" ? "Ailleurs" : stateLabel(store.hass!, s), "",
          `vu ${ago((s.attributes.last_seen as string | undefined) ?? s.last_updated)}${isFinite(acc) ? `, précision ${formatNumber(acc, 0)} m` : ""}`)}
        ${where(s)}
        ${s.attributes.is_lost ? row("mdi:alert", "red", "Signalé perdu", "") : nothing}
        <div class="grid2">${directions(s)}</div>
      `;
    },
  });
}

/** Room thermometer: values, battery, 24 h graph. */
export function openThermometer(spec: Extract<Favorite, { type: "thermometer" }>): void {
  openPopup({
    title: spec.name,
    icon: "mdi:thermometer",
    color: "green",
    watch: [spec.temperature, spec.humidity, spec.battery].filter((x): x is string => !!x),
    body: () => html`
      <div class="stats">
        ${stat("mdi:thermometer", "orange", "Température", st(spec.temperature))}
        ${spec.humidity ? stat("mdi:water-percent", "light-blue", "Humidité", st(spec.humidity)) : nothing}
        ${spec.battery ? stat("mdi:battery", "green", "Pile", st(spec.battery)) : nothing}
      </div>
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
    icon: "mdi:window-open-variant",
    color: "red",
    watch: ids,
    body: () =>
      html`${ids
        .map((id) => st(id))
        .filter((s) => !!s)
        .sort((a, b) => Number(isActive(b)) - Number(isActive(a)))
        .map((s) =>
          row(
            isActive(s) ? "mdi:window-open-variant" : "mdi:window-closed-variant",
            isActive(s) ? "red" : "green",
            (s!.attributes.friendly_name as string).replaceAll("_", " "),
            stateLabel(store.hass!, s),
            ago(s!.last_changed),
            () => openMoreInfo(document.body, s!.entity_id),
          ),
        )}`,
  });
}

/** Wi-Fi QR code for guests. */
export function openWifiQr(): void {
  openPopup({
    title: "Wi-Fi de la maison",
    icon: "mdi:qrcode",
    color: "teal",
    watch: [],
    body: () => html`
      <img class="shot" style="background:#fff; padding:16px; box-sizing:border-box; max-width:320px; justify-self:center" src=${config.home.wifiQr} alt="QR code du Wi-Fi" />
      <div class="muted" style="text-align:center">Scanne le code avec l'appareil photo pour rejoindre le Wi-Fi.</div>
    `,
  });
}

/** A Jellyfin item: artwork, summary, rating, genres, runtime. */
export function openMediaItem(item: Record<string, any>): void {
  openPopup({
    title: item.title,
    icon: "mdi:filmstrip-box-multiple",
    color: "purple",
    watch: [],
    body: () => html`
      ${item.fanart || item.poster ? html`<img class="shot" style="max-height:260px" src=${item.fanart || item.poster} alt="" />` : nothing}
      <div class="secondary">
        ${[item.number, item.episode, item.rating, item.runtime ? `${item.runtime} min` : "", item.genres].filter(Boolean).join(", ")}
      </div>
      ${item.summary ? html`<p style="margin:0; line-height:1.5">${item.summary}</p>` : nothing}
    `,
  });
}

/** Wall tablet (Fully Kiosk): screen, brightness, screensaver, battery, browser. */
export function openTablet(): void {
  const t = config.system.tablet;
  if (!t) return;
  openPopup({
    title: t.name,
    icon: "mdi:tablet",
    color: "indigo",
    watch: [t.screen, t.brightness, t.screensaver, t.plugged, t.battery, t.memory, t.storage].filter((x): x is string => !!x),
    body: () => {
      const hass = store.hass!;
      const screenOn = isActive(st(t.screen));
      const bright = Number(st(t.brightness)?.state);
      return html`
        ${row("mdi:tablet", screenOn ? "indigo" : "grey", "Écran", screenOn ? "Allumé" : "Éteint", "", () => toggle(t.screen, "l'écran"))}
        ${t.brightness && !isNaN(bright)
          ? html`<label class="bar" style="--rgb: var(--rgb-amber)">
              <span class="label"><span>Luminosité</span><span>${Math.round((bright / 255) * 100)} %</span></span>
              <input type="range" min="0" max="255" .value=${String(bright)} style="width:100%"
                @change=${(e: Event) => setNumber(t.brightness!, Number((e.target as HTMLInputElement).value))} />
            </label>`
          : nothing}
        ${t.screensaver ? row("mdi:power-sleep", isActive(st(t.screensaver)) ? "purple" : "grey", "Économiseur d'écran", isActive(st(t.screensaver)) ? "Actif" : "Inactif", "", () => toggle(t.screensaver!, "l'économiseur")) : nothing}
        ${t.battery ? row(isActive(st(t.plugged)) ? "mdi:battery-charging" : "mdi:battery", "green", "Batterie", stateLabel(hass, st(t.battery)), isActive(st(t.plugged)) ? "Branchée" : "Sur batterie") : nothing}
        <div class="grid2">${t.memory ? bar("Mémoire", t.memory) : nothing}${t.storage ? bar("Stockage", t.storage) : nothing}</div>
        <div class="grid2">
          ${t.reload ? html`<button class="action" style="--rgb: var(--rgb-blue)" @click=${() => pressButton(t.reload!)}><ha-icon icon="mdi:refresh"></ha-icon>Recharger</button>` : nothing}
          ${t.restartBrowser ? html`<button class="action" style="--rgb: var(--rgb-orange)" @click=${() => pressButton(t.restartBrowser!)}><ha-icon icon="mdi:restart"></ha-icon>Redémarrer le navigateur</button>` : nothing}
        </div>
      `;
    },
  });
}


const ALARM_MODES: { mode: AlarmMode; bit: number; label: string; icon: string }[] = [
  { mode: "arm_away", bit: 2, label: "Absence", icon: "mdi:shield-lock" },
  { mode: "arm_home", bit: 1, label: "Maison", icon: "mdi:shield-home" },
  { mode: "arm_night", bit: 4, label: "Nuit", icon: "mdi:shield-moon" },
  { mode: "arm_vacation", bit: 32, label: "Vacances", icon: "mdi:shield-airplane" },
];

/** Alarm: its state, the arming modes it supports, disarm, and a keypad when it needs a code. */
export function openAlarm(id: string): void {
  let code = "";
  openPopup({
    title: capitalize(String(st(id)?.attributes.friendly_name ?? "Alarme")),
    icon: "mdi:shield-home",
    color: "red",
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
        ${row(look.icon, look.color, look.label, "", `depuis ${ago(s.last_changed).replace("il y a ", "")}`)}
        ${needsCode
          ? html`<div class="code" aria-live="polite">${code ? "•".repeat(code.length) : html`<span class="muted">Code</span>`}</div>
              ${format === "number"
                ? html`<div class="keypad">
                    ${["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0"].map(
                      (k) => html`<button class="action" style="--rgb: var(--rgb-grey)" aria-label=${k === "⌫" ? "Effacer" : k} @click=${() => key(k)}>
                        ${k === "⌫" ? html`<ha-icon icon="mdi:backspace-outline"></ha-icon>` : k}</button>`,
                    )}
                  </div>`
                : html`<input class="code-input" type="password" autocomplete="off" placeholder="Code" .value=${code}
                    @input=${(e: Event) => (code = (e.target as HTMLInputElement).value)} />`}`
          : nothing}
        ${armed
          ? html`<button class="action" style="--rgb: var(--rgb-orange)" @click=${() => send("disarm")}>
              <ha-icon icon="mdi:shield-off-outline"></ha-icon>Désarmer</button>`
          : html`<div class="grid2">
              ${ALARM_MODES.filter((m) => features & m.bit).map(
                (m) => html`<button class="action" style="--rgb: var(--rgb-green)" @click=${() => send(m.mode)}>
                  <ha-icon icon=${m.icon}></ha-icon>${m.label}</button>`,
              )}
            </div>`}
      `;
    },
  });
}
