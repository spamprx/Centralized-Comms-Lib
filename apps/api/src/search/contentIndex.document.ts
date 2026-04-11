import type { PrismaClient } from "@prisma/client";
import { tiptapToPlainText } from "./tiptapPlainText";

export interface ContentIndexDocument {
  contentId: string;
  workspaceId: string;
  lifecycleState: string;
  visibility: string;
  authorId: string;
  templateId: string | null;
  channelIds: string[];
  tagIds: string[];
  tagSlugs: string[];
  aiGenerated: boolean;
  title: string;
  summary: string;
  body: string;
  bodyPlain: string;
  tags: string[];
  slug: string;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
  indexedAt: string;
  engagementScore: number;
  titleEmbedding?: number[];
}

async function resolveDefaultWorkspaceId(prisma: PrismaClient): Promise<string | null> {
  const slug = process.env.DEFAULT_WORKSPACE_SLUG?.trim() || "default";
  const ws = await prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
  return ws?.id ?? null;
}

async function findFirstPublishedAt(
  prisma: PrismaClient,
  contentId: string,
): Promise<Date | null> {
  const rows = await prisma.contentVersion.findMany({
    where: { contentId, changeType: "STATE_TRANSITION" },
    orderBy: { versionNumber: "asc" },
    select: { createdAt: true, metadataSnapshot: true },
  });
  for (const row of rows) {
    const meta = row.metadataSnapshot as { to?: string } | null;
    if (meta?.to === "PUBLISHED") return row.createdAt;
  }
  return null;
}

/**
 * Loads a content row and related data and returns the Elasticsearch document shape.
 * Returns `null` if the content row does not exist.
 */
export async function buildContentIndexDocument(
  prisma: PrismaClient,
  contentId: string,
): Promise<ContentIndexDocument | null> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: {
      tags: { include: { tag: true } },
      template: {
        include: {
          bindings: { select: { channelId: true } },
        },
      },
    },
  });
  if (!content) return null;

  const latest = await prisma.contentVersion.findFirst({
    where: { contentId },
    orderBy: { versionNumber: "desc" },
  });

  const bodyJson = latest?.body;
  const bodyPlain =
    bodyJson != null && typeof bodyJson === "object"
      ? tiptapToPlainText(bodyJson)
      : "";
  const summary =
    bodyPlain.length > 500 ? `${bodyPlain.slice(0, 497)}...` : bodyPlain;

  const defaultWs = await resolveDefaultWorkspaceId(prisma);
  const workspaceId = content.template?.workspaceId ?? defaultWs ?? "unknown";

  const channelIds =
    content.template?.bindings.map((b: { channelId: string }) => b.channelId) ?? [];
  const tagIds = content.tags.map((ct: { tagId: string }) => ct.tagId);
  const tagSlugs = content.tags.map((ct: { tag: { slug: string } }) => ct.tag.slug);
  const tagNames = content.tags.map((ct: { tag: { name: string } }) => ct.tag.name);

  let publishedAt: Date | null = null;
  if (content.lifecycleState === "PUBLISHED") {
    publishedAt = await findFirstPublishedAt(prisma, contentId);
    if (!publishedAt) publishedAt = content.updatedAt;
  }

  const doc: ContentIndexDocument = {
    contentId: content.id,
    workspaceId,
    lifecycleState: content.lifecycleState,
    visibility: content.visibility,
    authorId: content.authorId,
    templateId: content.templateId,
    channelIds,
    tagIds,
    tagSlugs,
    aiGenerated: content.aiGenerated,
    title: content.title,
    summary,
    body: bodyPlain,
    bodyPlain,
    tags: tagNames,
    slug: content.slug,
    publishedAt: publishedAt ? publishedAt.toISOString() : null,
    updatedAt: content.updatedAt.toISOString(),
    createdAt: content.createdAt.toISOString(),
    indexedAt: new Date().toISOString(),
    engagementScore: 0,
  };

  return doc;
}
