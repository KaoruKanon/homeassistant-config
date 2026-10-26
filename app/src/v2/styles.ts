import { css, html, nothing, svg } from "lit";

/**
 * V2 design system ("bento"): every page opens on a hero banner, then a
 * grid of tiles whose size follows their importance; each family of tiles
 * carries its colour as a soft gradient (--tint, an "r, g, b" token).
 * 12 tracks on wide screens, 6 on tablets, 2 on phones.
 */
export const v2 = css`
  :host {
    display: block;
    container: v2 / inline-size;
  }
  .hero {
    position: relative;
    overflow: hidden;
    min-height: 210px;
    border-radius: 28px;
    padding: 24px;
    box-sizing: border-box;
    display: grid;
    align-content: space-between;
    gap: 16px;
    color: #fff;
    background:
      radial-gradient(120% 140% at 0% 0%, rgba(var(--hero, var(--rgb-blue)), 0.95), rgba(var(--hero, var(--rgb-blue)), 0.55) 55%, rgba(20, 22, 26, 0.9));
    text-shadow: 0 1px 4px rgb(0 0 0 / 0.3);
    animation: kh-rise 420ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .hero .eyebrow {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    opacity: 0.9;
  }
  .hero .eyebrow ha-icon {
    --mdc-icon-size: 22px;
  }
  .hero h1 {
    margin: 0;
    font-size: clamp(2.25rem, 6vw, 3.5rem);
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .hero .sub {
    font-weight: 600;
    opacity: 0.9;
  }
  .hero .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .hero .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 38px;
    padding: 0 14px;
    border-radius: 19px;
    background: rgb(0 0 0 / 0.26);
    color: #fff;
    font-weight: 700;
    font-size: 0.875rem;
    text-decoration: none;
  }
  .hero .chip ha-icon {
    --mdc-icon-size: 18px;
  }
  .hero .chip.alert {
    background: rgba(var(--rgb-red), 0.75);
  }
  /* Heroes with a scene (rooms, house, media, energy, system) or the
     weather-frog picture behind the text. */
  .hero.scened {
    min-height: 200px;
    background: #2b3363;
  }
  .hero > :not(.art) {
    position: relative;
    z-index: 1;
  }
  .hero .art {
    position: absolute;
    inset: 0;
    container-type: size;
  }
  .hero .art::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgb(0 0 0 / 0.34), rgb(0 0 0 / 0) 58%);
  }

  .bento {
    margin-top: 18px;
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-auto-flow: row dense;
    gap: 16px;
  }
  /* A tile is as tall as its content: never stretched to its row with empty space. */
  .tile {
    align-self: start;
    grid-column: span var(--w, 4);
    min-width: 0;
    border-radius: 24px;
    padding: 16px;
    box-sizing: border-box;
    background: linear-gradient(160deg, rgba(var(--tint, var(--rgb-grey)), 0.16), rgba(var(--tint, var(--rgb-grey)), 0.03) 60%), var(--kh-card);
    display: grid;
    /* One column that never grows past the tile (a long row of posters). */
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    gap: 12px;
  }
  /* Column of tiles inside the bento: no holes next to a tall tile. */
  .col {
    grid-column: span var(--w, 4);
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .col > .tile {
    grid-column: 1 / -1;
    align-self: stretch; /* full width in its column (the column is a flex stack) */
  }
  .tile.flush {
    padding: 0;
    background: none;
  }
  .tile h3 {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 1rem;
  }
  .tile h3 .ic {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .tile h3 a {
    flex: none;
  }
  .tile h3 .ic > .ellipsis {
    min-width: 0;
  }
  .tile h3 .ic ha-icon {
    --mdc-icon-size: 20px;
    color: rgb(var(--tint));
  }
  .tile h3 a,
  .tile h3 .more {
    color: var(--kh-text-2);
    text-decoration: none;
    font-size: 0.8125rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
  }
  .list {
    display: grid;
    gap: 6px;
  }
  .item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 2px 12px;
    padding: 10px 12px;
    border-radius: 16px;
    background: var(--kh-card-2);
    text-align: left;
    width: 100%;
    box-sizing: border-box;
    color: inherit;
    text-decoration: none;
  }
  .item .shape {
    width: 38px;
    height: 38px;
  }
  .item .v {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .pills {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
    gap: 10px;
  }
  .row2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .action {
    display: grid;
    justify-items: start;
    gap: 6px;
    padding: 12px;
    border-radius: 16px;
    background: rgba(var(--c, var(--rgb-blue)), 0.18);
    font-weight: 700;
    text-align: left;
    color: inherit;
    text-decoration: none;
  }
  .action ha-icon {
    color: rgb(var(--c, var(--rgb-blue)));
  }
  .big-number {
    font-size: 2.5rem;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .big-number small {
    font-size: 1rem;
    font-weight: 700;
    opacity: 0.8;
    margin-left: 4px;
  }
  /* Short screens (wall tablet in landscape): a lower hero, more room for tiles. */
  @media (max-height: 820px) and (min-width: 600px) {
    .hero {
      min-height: 0;
      padding: 18px 22px;
      gap: 12px;
    }
    .hero h1 {
      font-size: 2.5rem;
    }
    .bento {
      margin-top: 14px;
      gap: 14px;
    }
  }
  /* 6 columns in portrait up to 1099 px (2 halves in landscape up to 899 px). The phone layout
     (one stack, bottom dock) is for portrait only: in landscape a tablet keeps
     columns, like the computer, even with HA's sidebar open. */
  @container v2 (max-width: 1099px) {
    @media (orientation: portrait) {
      .bento {
        grid-template-columns: repeat(6, minmax(0, 1fr));
      }
      .tile,
      .col {
        grid-column: span var(--w6, 3);
      }
    }
  }
  @container v2 (max-width: 899px) {
    @media (orientation: landscape) {
      /* Two halves side by side (a landscape tablet with HA's sidebar open):
         the wide tiles of the computer layout keep the whole width. */
      .bento {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .tile,
      .col {
        grid-column: span 1;
      }
      .tile[style*="--w: 12"],
      .tile[style*="--w: 8"] {
        grid-column: 1 / -1;
      }
    }
  }
  @container v2 (max-width: 679px) {
    @media (orientation: portrait) {
    .hero {
      padding: 20px;
      min-height: 190px;
    }
    .hero .art {
      --scene-max: 46cqw;
    }
    .hero .art .window {
      display: none;
    }
    .bento {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .tile,
    .col {
      grid-column: span var(--w2, 2);
    }
    /* Phones: one stack, so columns dissolve and tiles can be reordered. */
    .col {
      display: contents;
    }
    .first-on-phone {
      order: -1;
    }
    .pills {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    }
  }
`;

/** Tile header: tinted icon, title, optional link on the right. */
export function head(icon: string, title: string, link?: { href: string; label: string }) {
  return html`<h3>
    <span class="ic"><ha-icon icon=${icon}></ha-icon><span class="ellipsis">${title}</span></span>
    ${link ? html`<a href=${link.href}>${link.label}<ha-icon icon="mdi:chevron-right"></ha-icon></a>` : nothing}
  </h3>`;
}

/** Page hero: coloured banner with an icon, a big title, a line and chips. */
export function hero(color: string, icon: string, eyebrow: string, title: unknown, sub?: unknown, chips?: unknown, extra?: unknown) {
  return html`<section class="hero ${extra ? "scened" : ""}" style="--hero: var(--rgb-${color})">
    <div>
      <div class="eyebrow"><ha-icon icon=${icon}></ha-icon>${eyebrow}</div>
      <h1>${title}</h1>
      ${sub ? html`<div class="sub">${sub}</div>` : nothing}
    </div>
    ${extra ?? nothing}
    ${chips ? html`<div class="chips">${chips}</div>` : nothing}
  </section>`;
}

/** Ring around a value (0..1): batteries, energy versus yesterday. */
export function ring(f: number, size: number, stroke: number, color: string) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return svg`<svg width=${size} height=${size} viewBox="0 0 ${size} ${size}" style="position:absolute; inset:0; transform: rotate(-90deg)">
    <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke="var(--kh-card-2)" stroke-width=${stroke} />
    <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke=${color} stroke-width=${stroke} stroke-linecap="round"
      stroke-dasharray=${c} stroke-dashoffset=${c * (1 - Math.min(1, Math.max(0, f)))} style="transition: stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" />
  </svg>`;
}

/** Splits a list into pages of `n` for a kh-swipe (the old swipe-card). */
export function pagesOf<T>(items: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/**
 * Wall layout (landscape tablet, or a PC window shaped like one): judged on
 * the width the panel really has (the HA sidebar excluded) and the window's
 * height, so a docked sidebar never squeezes the three columns.
 */
export function isWall(panelWidth: number): boolean {
  return panelWidth >= 900 && window.innerHeight <= 1100 && window.innerWidth > window.innerHeight;
}
