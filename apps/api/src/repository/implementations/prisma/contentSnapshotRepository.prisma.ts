import type {
  ContentSnapshotRepository,
  CreateContentSnapshotInput,
} from "../../interfaces/contentSnapshotRepository";
import type { ContentSnapshotRecord } from "../../types";
import type { PrismaDb } from "./prismaTypes";

function toRecord(row: {
  id: string;
  contentId: string;
  fromVersionNumber: number | null;
  toVersionNumber: number;
  diffMetadata: unknown;
  mongoDocumentId: string | null;
  createdAt: Date;
  createdById: string | null;
}): ContentSnapshotRecord {
  return {
    id: row.id,
    contentId: row.contentId,
    fromVersionNumber: row.fromVersionNumber,
    toVersionNumber: row.toVersionNumber,
    diffMetadata: row.diffMetadata,
    mongoDocumentId: row.mongoDocumentId,
    createdAt: row.createdAt,
    createdById: row.createdById,
  };
}

export class PrismaContentSnapshotRepository implements ContentSnapshotRepository {
  public constructor(private readonly db: PrismaDb) {}

  async create(
    input: CreateContentSnapshotInput,
  ): Promise<ContentSnapshotRecord> {
    const row = await this.db.contentSnapshot.create({
      data: {
        contentId: input.contentId,
        fromVersionNumber: input.fromVersionNumber ?? null,
        toVersionNumber: input.toVersionNumber,
        diffMetadata: input.diffMetadata as object,
        mongoDocumentId: input.mongoDocumentId ?? null,
        createdById: input.createdById ?? null,
      },
    });
    return toRecord(row);
  }

  async getById(id: string): Promise<ContentSnapshotRecord | null> {
    const row = await this.db.contentSnapshot.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async listForContent(
    contentId: string,
    limit = 50,
  ): Promise<ContentSnapshotRecord[]> {
    const rows = await this.db.contentSnapshot.findMany({
      where: { contentId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toRecord);
  }

  async updateMongoRef(
    id: string,
    mongoDocumentId: string | null,
  ): Promise<ContentSnapshotRecord> {
    const row = await this.db.contentSnapshot.update({
      where: { id },
      data: { mongoDocumentId },
    });
    return toRecord(row);
  }
}
