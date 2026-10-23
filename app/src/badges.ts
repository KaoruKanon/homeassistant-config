import { css } from "lit";

/**
 * Badge colours of the home view, taken from the old Lovelace chips
 * (ui-lovelace.yaml): icon colour, tinted background, and the pulses of the
 * alarm, the timer and the people at home.
 */
export interface BadgeLook {
  /** Icon colour token ("orange"), or undefined for the greyed "disabled" look. */
  icon?: string;
  /** Background tint token and its opacity. */
  bg?: string;
  alpha?: number;
  /** Pulse of the background towards another tint, period in seconds. */
  pulse?: { to: string; alpha: number; s: number };
  /** The timer's white flash. */
  flash?: boolean;
}

export function temperatureBadge(t: number): BadgeLook {
  if (isNaN(t)) return {};
  if (t < 18) return { icon: "orange", bg: "blue", alpha: 0.2 };
  if (t < 28) return { icon: "green", bg: "green", alpha: 0.2 };
  return { icon: "red", bg: "red", alpha: 0.2 };
}

export const timerBadge = (active: boolean): BadgeLook => ({ icon: "white", flash: active });

export const lightsBadge = (n: number): BadgeLook => (n > 0 ? { icon: "amber", bg: "yellow", alpha: 0.3 } : {});

export const windowsBadge = (n: number): BadgeLook => (n > 0 ? { icon: "grey", bg: "white", alpha: 0.3 } : {});

export function alarmBadge(state?: string): BadgeLook {
  switch (state) {
    case "arming":
      return { icon: "orange", bg: "orange", alpha: 0.1, pulse: { to: "orange", alpha: 0.4, s: 1 } };
    case "armed_away":
    case "armed_night":
    case "armed_vacation":
    case "armed_custom_bypass":
      return { icon: "red", bg: "red", alpha: 0.1, pulse: { to: "red", alpha: 0.4, s: 5 } };
    case "armed_home":
      return { icon: "red", bg: "red", alpha: 0.2, pulse: { to: "red", alpha: 0.4, s: 5 } };
    case "pending":
      return { icon: "orange", bg: "red", alpha: 0.2, pulse: { to: "yellow", alpha: 0.4, s: 1 } };
    case "triggered":
      return { icon: "red", bg: "red", alpha: 0.2, pulse: { to: "red", alpha: 0.4, s: 0.4 } };
    case "disarmed":
      return { icon: "green", bg: "blue", alpha: 0.2 };
    default:
      return {};
  }
}

export const personBadge = (home: boolean): BadgeLook =>
  home ? { icon: "green", bg: "green", alpha: 0.2, pulse: { to: "green", alpha: 0.8, s: 5 } } : { icon: "red", bg: "red", alpha: 0.4 };

/** Inline custom properties for a badge (read by `badgeStyles`). */
export function badgeStyle(b: BadgeLook): string {
  const v: string[] = [];
  v.push(b.icon ? `--b-ic: ${b.icon === "white" ? "#fff" : `rgb(var(--rgb-${b.icon}))`}` : "--b-ic: var(--kh-text-2)");
  if (b.bg) v.push(`--b-bg: var(--rgb-${b.bg === "white" ? "white" : b.bg})`, `--b-a: ${b.alpha ?? 0.2}`);
  if (b.pulse) v.push(`--b-to: var(--rgb-${b.pulse.to})`, `--b-ta: ${b.pulse.alpha}`, `--b-s: ${b.pulse.s}s`);
  return v.join("; ");
}

/** Classes for a badge: tinted, pulsing, flashing, greyed. */
export function badgeClass(b: BadgeLook): string {
  return [b.bg ? "b-tint" : "", b.pulse ? "b-pulse" : "", b.flash ? "b-flash" : "", b.icon ? "" : "b-off"].filter(Boolean).join(" ");
}

export const badgeStyles = css`
  :host {
    --rgb-white: 255, 255, 255;
  }
  .chip ha-icon {
    color: var(--b-ic, inherit);
  }
  .chip.b-off ha-icon {
    opacity: 0.6;
  }
  .chip.b-tint {
    background: rgba(var(--b-bg), var(--b-a));
  }
  .chip.b-pulse {
    animation: kh-badge-pulse var(--b-s) ease-in-out infinite;
  }
  .chip.b-flash {
    animation: kh-badge-flash 1.2s ease-in-out infinite;
  }
  @keyframes kh-badge-pulse {
    0%,
    100% {
      background: rgba(var(--b-bg), var(--b-a));
    }
    70% {
      background: rgba(var(--b-to), var(--b-ta));
    }
  }
  @keyframes kh-badge-flash {
    30% {
      background: #fff;
      color: #1f2326;
      --b-ic: #1f2326;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .chip.b-pulse,
    .chip.b-flash {
      animation: none;
    }
  }
`;
