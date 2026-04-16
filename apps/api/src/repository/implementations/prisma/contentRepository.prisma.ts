import type { ContentRepository } from "../../interfaces";
import type {
  Content,
  ContentListFilters,
  ContentType,
  ContentVersion,
  CreateContentVersionInput,
  CreateDraftInput,
  LifecycleState,
  TipTapDocument,
  VersionChangeType,
  Visibility,
} from "../../types";
import { Prisma } from "@prisma/client";

import type { PrismaDb } from "./prismaTypes";

function toContent(row: {
  id: string;
  title: string;
  slug: string;
  lifecycleState: string;
  visibility: string;
  contentType: string;
  aiGenerated: boolean;
  authorId: string;
  visibilityGroupId: string | null;
  templateId: string | null;
  channelId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Content {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    lifecycleState: row.lifecycleState as LifecycleState,
    visibility: row.visibility as Visibility,
    contentType: row.contentType as ContentType,
    aiGenerated: row.aiGenerated,
    authorId: row.authorId,
    visibilityGroupId: row.visibilityGroupId,
    templateId: row.templateId ?? null,
    channelId: row.channelId ?? null,
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
    body:
      row.body != null &&
      typeof row.body === "object" &&
      !Array.isArray(row.body)
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
        contentType: (input.contentType ?? "ARTICLE") as any,
        templateId: input.templateId ?? undefined,
        channelId: input.channelId ?? undefined,
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
    if (filters?.contentType) where.contentType = filters.contentType;

    const rows = await this.db.content.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters?.limit ?? 50,
      skip: filters?.offset ?? 0,
    });
    return rows.map(toContent);
  }

  async delete(contentId: string): Promise<void> {
    await this.db.content.delete({ where: { id: contentId } });
  }

  async updateTitle(contentId: string, title: string): Promise<Content> {
    const row = await this.db.content.update({
      where: { id: contentId },
      data: { title },
    });
    return toContent(row);
  }

  async updateContentType(
    contentId: string,
    contentType: ContentType,
  ): Promise<Content> {
    const row = await this.db.content.update({
      where: { id: contentId },
      data: { contentType: contentType as any },
    });
    return toContent(row);
  }

  async updateTemplateId(
    contentId: string,
    templateId: string | null,
  ): Promise<Content> {
    const row = await this.db.content.update({
      where: { id: contentId },
      data: { templateId },
    });
    return toContent(row);
  }

  async updateChannelId(
    contentId: string,
    channelId: string | null,
  ): Promise<Content> {
    const row = await this.db.content.update({
      where: { id: contentId },
      data: { channelId },
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

  async updateVisibility(
    contentId: string,
    visibility: Visibility,
  ): Promise<Content> {
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

  async createVersion(
    input: CreateContentVersionInput,
  ): Promise<ContentVersion> {
    const latest = await this.getLatestVersion(input.contentId);
    const nextVersion = latest ? latest.versionNumber + 1 : 1;

    const row = await this.db.contentVersion.create({
      data: {
        contentId: input.contentId,
        authorId: input.authorId,
        changeType: input.changeType,
        title: input.title,
        ...(input.body != null && { body: input.body as object }),
        ...(input.metadataSnapshot != null && {
          metadataSnapshot: input.metadataSnapshot as object,
        }),
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

  async isAcceptedCoAuthor(
    contentId: string,
    userId: string,
  ): Promise<boolean> {
    const row = await this.db.contentCoAuthor.findUnique({
      where: { contentId_userId: { contentId, userId } },
      select: { status: true },
    });
    return row?.status === "ACCEPTED";
  }

  async getVersionWithBodyAtOrBefore(
    contentId: string,
    maxVersionNumber: number,
  ): Promise<ContentVersion | null> {
    const rows = await this.db.contentVersion.findMany({
      where: {
        contentId,
        versionNumber: { lte: maxVersionNumber },
      },
      orderBy: { versionNumber: "desc" },
      take: 500,
    });
    for (const row of rows) {
      if (row.body != null) return toVersion(row);
    }
    return null;
  }

  async listLatestContentVersionsMaybeReferencingComponentVersion(
    componentVersionId: string,
  ): Promise<
    Array<{
      contentVersionId: string;
      contentId: string;
      body: TipTapDocument | null;
    }>
  > {
    const pattern = `%${componentVersionId}%`;
    const rows = await this.db.$queryRaw<
      Array<{ id: string; contentId: string; body: unknown }>
    >(Prisma.sql`
      SELECT DISTINCT ON (cv."contentId") cv.id, cv."contentId", cv.body
      FROM content_versions cv
      WHERE cv.body IS NOT NULL
      AND cv.body::text LIKE ${pattern}
      ORDER BY cv."contentId", cv."versionNumber" DESC
    `);
    return rows.map((r) => ({
      contentVersionId: r.id,
      contentId: r.contentId,
      body:
        r.body != null && typeof r.body === "object" && !Array.isArray(r.body)
          ? (r.body as TipTapDocument)
          : null,
    }));
  }
}
