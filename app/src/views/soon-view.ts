import { LitElement, css, html, nothing } from "lit";
import { base } from "../styles.ts";

// Theme pages not rebuilt yet: what they will hold, and the old view meanwhile.
const PAGES: Record<string, { title: string; icon: string; items: string[]; old: string }> = {
  medias: {
    title: "Médias",
    icon: "mdi:play-box-multiple-outline",
    items: ["Spotify", "TV Samsung du salon et de papa", "Télécommande de la box Bouygues", "Enceintes Google Home", "Derniers ajouts Jellyfin"],
    old: "/lovelace/device",
  },
  meteo: {
    title: "Météo",
    icon: "mdi:weather-partly-cloudy",
    items: ["Maintenant, ressenti, humidité", "Prochaines heures et prochains jours", "Vent, pluie, UV, lune, soleil", "Bourse"],
    old: "/lovelace/news",
  },
  energie: {
    title: "Énergie",
    icon: "mdi:lightning-bolt-outline",
    items: ["Linky : puissance et coût", "Prises (homelab, shiro, trottinette avec minuterie)", "Ordinateurs : démarrage, veille, état", "Ventilateur"],
    old: "/lovelace/device",
  },
  systeme: {
    title: "Système",
    icon: "mdi:cog-outline",
    items: ["Famille et localisation", "Internet et speedtest", "Home Assistant : disque, RAM, sauvegardes, mises à jour", "Tablette murale", "Automatisations"],
    old: "/lovelace/system",
  },
};

export class KhSoonView extends LitElement {
  static properties = { section: {} };
  declare section: string;

  static styles = [
    base,
    css`
      :host {
        display: block;
        max-width: 640px;
      }
      h1 {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 2rem;
        margin: 8px 0 16px;
      }
      .card {
        padding: 16px;
      }
      ul {
        margin: 8px 0 16px;
        padding-left: 20px;
        line-height: 1.7;
      }
      a.old {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        padding: 0 16px;
        border-radius: var(--kh-radius-icon);
        background: rgba(var(--rgb-blue), 0.2);
        color: inherit;
        font-weight: 700;
        text-decoration: none;
      }
    `,
  ];

  render() {
    const p = PAGES[this.section];
    if (!p) return html`<h1>Page introuvable</h1>`;
    return html`
      <h1><span class="shape" style="--rgb: var(--rgb-blue)"><ha-icon icon=${p.icon}></ha-icon></span>${p.title}</h1>
      <div class="card">
        <div class="primary">Cette page arrive bientôt dans Kaoru Home.</div>
        <ul class="secondary">${p.items.map((i) => html`<li>${i}</li>`)}</ul>
        ${p.old ? html`<a class="old" href=${p.old}><ha-icon icon="mdi:open-in-app"></ha-icon>Ouvrir l'ancien dashboard</a>` : nothing}
      </div>
    `;
  }
}
customElements.define("kh-soon-view", KhSoonView);
