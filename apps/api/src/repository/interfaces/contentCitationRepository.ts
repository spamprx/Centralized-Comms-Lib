import type { ContentCitationRecord } from "../types";

export interface CreateContentCitationInput {
  contentId: string;
  referenceType: string;
  referenceId: string;
  label?: string | null;
  metadata?: unknown | null;
}

export interface ContentCitationRepository {
  create(input: CreateContentCitationInput): Promise<ContentCitationRecord>;
  getById(id: string): Promise<ContentCitationRecord | null>;
  listForContent(contentId: string): Promise<ContentCitationRecord[]>;
  delete(id: string): Promise<void>;
}
