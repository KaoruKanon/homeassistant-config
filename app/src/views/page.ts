import { css, html, nothing } from "lit";

/** Shared layout of the theme pages: header, sections, responsive grids. */
export const pageStyles = css`
  :host {
    display: block;
  }
  .page-head {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 4px 0 8px;
  }
  .page-head h1 {
    margin: 0;
    font-size: 2rem;
    line-height: 1.1;
  }
  .page-head .shape {
    width: 52px;
    height: 52px;
    border-radius: 16px;
  }
  .page-head .shape ha-icon {
    --mdc-icon-size: 28px;
  }
  h2 {
    margin: 22px 0 10px;
    font-size: 1.25rem;
    font-weight: 700;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--min, 280px)), 1fr));
    gap: var(--kh-gap);
    align-items: start;
  }
  .stack {
    display: grid;
    gap: var(--kh-gap);
  }
  /* Two-column page body on wide screens, one on phones. */
  .cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
    gap: 0 28px;
    align-items: start;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    text-align: left;
    width: 100%;
    box-sizing: border-box;
  }
  .row > div {
    flex: 1;
    min-width: 0;
  }
  .value {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 12px;
    border-radius: var(--kh-radius-icon);
    background: var(--kh-card);
    font-weight: 700;
    font-size: 0.875rem;
  }
  .pill ha-icon {
    --mdc-icon-size: 18px;
    color: rgb(var(--rgb, var(--rgb-grey)));
  }
  .action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 16px;
    border-radius: var(--kh-radius-icon);
    background: rgba(var(--rgb, var(--rgb-blue)), 0.2);
    font-weight: 700;
    color: inherit;
    text-decoration: none;
  }
  .empty {
    color: var(--kh-text-2);
    padding: 12px 0;
  }
`;

export function pageHead(icon: string, color: string, title: string, sub?: string) {
  return html`<div class="page-head">
    <span class="shape" style="--rgb: var(--rgb-${color})"><ha-icon icon=${icon}></ha-icon></span>
    <div>
      <h1>${title}</h1>
      ${sub ? html`<div class="secondary">${sub}</div>` : nothing}
    </div>
  </div>`;
}
