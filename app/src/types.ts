// The subset of the `hass` object that Home Assistant hands to a custom panel.

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

export interface EntityRegistryEntry {
  entity_id: string;
  name?: string | null;
  device_id?: string | null;
  area_id?: string | null;
  platform?: string;
  hidden?: boolean;
  entity_category?: "config" | "diagnostic" | null;
}

export interface DeviceRegistryEntry {
  id: string;
  area_id: string | null;
  name: string | null;
  name_by_user: string | null;
}

export interface AreaRegistryEntry {
  area_id: string;
  name: string;
  icon?: string | null;
}

export interface HassUser {
  id: string;
  name: string;
  is_admin: boolean;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  entities: Record<string, EntityRegistryEntry>;
  devices: Record<string, DeviceRegistryEntry>;
  areas: Record<string, AreaRegistryEntry>;
  user?: HassUser;
  themes: { darkMode: boolean };
  language: string;
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: { entity_id: string | string[] },
  ): Promise<unknown>;
  formatEntityState?(stateObj: HassEntity, state?: string): string;
  localize?: unknown;
  loadBackendTranslation?(category: string, integrations?: string | string[]): Promise<unknown>;
}

export interface PanelRoute {
  prefix: string;
  path: string;
}
