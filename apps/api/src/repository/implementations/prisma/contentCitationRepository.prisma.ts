import type {
  ContentCitationRepository,
  CreateContentCitationInput,
} from "../../interfaces/contentCitationRepository";
import type { ContentCitationRecord } from "../../types";
import type { PrismaDb } from "./prismaTypes";

function toRecord(row: {
  id: string;
  contentId: string;
  referenceType: string;
  referenceId: string;
  label: string | null;
  metadata: unknown;
  createdAt: Date;
}): ContentCitationRecord {
  return {
    id: row.id,
    contentId: row.contentId,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    label: row.label,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt,
  };
}

export class PrismaContentCitationRepository implements ContentCitationRepository {
  public constructor(private readonly db: PrismaDb) {}

  async create(
    input: CreateContentCitationInput,
  ): Promise<ContentCitationRecord> {
    const row = await this.db.contentCitation.create({
      data: {
        contentId: input.contentId,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        label: input.label ?? null,
        metadata:
          input.metadata === undefined ? undefined : (input.metadata as object),
      },
    });
    return toRecord(row);
  }

  async getById(id: string): Promise<ContentCitationRecord | null> {
    const row = await this.db.contentCitation.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async listForContent(contentId: string): Promise<ContentCitationRecord[]> {
    const rows = await this.db.contentCitation.findMany({
      where: { contentId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRecord);
  }

  async delete(id: string): Promise<void> {
    await this.db.contentCitation.delete({ where: { id } });
  }
}
