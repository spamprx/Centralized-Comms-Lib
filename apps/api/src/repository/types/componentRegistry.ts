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
  linkRefs: unknown;
  propSchema: unknown | null;
  createdAt: Date;
}
