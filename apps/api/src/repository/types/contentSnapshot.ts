export interface ContentSnapshotRecord {
  id: string;
  contentId: string;
  fromVersionNumber: number | null;
  toVersionNumber: number;
  diffMetadata: unknown;
  mongoDocumentId: string | null;
  createdAt: Date;
  createdById: string | null;
}
