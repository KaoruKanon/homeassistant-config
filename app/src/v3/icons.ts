import { html, svg, type SVGTemplateResult, type TemplateResult } from "lit";

// Line icons drawn on a 24 px grid, inline (no icon font, no HA component).
// Strokes use currentColor; `fill: true` icons are solid shapes.

const S = (d: string) => svg`<path d=${d}></path>`;

const STROKE: Record<string, SVGTemplateResult> = {
  home: S("M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"),
  plan: S("M3 3h18v18H3zM3 12h7v9M10 3v5M14 12h7M14 12v4"),
  thermo: S("M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"),
  playCircle: svg`<circle cx="12" cy="12" r="9"></circle><path d="M10 8.5l5.5 3.5-5.5 3.5z"></path>`,
  cloud: S("M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"),
  bolt: S("M13 2L4 14h7l-1 8 9-12h-7z"),
  trend: S("M3 17l6-6 4 4 8-8M15 7h6v6"),
  trendDown: S("M3 7l6 6 4-4 8 8M15 17h6v-6"),
  list: S("M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"),
  people: svg`<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><circle cx="17" cy="9" r="2.5"></circle><path d="M16 14.2A5 5 0 0 1 21.5 19"></path>`,
  gear: svg`<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"></path>`,
  bulb: S("M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"),
  ceiling: S("M12 3v4M6 14a6 6 0 0 1 12 0zM10 17a2 2 0 0 0 4 0"),
  bed: svg`<path d="M3 18V6M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3"></path><circle cx="7" cy="10.5" r="1.5"></circle>`,
  desk: S("M6 21h8M10 21v-6l-3-5 6-6 3 3M13 4l5 5-3 2"),
  fork: S("M7 3v7a2 2 0 0 0 2 2v9M11 3v7M7 7h4M17 21V3c-2 1-3 3.5-3 7h3"),
  bath: S("M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM6 12V5a2 2 0 0 1 4 0"),
  toilet: S("M6 3h6v7H6zM4 10h14a5 5 0 0 1-5 5H9l1 6H6l1-6a4 4 0 0 1-3-5z"),
  sofa: S("M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2zM5 18v2M19 18v2"),
  door: S("M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14 12h.01"),
  flask: S("M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"),
  led: S("M3 15h18M5 15v-2M9 15v-2M13 15v-2M17 15v-2M4 19h16"),
  monitor: svg`<rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M8 20h8M12 16v4"></path>`,
  tv: svg`<rect x="3" y="6" width="18" height="12" rx="2"></rect><path d="M8 3l4 3 4-3"></path>`,
  window: svg`<rect x="4" y="4" width="16" height="16" rx="1.5"></rect><path d="M12 4v16M4 12h16"></path>`,
  shield: S("M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"),
  timer: svg`<circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 2M9 2h6"></path>`,
  chevronR: S("M9 6l6 6-6 6"),
  chevronL: S("M15 6l-6 6 6 6"),
  chevronU: S("M6 15l6-6 6 6"),
  chevronD: S("M6 9l6 6 6-6"),
  power: S("M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"),
  plus: S("M5 12h14M12 5v14"),
  minus: S("M5 12h14"),
  close: S("M6 6l12 12M18 6L6 18"),
  volume: S("M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 0 1 0 6"),
  mute: S("M4 9h4l5-4v14l-5-4H4zM17 9l4 6M21 9l-4 6"),
  speaker: svg`<rect x="6" y="3" width="12" height="18" rx="3"></rect><circle cx="12" cy="14" r="3"></circle><circle cx="12" cy="7.5" r="1"></circle>`,
  fan: S("M12 10c0-4 1-7 4-7s2 4-2 7M14 12c4 0 7 1 7 4s-4 2-7-2M12 14c0 4-1 7-4 7s-2-4 2-7M10 12c-4 0-7-1-7-4s4-2 7 2"),
  scooter: svg`<circle cx="5" cy="18" r="2.5"></circle><circle cx="19" cy="18" r="2.5"></circle><path d="M7.5 18h9M16 18l-3-12h3"></path>`,
  calendar: svg`<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>`,
  leave: S("M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H4"),
  guest: svg`<circle cx="10" cy="8" r="4"></circle><path d="M3 20a7 7 0 0 1 14 0M19 8v6M16 11h6"></path>`,
  wifi: svg`<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"></path><circle cx="12" cy="19.5" r="1"></circle>`,
  remote: svg`<rect x="7" y="2" width="10" height="20" rx="3"></rect><circle cx="12" cy="8" r="2"></circle><path d="M10 14h.01M14 14h.01M10 17h.01M14 17h.01"></path>`,
  radar: svg`<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><path d="M12 12l6-6"></path>`,
  drop: S("M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"),
  wind: S("M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"),
  umbrella: S("M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9zM12 12v7a2 2 0 0 1-4 0"),
  sun: svg`<circle cx="12" cy="12" r="4.5"></circle><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"></path>`,
  moon: S("M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"),
  back: S("M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"),
  more: svg`<circle cx="5" cy="12" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="19" cy="12" r="1.6"></circle>`,
  refresh: S("M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"),
  download: S("M12 4v11M7 10l5 5 5-5M5 20h14"),
  backup: S("M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8zM12 11v6M9.5 13.5L12 11l2.5 2.5"),
  battery: svg`<rect x="2" y="7" width="18" height="10" rx="2"></rect><path d="M22 10v4"></path>`,
  external: S("M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"),
  key: svg`<circle cx="8" cy="15" r="4"></circle><path d="M11 12l9-9M17 6l3 3M15 8l2 2"></path>`,
  wallet: svg`<rect x="3" y="6" width="18" height="13" rx="2"></rect><path d="M16 12h2M3 9h18"></path>`,
  bike: svg`<circle cx="6" cy="16" r="3.5"></circle><circle cx="18" cy="16" r="3.5"></circle><path d="M6 16l4-8h5l3 8M10 8l2 8h-6M14 5h3"></path>`,
  camera: svg`<path d="M4 8h3l2-3h6l2 3h3v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle>`,
  pin: svg`<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"></path><circle cx="12" cy="9" r="2.5"></circle>`,
  check: S("M5 12l5 5 9-10"),
  logs: S("M4 6h16M4 12h16M4 18h10"),
  moonSleep: S("M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"),
  sliders: S("M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4"),
  plug: S("M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"),
  motion: svg`<circle cx="12" cy="5" r="2"></circle><path d="M10 22l2-7 3 3v4M8 12l3-4 4 2 3 1M12 15l-3-3"></path>`,
  phone: svg`<rect x="7" y="2" width="10" height="20" rx="2.5"></rect><path d="M11 18h2"></path>`,
  bell: S("M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"),
  palette: svg`<circle cx="12" cy="12" r="9"></circle><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor"></path>`,
};

const FILL: Record<string, SVGTemplateResult> = {
  star: S("M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"),
  play: S("M7 5l12 7-12 7z"),
  pause: svg`<rect x="6.5" y="5" width="4" height="14" rx="1"></rect><rect x="13.5" y="5" width="4" height="14" rx="1"></rect>`,
  prev: S("M7 6h2v12H7zM19 6v12l-9-6z"),
  next: S("M15 6h2v12h-2zM5 6v12l9-6z"),
  stop: svg`<rect x="7" y="7" width="10" height="10" rx="2"></rect>`,
  playPause: S("M4 5l9 7-9 7zM15 5h2v14h-2zM19 5h2v14h-2z"),
  boltFill: S("M13 2L4 14h7l-1 8 9-12h-7z"),
  haLogo: S("M12 3l9 7.5h-2.5V20h-13v-9.5H3z"),
};

export type IconName = keyof typeof STROKE | keyof typeof FILL;

/** An inline icon; decorative (aria-hidden) unless a label is given. */
export function icon(name: string, size = 20, label?: string): TemplateResult {
  const filled = name in FILL;
  const body = filled ? FILL[name] : (STROKE[name] ?? STROKE.home);
  return html`<svg
    width=${size}
    height=${size}
    viewBox="0 0 24 24"
    fill=${filled ? "currentColor" : "none"}
    stroke=${filled ? "none" : "currentColor"}
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    role=${label ? "img" : "presentation"}
    aria-hidden=${label ? "false" : "true"}
    aria-label=${label ?? ""}
  >
    ${body}
  </svg>`;
}

/** Room icon from the area's MDI icon name (HA registry or config). */
export function roomIcon(mdi: string): string {
  if (/sofa|couch|tv/.test(mdi)) return "sofa";
  if (/silverware|food|fridge|stove/.test(mdi)) return "fork";
  if (/bed/.test(mdi)) return "bed";
  if (/shower|bath/.test(mdi)) return "bath";
  if (/toilet/.test(mdi)) return "toilet";
  if (/door/.test(mdi)) return "door";
  if (/flask/.test(mdi)) return "flask";
  return "home";
}

/** Light icon from the MDI name configured for a favourite light. */
export function lightIcon(mdi?: string): string {
  if (!mdi) return "bulb";
  if (/ceiling/.test(mdi)) return "ceiling";
  if (/bed/.test(mdi)) return "bed";
  if (/desk/.test(mdi)) return "desk";
  if (/silverware/.test(mdi)) return "fork";
  if (/toilet/.test(mdi)) return "toilet";
  if (/shower|bath/.test(mdi)) return "bath";
  if (/strip|led/.test(mdi)) return "led";
  return "bulb";
}

export type WeatherKind = "rain" | "cloud" | "sun" | "part" | "moon" | "storm" | "snow" | "fog";

/** HA weather condition to an icon kind. */
export function weatherKind(condition: string, night = false): WeatherKind {
  switch (condition) {
    case "sunny":
      return "sun";
    case "clear-night":
      return "moon";
    case "partlycloudy":
      return night ? "moon" : "part";
    case "rainy":
    case "pouring":
    case "hail":
      return "rain";
    case "lightning":
    case "lightning-rainy":
      return "storm";
    case "snowy":
    case "snowy-rainy":
      return "snow";
    case "fog":
      return "fog";
    default:
      return "cloud";
  }
}

/** Animated weather icon: falling rain, drifting and glowing cloud, turning sun. */
export function weatherIcon(kind: WeatherKind, size = 24): TemplateResult {
  const cloud = "M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z";
  const high = "M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 5.5 4.3 4.3 0 0 0 7 14z";
  let body: SVGTemplateResult;
  switch (kind) {
    case "rain":
      body = svg`<path class="kh-glow" d=${high}></path><path class="kh-drop" d="M9 17l-1 2.5"></path><path class="kh-drop kh-d2" d="M13 17l-1 2.5"></path><path class="kh-drop kh-d3" d="M17 17l-1 2.5"></path>`;
      break;
    case "storm":
      body = svg`<path class="kh-glow" d=${high}></path><path class="kh-pulse" d="M12 15l-2 4h3l-1 3"></path>`;
      break;
    case "snow":
      body = svg`<path class="kh-glow" d=${high}></path><path class="kh-drop" d="M9 18h.01"></path><path class="kh-drop kh-d2" d="M13 19h.01"></path><path class="kh-drop kh-d3" d="M17 18h.01"></path>`;
      break;
    case "sun":
      body = svg`<circle cx="12" cy="12" r="4.5"></circle><g class="kh-spin"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"></path></g>`;
      break;
    case "part":
      body = svg`<g class="kh-spin9"><path d="M9 2.5v1.5M3.5 9H2M4.4 4.4l1 1M13.6 4.4l-1 1"></path></g><circle cx="9" cy="9" r="3.2"></circle><path class="kh-drift" d="M9 20h8a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 13a3.5 3.5 0 0 0 1 7z"></path>`;
      break;
    case "moon":
      body = svg`<path class="kh-glow" d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path>`;
      break;
    case "fog":
      body = svg`<path class="kh-drift" d="M4 9h16M3 13h18M6 17h12"></path>`;
      break;
    default:
      body = svg`<path class="kh-drift kh-glow" d=${cloud}></path>`;
  }
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
