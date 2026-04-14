import type { ContentSnapshotRecord } from "../types";

export interface CreateContentSnapshotInput {
  contentId: string;
  fromVersionNumber?: number | null;
  toVersionNumber: number;
  diffMetadata: unknown;
  mongoDocumentId?: string | null;
  createdById?: string | null;
}

export interface ContentSnapshotRepository {
  create(input: CreateContentSnapshotInput): Promise<ContentSnapshotRecord>;
  getById(id: string): Promise<ContentSnapshotRecord | null>;
  listForContent(contentId: string, limit?: number): Promise<ContentSnapshotRecord[]>;
  updateMongoRef(id: string, mongoDocumentId: string | null): Promise<ContentSnapshotRecord>;
}
