import {
  getPrismaClient,
  PrismaUnitOfWork,
  type Content,
  type ContentListFilters,
  type ContentVersion,
  type LifecycleState,
  type TipTapDocument,
  type Visibility,
} from "../../repository";
import type { AuditContext } from "../../shared/context";

const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  DRAFT: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["DRAFT", "PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED", "IN_REVIEW"],
  ARCHIVED: ["DRAFT"],
};

function canViewContent(
  content: Content,
  requester: { id: string; isAdmin?: boolean } | null,
  requesterGroups: Array<{ id: string }> = [],
  isCoAuthor = false,
): boolean {
  const visibility = content.visibility as Visibility;

  // Unauthenticated: only PUBLIC content is visible
  if (!requester) {
    return visibility === "PUBLIC";
  }

  // Admins, authors and accepted co-authors can always see
  if (requester.isAdmin || content.authorId === requester.id || isCoAuthor) {
    return true;
  }

  switch (visibility) {
    case "PUBLIC":
      return true;
    case "PRIVATE":
    case "HIDDEN":
    case "ARCHIVED":
      return false;
    case "PRIVATE_TO_GROUP": {
      if (!content.visibilityGroupId) return false;
      return requesterGroups.some((g) => g.id === content.visibilityGroupId);
    }
    default:
      return false;
  }
}

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
        body: input.body ?? null,
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

  async list(
    filters: ContentListFilters,
    requester: { id: string; isAdmin?: boolean } | null = null,
  ): Promise<Content[]> {
    const uow = new PrismaUnitOfWork(getPrismaClient());
    const repos = uow.repos();
    const contents = await repos.content.list(filters);

    if (!requester) {
      return contents.filter((c) => canViewContent(c, null));
    }

    const groups = await repos.userRole.listGroupsForUser(requester.id);
    // For listing we don't expand co-authors per content (costly); visibility
    // rules here treat co-authors like regular viewers.
    return contents.filter((c) => canViewContent(c, requester, groups));
  },

  async getById(
    id: string,
    requester: { id: string; isAdmin?: boolean } | null = null,
  ): Promise<{
    content: Content;
    tags: Array<{ id: string; name: string; slug: string }>;
    versions: ContentVersion[];
    coAuthors: Array<{ id: string; displayName: string; email: string }>;
  } | null> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();
    const content = await repos.content.getById(id);
    if (!content) return null;

    // Check if requester is an accepted co-author for this content
    let isCoAuthor = false;
    if (requester) {
      const co = await prisma.contentCoAuthor.findUnique({
        where: { contentId_userId: { contentId: id, userId: requester.id } },
        select: { status: true },
      });
      isCoAuthor = !!co && co.status === "ACCEPTED";
    }

    // Check if requester is an assigned reviewer on any review request for this content
    let isReviewer = false;
    if (requester) {
      const reviewAssignment = await prisma.reviewAssignment.findFirst({
        where: {
          reviewerId: requester.id,
          reviewRequest: { contentId: id },
        },
      });
      isReviewer = !!reviewAssignment;
    }

    const groups = requester ? await repos.userRole.listGroupsForUser(requester.id) : [];
    if (!isReviewer && !canViewContent(content, requester, groups, isCoAuthor)) {
      return null;
    }

    const tags = await repos.tag.listForContent(content.id);
    const versions = await repos.content.listVersions(content.id);
    const coAuthorsRows = await prisma.contentCoAuthor.findMany({
      where: { contentId: id, status: "ACCEPTED" },
      include: { user: true },
    });
    const coAuthors = coAuthorsRows.map((row: { user: { id: string; displayName: string; email: string } }) => ({
      id: row.user.id,
      displayName: row.user.displayName,
      email: row.user.email,
    }));

    return { content, tags, versions, coAuthors };
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
        body: input.body ?? null,
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
    | { forbidden: true }
    | { invalidTransition: true; current: LifecycleState }
  > {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const existing = await repos.content.getById(contentId);
      if (!existing) return { notFound: true } as const;
      if (existing.authorId !== ctx.actorId && !ctx.isAdmin) return { forbidden: true } as const;
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
  ): Promise<{ content: Content } | { notFound: true } | { forbidden: true }> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const existing = await repos.content.getById(contentId);
      if (!existing) return { notFound: true } as const;
      if (existing.authorId !== ctx.actorId && !ctx.isAdmin) return { forbidden: true } as const;
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
      return { content: updated };
    });
  },

  async assignTag(
    ctx: AuditContext,
    contentId: string,
    tagId: string,
  ): Promise<{ ok: true } | { notFound: true } | { forbidden: true }> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const content = await repos.content.getById(contentId);
      if (!content) return { notFound: true } as const;
      if (content.authorId !== ctx.actorId && !ctx.isAdmin) return { forbidden: true } as const;
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
      return { ok: true } as const;
    });
  },

  async removeTag(
    ctx: AuditContext,
    contentId: string,
    tagId: string,
  ): Promise<{ ok: true } | { notFound: true } | { forbidden: true }> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const content = await repos.content.getById(contentId);
      if (!content) return { notFound: true } as const;
      if (content.authorId !== ctx.actorId && !ctx.isAdmin) return { forbidden: true } as const;
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
      return { ok: true } as const;
    });
  },

  async listVersions(contentId: string): Promise<ContentVersion[]> {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.content.listVersions(contentId);
  },

  async requestCoAuthor(
    ctx: AuditContext,
    contentId: string,
    userId: string,
  ): Promise<
    | { created: true }
    | { notFound: true }
    | { forbidden: true }
    | { alreadyPending: true }
    | { alreadyCoAuthor: true }
  > {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    return uow.withTransaction(async (repos) => {
      const content = await repos.content.getById(contentId);
      if (!content) return { notFound: true } as const;

      // Only the main author can request co-authors
      if (content.authorId !== ctx.actorId) {
        return { forbidden: true } as const;
      }

      // Do not allow inviting self explicitly
      if (userId === content.authorId) {
        return { alreadyCoAuthor: true } as const;
      }

      const existing = await prisma.contentCoAuthor.findUnique({
        where: { contentId_userId: { contentId, userId } },
      });

      if (existing) {
        if (existing.status === "ACCEPTED") return { alreadyCoAuthor: true } as const;
        if (existing.status === "PENDING") return { alreadyPending: true } as const;

        // If previously rejected, reset to pending
        await prisma.contentCoAuthor.update({
          where: { contentId_userId: { contentId, userId } },
          data: { status: "PENDING", decidedAt: null },
        });
        return { created: true } as const;
      }

      await prisma.contentCoAuthor.create({
        data: {
          contentId,
          userId,
          requestedById: ctx.actorId,
          status: "PENDING",
        },
      });

      await repos.audit.append({
        action: "COAUTHOR_REQUEST",
        resource: "CONTENT",
        resourceId: contentId,
        newValue: { userId },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      await repos.outbox.add({
        aggregateType: "CONTENT",
        aggregateId: contentId,
        eventType: "CONTENT.COAUTHOR_REQUESTED",
        payload: { contentId, userId, requestedById: ctx.actorId },
      });

      return { created: true } as const;
    });
  },

  async respondToCoAuthorRequest(
    ctx: AuditContext,
    contentId: string,
    decision: "APPROVE" | "REJECT",
  ): Promise<
    | { updated: true; accepted: boolean }
    | { notFound: true }
  > {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);

    return uow.withTransaction(async (repos) => {
      const request = await prisma.contentCoAuthor.findUnique({
        where: { contentId_userId: { contentId, userId: ctx.actorId } },
      });

      if (!request || request.status !== "PENDING") {
        return { notFound: true } as const;
      }

      const accepted = decision === "APPROVE";
      await prisma.contentCoAuthor.update({
        where: { contentId_userId: { contentId, userId: ctx.actorId } },
        data: {
          status: accepted ? "ACCEPTED" : "REJECTED",
          decidedAt: new Date(),
        },
      });

      await repos.audit.append({
        action: "COAUTHOR_RESPONSE",
        resource: "CONTENT",
        resourceId: contentId,
        newValue: { userId: ctx.actorId, accepted },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      await repos.outbox.add({
        aggregateType: "CONTENT",
        aggregateId: contentId,
        eventType: accepted ? "CONTENT.COAUTHOR_ACCEPTED" : "CONTENT.COAUTHOR_REJECTED",
        payload: { contentId, userId: ctx.actorId, requestedById: request.requestedById },
      });

      return { updated: true, accepted } as const;
    });
  },
};
