/** Navigates inside the panel (HA's router listens to location-changed), with a cross-fade where supported. */
export function goTo(path: string): void {
  const go = () => {
    history.pushState(null, "", path + location.search);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(go);
  else go();
}
