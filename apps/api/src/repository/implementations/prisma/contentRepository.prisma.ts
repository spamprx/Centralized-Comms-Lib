import type { ContentRepository } from "../../interfaces";
import type {
  Content,
  ContentListFilters,
  ContentVersion,
  CreateContentVersionInput,
  CreateDraftInput,
  LifecycleState,
  TipTapDocument,
  VersionChangeType,
  Visibility,
} from "../../types";
import type { PrismaDb } from "./prismaTypes";

function toContent(row: {
  id: string;
  title: string;
  slug: string;
  lifecycleState: string;
  visibility: string;
  aiGenerated: boolean;
  authorId: string;
  visibilityGroupId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Content {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    lifecycleState: row.lifecycleState as LifecycleState,
    visibility: row.visibility as Visibility,
    aiGenerated: row.aiGenerated,
    authorId: row.authorId,
    visibilityGroupId: row.visibilityGroupId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toVersion(row: {
  id: string;
  versionNumber: number;
  changeType: string;
  title: string;
  body?: unknown;
  metadataSnapshot: unknown;
  contentId: string;
  authorId: string;
  createdAt: Date;
}): ContentVersion {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    changeType: row.changeType as VersionChangeType,
    title: row.title,
    body: row.body != null && typeof row.body === "object" && !Array.isArray(row.body)
      ? (row.body as TipTapDocument)
      : null,
    metadataSnapshot: row.metadataSnapshot ?? null,
    contentId: row.contentId,
    authorId: row.authorId,
    createdAt: row.createdAt,
  };
}

export class PrismaContentRepository implements ContentRepository {
  public constructor(private readonly db: PrismaDb) {}

  async createDraft(input: CreateDraftInput): Promise<Content> {
    const row = await this.db.content.create({
      data: {
        title: input.title,
        slug: input.slug,
        authorId: input.authorId,
        aiGenerated: input.aiGenerated ?? false,
      },
    });

    return toContent(row);
  }

  async getById(id: string): Promise<Content | null> {
    const row = await this.db.content.findUnique({ where: { id } });
    return row ? toContent(row) : null;
  }

  async getBySlug(slug: string): Promise<Content | null> {
    const row = await this.db.content.findUnique({ where: { slug } });
    return row ? toContent(row) : null;
  }

  async list(filters?: ContentListFilters): Promise<Content[]> {
    const where: Record<string, unknown> = {};
    if (filters?.authorId) where.authorId = filters.authorId;
    if (filters?.lifecycleState) where.lifecycleState = filters.lifecycleState;
    if (filters?.visibility) where.visibility = filters.visibility;

    const rows = await this.db.content.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters?.limit ?? 50,
      skip: filters?.offset ?? 0,
    });
    return rows.map(toContent);
  }

  async updateTitle(contentId: string, title: string): Promise<Content> {
    const row = await this.db.content.update({
      where: { id: contentId },
      data: { title },
    });
    return toContent(row);
  }

  async updateLifecycleState(
    contentId: string,
    lifecycleState: LifecycleState,
  ): Promise<Content> {
    const row = await this.db.content.update({
      where: { id: contentId },
      data: { lifecycleState },
    });
    return toContent(row);
  }

  async updateVisibility(contentId: string, visibility: Visibility): Promise<Content> {
    const row = await this.db.content.update({
      where: { id: contentId },
      data: { visibility },
    });
    return toContent(row);
  }

  async bindVisibilityGroup(
    contentId: string,
    visibilityGroupId: string | null,
  ): Promise<Content> {
    const row = await this.db.content.update({
      where: { id: contentId },
      data: { visibilityGroupId },
    });
    return toContent(row);
  }

  async createVersion(input: CreateContentVersionInput): Promise<ContentVersion> {
    const latest = await this.getLatestVersion(input.contentId);
    const nextVersion = latest ? latest.versionNumber + 1 : 1;

    const row = await this.db.contentVersion.create({
      data: {
        contentId: input.contentId,
        authorId: input.authorId,
        changeType: input.changeType,
        title: input.title,
        ...(input.body != null && { body: input.body as object }),
        ...(input.metadataSnapshot != null && { metadataSnapshot: input.metadataSnapshot as object }),
        versionNumber: nextVersion,
      },
    });
    return toVersion(row);
  }

  async listVersions(contentId: string): Promise<ContentVersion[]> {
    const rows = await this.db.contentVersion.findMany({
      where: { contentId },
      orderBy: { versionNumber: "desc" },
    });
    return rows.map(toVersion);
  }

  async getLatestVersion(contentId: string): Promise<ContentVersion | null> {
    const row = await this.db.contentVersion.findFirst({
      where: { contentId },
      orderBy: { versionNumber: "desc" },
    });
    return row ? toVersion(row) : null;
  }
}
