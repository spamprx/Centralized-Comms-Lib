import type { ComponentRecord, ComponentVersionRecord } from "../types";

export interface ComponentRegistryRepository {
  createComponent(input: { key: string; name: string; description?: string | null }): Promise<ComponentRecord>;
  getComponentById(id: string): Promise<ComponentRecord | null>;
  getComponentByKey(key: string): Promise<ComponentRecord | null>;
  listComponents(): Promise<ComponentRecord[]>;

  createVersion(input: {
    componentId: string;
    version: string;
    bodyJson?: unknown | null;
    linkRefs?: unknown;
    propSchema?: unknown | null;
  }): Promise<ComponentVersionRecord>;
  getVersionById(id: string): Promise<ComponentVersionRecord | null>;
  listVersionsForComponent(componentId: string): Promise<ComponentVersionRecord[]>;
  /** Updates canonical `bodyJson` for an existing version (library maintainer / propagation). */
  updateVersionBodyJson(versionId: string, bodyJson: unknown | null): Promise<ComponentVersionRecord>;
}
