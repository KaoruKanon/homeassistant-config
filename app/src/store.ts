import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { HassEntity, HomeAssistant } from "./types.ts";

type Listener = () => void;

/**
 * Holds the latest `hass` object and wakes only the components whose
 * entities changed. Home Assistant hands the panel a new `hass` on every
 * state change of the whole house; unchanged entities keep the same object,
 * so a reference check per watched entity is enough.
 */
export class HassStore {
  hass?: HomeAssistant;
  private entityListeners = new Map<string, Set<Listener>>();
  private registryListeners = new Set<Listener>();
  private stateCount = 0;

  set(hass: HomeAssistant): void {
    const prev = this.hass;
    this.hass = hass;
    const count = prev?.states === hass.states ? this.stateCount : Object.keys(hass.states).length;
    const membershipChanged = count !== this.stateCount;
    this.stateCount = count;
    if (!prev) {
      this.registryListeners.forEach((l) => l());
      this.entityListeners.forEach((set) => set.forEach((l) => l()));
      return;
    }
    if (
      prev.entities !== hass.entities ||
      prev.devices !== hass.devices ||
      prev.areas !== hass.areas ||
      prev.user !== hass.user ||
      prev.themes !== hass.themes ||
      prev.localize !== hass.localize ||
      membershipChanged
    ) {
      this.registryListeners.forEach((l) => l());
    }
    if (prev.states === hass.states) return;
    const woken = new Set<Listener>();
    for (const [id, set] of this.entityListeners) {
      if (prev.states[id] !== hass.states[id]) set.forEach((l) => woken.add(l));
    }
    woken.forEach((l) => l());
  }

  get(entityId: string): HassEntity | undefined {
    return this.hass?.states[entityId];
  }

  subscribe(ids: readonly string[], listener: Listener): () => void {
    for (const id of ids) {
      let set = this.entityListeners.get(id);
      if (!set) this.entityListeners.set(id, (set = new Set()));
      set.add(listener);
    }
    return () => {
      for (const id of ids) {
        const set = this.entityListeners.get(id);
        set?.delete(listener);
        if (set && set.size === 0) this.entityListeners.delete(id);
      }
    };
  }

  subscribeRegistry(listener: Listener): () => void {
    this.registryListeners.add(listener);
    return () => this.registryListeners.delete(listener);
  }
}

export const store = new HassStore();

/** Re-renders its host when one of the given entities changes. */
export class EntitiesController implements ReactiveController {
  private unsubscribe?: () => void;
  private key = "";

  constructor(
    private host: ReactiveControllerHost,
    private ids: () => readonly string[],
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    this.resubscribe();
    // Back in the page after a while: show current states, not the ones from before.
    this.host.requestUpdate();
  }

  hostUpdate(): void {
    if (this.ids().join("|") !== this.key) this.resubscribe();
  }

  hostDisconnected(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.key = "";
  }

  private resubscribe(): void {
    this.unsubscribe?.();
    const ids = this.ids();
    this.key = ids.join("|");
    this.unsubscribe = store.subscribe(ids, () => this.host.requestUpdate());
  }
}

/** Re-renders its host when areas, devices, entities, user or theme change. */
export class RegistryController implements ReactiveController {
  private unsubscribe?: () => void;

  constructor(private host: ReactiveControllerHost) {
    host.addController(this);
  }

  hostConnected(): void {
    this.unsubscribe = store.subscribeRegistry(() => this.host.requestUpdate());
    this.host.requestUpdate();
  }

  hostDisconnected(): void {
    this.unsubscribe?.();
  }
}
