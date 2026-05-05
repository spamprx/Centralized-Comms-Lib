import type {
  ComponentLibraryRecord,
  ComponentRecord,
  ComponentVersionRecord,
} from "../types";

export interface ComponentRegistryRepository {
  createComponent(input: {
    key: string;
    name: string;
    description?: string | null;
    category?: "CONTENT" | "MEDIA" | "CTA" | "LEGAL" | "OTHER";
  }): Promise<ComponentRecord>;
  getComponentById(id: string): Promise<ComponentRecord | null>;
  getComponentByKey(key: string): Promise<ComponentRecord | null>;
  listComponents(): Promise<ComponentRecord[]>;
  /** Same as list but each row includes the latest `ComponentVersion` (by `createdAt` desc). */
  listComponentsWithLatestVersion(input?: {
    category?: "CONTENT" | "MEDIA" | "CTA" | "LEGAL" | "OTHER";
  }): Promise<ComponentLibraryRecord[]>;

  createVersion(input: {
    componentId: string;
    version: string;
    bodyJson?: unknown | null;
    linkRefs?: unknown;
    propSchema?: unknown | null;
  }): Promise<ComponentVersionRecord>;
  getVersionById(id: string): Promise<ComponentVersionRecord | null>;
  listVersionsForComponent(
    componentId: string,
  ): Promise<ComponentVersionRecord[]>;
  /** Updates canonical `bodyJson` for an existing version (library maintainer / propagation). */
  updateVersionBodyJson(
    versionId: string,
    bodyJson: unknown | null,
  ): Promise<ComponentVersionRecord>;
}
