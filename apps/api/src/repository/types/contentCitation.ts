export interface ContentCitationRecord {
  id: string;
  contentId: string;
  referenceType: string;
  referenceId: string;
  label: string | null;
  metadata: unknown | null;
  createdAt: Date;
}
