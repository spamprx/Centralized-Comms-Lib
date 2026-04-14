export interface ComponentRecord {
  id: string;
  key: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComponentVersionRecord {
  id: string;
  componentId: string;
  version: string;
  /** Canonical TipTap doc for this version (library body). */
  bodyJson: unknown | null;
  linkRefs: unknown;
  propSchema: unknown | null;
  createdAt: Date;
}

/** Component row plus newest version by `createdAt` (for library UI / insert). */
export type ComponentLibraryRecord = ComponentRecord & {
  latestVersion: Pick<
    ComponentVersionRecord,
    "id" | "version" | "bodyJson"
  > | null;
};
