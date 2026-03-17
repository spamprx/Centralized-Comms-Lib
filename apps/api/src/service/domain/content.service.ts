import {
  getPrismaClient,
  PrismaUnitOfWork,
  type Content,
  type ContentListFilters,
  type ContentVersion,
  type LifecycleState,
  type Visibility,
} from "../../repository";
import type { AuditContext } from "../context";

type TipTapDocument = unknown;

const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  DRAFT: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["DRAFT", "PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED", "IN_REVIEW"],
  ARCHIVED: ["DRAFT"],
};

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Date.now().toString(36)
  );
}

export const contentService = {
  async createDraft(
    ctx: AuditContext,
    input: { title: string; body?: TipTapDocument | null; aiGenerated?: boolean },
  ): Promise<{ content: Content; version: ContentVersion }> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const slug = slugify(input.title);
      const content = await repos.content.createDraft({
        title: input.title,
        slug,
        authorId: ctx.actorId,
        aiGenerated: input.aiGenerated ?? false,
      });
      const version = await repos.content.createVersion({
        contentId: content.id,
        authorId: ctx.actorId,
        changeType: input.aiGenerated ? "AI_GENERATED" : "MANUAL_SAVE",
        title: input.title,
        metadataSnapshot: { body: input.body ?? null },
      });
      await repos.audit.append({
        action: "CREATE",
        resource: "CONTENT",
        resourceId: content.id,
        newValue: { title: input.title, slug, lifecycleState: "DRAFT" },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { content, version };
    });
  },

  async list(filters: ContentListFilters): Promise<Content[]> {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.content.list(filters);
  },

  async getById(id: string): Promise<{
    content: Content;
    tags: Array<{ id: string; name: string; slug: string }>;
    versions: ContentVersion[];
  } | null> {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    const content = await repos.content.getById(id);
    if (!content) return null;
    const tags = await repos.tag.listForContent(content.id);
    const versions = await repos.content.listVersions(content.id);
    return { content, tags, versions };
  },

  async updateTitle(
    ctx: AuditContext,
    contentId: string,
    title: string,
  ): Promise<Content | null> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const existing = await repos.content.getById(contentId);
      if (!existing) return null;
      const updated = await repos.content.updateTitle(contentId, title);
      await repos.content.createVersion({
        contentId: updated.id,
        authorId: ctx.actorId,
        changeType: "MANUAL_SAVE",
        title,
      });
      await repos.audit.append({
        action: "UPDATE",
        resource: "CONTENT",
        resourceId: updated.id,
        oldValue: { title: existing.title },
        newValue: { title },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return updated;
    });
    return result;
  },

  async saveBody(
    ctx: AuditContext,
    contentId: string,
    input: { body?: TipTapDocument | null; title?: string },
  ): Promise<
    | { version: ContentVersion }
    | { notFound: true }
    | { forbidden: true }
    | { invalidState: true; state: LifecycleState }
  > {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const content = await repos.content.getById(contentId);
      if (!content) return { notFound: true } as const;
      if (content.authorId !== ctx.actorId) return { forbidden: true } as const;
      if (content.lifecycleState !== "DRAFT" && content.lifecycleState !== "IN_REVIEW") {
        return { invalidState: true, state: content.lifecycleState } as const;
      }
      let currentTitle = content.title;
      if (input.title && input.title.trim()) {
        await repos.content.updateTitle(contentId, input.title.trim());
        currentTitle = input.title.trim();
      }
      const version = await repos.content.createVersion({
        contentId,
        authorId: ctx.actorId,
        changeType: "MANUAL_SAVE",
        title: currentTitle,
        metadataSnapshot: { body: input.body ?? null },
      });
      await repos.audit.append({
        action: "BODY_SAVE",
        resource: "CONTENT_VERSION",
        resourceId: version.id,
        newValue: { contentId, versionNumber: version.versionNumber },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      await repos.outbox.add({
        aggregateType: "CONTENT",
        aggregateId: contentId,
        eventType: "CONTENT.BODY_SAVED",
        payload: { contentId, versionId: version.id, versionNumber: version.versionNumber },
      });
      return { version };
    });
    return result;
  },

  async transitionState(
    ctx: AuditContext,
    contentId: string,
    lifecycleState: LifecycleState,
  ): Promise<
    | { content: Content }
    | { notFound: true }
    | { invalidTransition: true; current: LifecycleState }
  > {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const existing = await repos.content.getById(contentId);
      if (!existing) return { notFound: true } as const;
      const allowed = VALID_TRANSITIONS[existing.lifecycleState] ?? [];
      if (!allowed.includes(lifecycleState)) {
        return { invalidTransition: true, current: existing.lifecycleState } as const;
      }
      const updated = await repos.content.updateLifecycleState(contentId, lifecycleState);
      await repos.content.createVersion({
        contentId: updated.id,
        authorId: ctx.actorId,
        changeType: "STATE_TRANSITION",
        title: updated.title,
        metadataSnapshot: { from: existing.lifecycleState, to: lifecycleState },
      });
      await repos.audit.append({
        action: "STATE_TRANSITION",
        resource: "CONTENT",
        resourceId: updated.id,
        oldValue: { lifecycleState: existing.lifecycleState },
        newValue: { lifecycleState },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      await repos.outbox.add({
        aggregateType: "CONTENT",
        aggregateId: updated.id,
        eventType: `CONTENT.${lifecycleState}`,
        payload: { contentId: updated.id, from: existing.lifecycleState, to: lifecycleState },
      });
      return { content: updated };
    });
    return result;
  },

  async updateVisibility(
    ctx: AuditContext,
    contentId: string,
    visibility: Visibility,
    visibilityGroupId?: string | null,
  ): Promise<Content | null> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const existing = await repos.content.getById(contentId);
      if (!existing) return null;
      const updated = await repos.content.updateVisibility(contentId, visibility);
      if (visibility === "PRIVATE_TO_GROUP" && visibilityGroupId) {
        await repos.content.bindVisibilityGroup(contentId, visibilityGroupId);
      } else if (visibility !== "PRIVATE_TO_GROUP") {
        await repos.content.bindVisibilityGroup(contentId, null);
      }
      await repos.audit.append({
        action: "VISIBILITY_CHANGE",
        resource: "CONTENT",
        resourceId: updated.id,
        oldValue: { visibility: existing.visibility },
        newValue: { visibility, visibilityGroupId: visibilityGroupId ?? null },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return updated;
    });
  },

  async assignTag(ctx: AuditContext, contentId: string, tagId: string): Promise<void> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    await uow.withTransaction(async (repos) => {
      await repos.tag.assignToContent(contentId, tagId);
      await repos.audit.append({
        action: "TAG_ASSIGN",
        resource: "CONTENT",
        resourceId: contentId,
        newValue: { tagId },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    });
  },

  async removeTag(ctx: AuditContext, contentId: string, tagId: string): Promise<void> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    await uow.withTransaction(async (repos) => {
      await repos.tag.removeFromContent(contentId, tagId);
      await repos.audit.append({
        action: "TAG_REMOVE",
        resource: "CONTENT",
        resourceId: contentId,
        oldValue: { tagId },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    });
  },

  async listVersions(contentId: string): Promise<ContentVersion[]> {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.content.listVersions(contentId);
  },
};
