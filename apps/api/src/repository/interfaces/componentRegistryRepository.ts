import type { ComponentRecord, ComponentVersionRecord } from "../types";

export interface ComponentRegistryRepository {
  createComponent(input: { key: string; name: string; description?: string | null }): Promise<ComponentRecord>;
  getComponentById(id: string): Promise<ComponentRecord | null>;
  getComponentByKey(key: string): Promise<ComponentRecord | null>;
  listComponents(): Promise<ComponentRecord[]>;

  createVersion(input: {
    componentId: string;
    version: string;
    linkRefs?: unknown;
    propSchema?: unknown | null;
  }): Promise<ComponentVersionRecord>;
  getVersionById(id: string): Promise<ComponentVersionRecord | null>;
  listVersionsForComponent(componentId: string): Promise<ComponentVersionRecord[]>;
}
