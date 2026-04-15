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
import type { FormattingViolation } from "../template/formattingRules.types";
import { enforceFormattingRules } from "../template/templateFormatting.enforcement";
import { getFormattingRulesForTemplateId } from "../template/formattingRule.service";
import { recordSnapshotForVersion } from "./content.snapshot";
import {
  buildPlainTextForSnapshotSide,
  computeWordDiff,
  sideSummary,
  type SnapshotWordDiffResult,
} from "./snapshotWordDiff";
import { syncContentIndexFromDb } from "../search/contentSearch.service";
import {
  collectLinkedComponentVersionIds,
  isTipTapDoc,
  refreshLinkedNodesInDocument,
} from "../component/libraryComponent";

const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  DRAFT: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["DRAFT", "PUBLISHED", "ARCHIVED"],
  // Allow returning to draft for edits.
  PUBLISHED: ["ARCHIVED", "IN_REVIEW", "DRAFT"],
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
    input: {
      title: string;
      body?: TipTapDocument | null;
      aiGenerated?: boolean;
      templateId?: string | null;
      contentType?: "ARTICLE" | "VIDEO" | "PODCAST" | "DOCUMENT";
    },
  ): Promise<
    | { content: Content; version: ContentVersion }
    | { invalidFormatting: true; violations: FormattingViolation[] }
  > {
    const rules = await getFormattingRulesForTemplateId(
      input.templateId ?? undefined,
    );
    const violations = enforceFormattingRules(input.body ?? null, rules);
    if (violations.length > 0) {
      return { invalidFormatting: true, violations };
    }

    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const slug = slugify(input.title);
      const content = await repos.content.createDraft({
        title: input.title,
        slug,
        authorId: ctx.actorId,
        aiGenerated: input.aiGenerated ?? false,
        contentType: input.contentType ?? "ARTICLE",
        templateId: input.templateId ?? undefined,
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
    void syncContentIndexFromDb(prisma, result.content.id).catch(
      () => undefined,
    );
    const author = await prisma.user.findUnique({
      where: { id: result.content.authorId },
      select: { id: true, displayName: true, email: true },
    });
    return { ...result, content: { ...result.content, author } };
  },

  async list(
    filters: ContentListFilters,
    requester: { id: string; isAdmin?: boolean } | null = null,
  ): Promise<Array<Content & { viewsCount: number; likesCount: number }>> {
    const prisma = getPrismaClient();
    type AuthorRow = { id: string; displayName: string; email: string };
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();
    const isOwnListRequest =
      !!requester && !!filters.authorId && filters.authorId === requester.id;
    const effectiveFilters: ContentListFilters =
      requester && !requester.isAdmin && !isOwnListRequest
        ? { ...filters, lifecycleState: "PUBLISHED" }
        : filters;
    const contents = await repos.content.list(effectiveFilters);

    const visible = !requester
      ? contents.filter((c) => canViewContent(c, null))
      : (() => {
          const groupsPromise = repos.userRole.listGroupsForUser(requester.id);
          return groupsPromise.then((groups) =>
            contents.filter((c) => canViewContent(c, requester, groups)),
          );
        })();

    const visibleContents = await visible;
    const authorIds = Array.from(
      new Set(visibleContents.map((c) => c.authorId).filter(Boolean)),
    );
    const authors = (await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, displayName: true, email: true },
    })) as AuthorRow[];
    const authorById = new Map<string, AuthorRow>(
      authors.map((u) => [u.id, u]),
    );

    const contentIds = visibleContents.map((c) => c.id);
    const [viewsRows, likesRows] = await Promise.all([
      prisma.contentView.groupBy({
        by: ["contentId"],
        where: { contentId: { in: contentIds } },
        _count: { _all: true },
      }),
      prisma.contentLike.groupBy({
        by: ["contentId"],
        where: { contentId: { in: contentIds } },
        _count: { _all: true },
      }),
    ]);
    const viewsById = new Map<string, number>(
      viewsRows.map((r) => [r.contentId, r._count._all]),
    );
    const likesById = new Map<string, number>(
      likesRows.map((r) => [r.contentId, r._count._all]),
    );

    return visibleContents.map((c) => ({
      ...c,
      author: authorById.get(c.authorId) ?? null,
      viewsCount: viewsById.get(c.id) ?? 0,
      likesCount: likesById.get(c.id) ?? 0,
    }));
  },

  /**
   * Content the user owns (primary author) plus items where they are an accepted co-author.
   */
  async listWorkspace(requester: {
    id: string;
    isAdmin?: boolean;
  }): Promise<
    Array<
      Content & {
        author: { id: string; displayName: string; email: string } | null;
        viewsCount: number;
        likesCount: number;
        workspaceRole: "author" | "co_author";
        acceptedCoAuthorCount: number;
      }
    >
  > {
    const prisma = getPrismaClient();
    type AuthorRow = { id: string; displayName: string; email: string };
    const uow = new PrismaUnitOfWork(prisma);
    const repos = uow.repos();
    const groups = await repos.userRole.listGroupsForUser(requester.id);

    const authored = await repos.content.list({
      authorId: requester.id,
      limit: 500,
      offset: 0,
    });

    const coLinks = await prisma.contentCoAuthor.findMany({
      where: { userId: requester.id, status: "ACCEPTED" },
      select: { contentId: true },
    });
    const coOnlyIds = coLinks
      .map((l) => l.contentId)
      .filter((id) => !authored.some((c) => c.id === id));

    const coRows =
      coOnlyIds.length > 0
        ? await prisma.content.findMany({ where: { id: { in: coOnlyIds } } })
        : [];

    const coAsContent: Content[] = coRows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      lifecycleState: row.lifecycleState as LifecycleState,
      visibility: row.visibility as Visibility,
      contentType: row.contentType as Content["contentType"],
      aiGenerated: row.aiGenerated,
      authorId: row.authorId,
      visibilityGroupId: row.visibilityGroupId,
      templateId: row.templateId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    type Entry = { content: Content; workspaceRole: "author" | "co_author" };
    const byId = new Map<string, Entry>();
    for (const c of authored) {
      byId.set(c.id, { content: c, workspaceRole: "author" });
    }
    for (const c of coAsContent) {
      if (!byId.has(c.id)) {
        const visible = canViewContent(c, requester, groups, true);
        if (visible) {
          byId.set(c.id, { content: c, workspaceRole: "co_author" });
        }
      }
    }

    const merged = Array.from(byId.values()).filter(({ content: c, workspaceRole }) => {
      if (workspaceRole === "author") return true;
      return canViewContent(c, requester, groups, true);
    });

    const contentIds = merged.map((m) => m.content.id);
    const authorIds = Array.from(
      new Set(merged.map((m) => m.content.authorId).filter(Boolean)),
    );
    const authors = (await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, displayName: true, email: true },
    })) as AuthorRow[];
    const authorById = new Map<string, AuthorRow>(
      authors.map((u) => [u.id, u]),
    );

    const [viewsRows, likesRows, coCountRows] = await Promise.all([
      contentIds.length
        ? prisma.contentView.groupBy({
            by: ["contentId"],
            where: { contentId: { in: contentIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      contentIds.length
        ? prisma.contentLike.groupBy({
            by: ["contentId"],
            where: { contentId: { in: contentIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      contentIds.length
        ? prisma.contentCoAuthor.groupBy({
            by: ["contentId"],
            where: { contentId: { in: contentIds }, status: "ACCEPTED" },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);
    const viewsById = new Map<string, number>(
      viewsRows.map((r) => [r.contentId, r._count._all]),
    );
    const likesById = new Map<string, number>(
      likesRows.map((r) => [r.contentId, r._count._all]),
    );
    const coCountById = new Map<string, number>(
      coCountRows.map((r) => [r.contentId, r._count._all]),
    );

    return merged.map(({ content: c, workspaceRole }) => ({
      ...c,
      author: authorById.get(c.authorId) ?? null,
      viewsCount: viewsById.get(c.id) ?? 0,
      likesCount: likesById.get(c.id) ?? 0,
      workspaceRole,
      acceptedCoAuthorCount: coCountById.get(c.id) ?? 0,
    }));
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

    const groups = requester
      ? await repos.userRole.listGroupsForUser(requester.id)
      : [];
    if (
      !isReviewer &&
      !canViewContent(content, requester, groups, isCoAuthor)
    ) {
      return null;
    }

    const tags = await repos.tag.listForContent(content.id);
    const versions = await repos.content.listVersions(content.id);
    const coAuthorsRows = await prisma.contentCoAuthor.findMany({
      where: { contentId: id, status: "ACCEPTED" },
      include: { user: true },
    });
    const coAuthors = coAuthorsRows.map(
      (row: { user: { id: string; displayName: string; email: string } }) => ({
        id: row.user.id,
        displayName: row.user.displayName,
        email: row.user.email,
      }),
    );

    const author = await prisma.user.findUnique({
      where: { id: content.authorId },
      select: { id: true, displayName: true, email: true },
    });

    return { content: { ...content, author }, tags, versions, coAuthors };
  },

  async delete(
    ctx: AuditContext,
    contentId: string,
  ): Promise<{ ok: true } | { notFound: true } | { forbidden: true }> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const existing = await repos.content.getById(contentId);
      if (!existing) return { notFound: true } as const;
      if (existing.authorId !== ctx.actorId && !ctx.isAdmin)
        return { forbidden: true } as const;

      // ReviewRequest.content has no cascade; delete review graph first.
      await prisma.reviewRequest.deleteMany({ where: { contentId } });

      await repos.content.delete(contentId);
      await repos.audit.append({
        action: "DELETE",
        resource: "CONTENT",
        resourceId: contentId,
        oldValue: { title: existing.title, slug: existing.slug },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { ok: true } as const;
    });

    // Note: search-index cleanup for deletes should be handled by a dedicated endpoint/task.
    return result;
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
    if (result) {
      void syncContentIndexFromDb(prisma, contentId).catch(() => undefined);
    }
    return result;
  },

  async saveBody(
    ctx: AuditContext,
    contentId: string,
    input: {
      body?: TipTapDocument | null;
      title?: string;
      contentType?: "ARTICLE" | "VIDEO" | "PODCAST" | "DOCUMENT";
      /** When set, save fails if the latest revision number no longer matches (non-live multi-editor safety). */
      baseVersionNumber?: number;
    },
  ): Promise<
    | { version: ContentVersion }
    | { notFound: true }
    | { forbidden: true }
    | { invalidState: true; state: LifecycleState }
    | { invalidFormatting: true; violations: FormattingViolation[] }
    | { conflict: true; currentVersionNumber: number }
  > {
    const prisma = getPrismaClient();
    const existingForRules = await prisma.content.findUnique({
      where: { id: contentId },
      select: { templateId: true },
    });
    const rules = await getFormattingRulesForTemplateId(
      existingForRules?.templateId,
    );

    let effectiveBody: TipTapDocument | null | undefined = input.body;
    if (input.body !== undefined && input.body !== null) {
      const ids = collectLinkedComponentVersionIds(input.body);
      if (ids.length > 0) {
        const repos = new PrismaUnitOfWork(prisma).repos();
        const canonicalByVersionId = new Map<string, TipTapDocument | null>();
        for (const id of ids) {
          const ver = await repos.componentRegistry.getVersionById(id);
          const c =
            ver?.bodyJson != null && isTipTapDoc(ver.bodyJson)
              ? (ver.bodyJson as TipTapDocument)
              : null;
          canonicalByVersionId.set(id, c);
        }
        effectiveBody = refreshLinkedNodesInDocument(
          input.body,
          canonicalByVersionId,
        );
      }
    }

    let violations: FormattingViolation[] = [];
    if (input.body !== undefined) {
      violations = enforceFormattingRules(effectiveBody ?? null, rules);
    }
    if (violations.length > 0) {
      return { invalidFormatting: true, violations };
    }

    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const content = await repos.content.getById(contentId);
      if (!content) return { notFound: true } as const;
      const isAuthor = content.authorId === ctx.actorId;
      const isAdmin = !!ctx.isAdmin;
      const isCoAuthor =
        !isAuthor && !isAdmin
          ? await repos.content.isAcceptedCoAuthor(contentId, ctx.actorId)
          : false;
      if (!isAuthor && !isAdmin && !isCoAuthor) {
        return { forbidden: true } as const;
      }
      if (
        content.lifecycleState !== "DRAFT" &&
        content.lifecycleState !== "IN_REVIEW"
      ) {
        return { invalidState: true, state: content.lifecycleState } as const;
      }
      if (input.baseVersionNumber !== undefined) {
        const latest = await repos.content.getLatestVersion(contentId);
        const headNum = latest?.versionNumber ?? 0;
        if (headNum !== input.baseVersionNumber) {
          return { conflict: true, currentVersionNumber: headNum } as const;
        }
      }
      let currentTitle = content.title;
      if (input.title && input.title.trim()) {
        await repos.content.updateTitle(contentId, input.title.trim());
        currentTitle = input.title.trim();
      }
      if (input.contentType) {
        await repos.content.updateContentType(contentId, input.contentType);
      }
      const version = await repos.content.createVersion({
        contentId,
        authorId: ctx.actorId,
        changeType: "MANUAL_SAVE",
        title: currentTitle,
        body: input.body === undefined ? null : (effectiveBody ?? null),
      });
      await recordSnapshotForVersion(
        repos,
        ctx,
        contentId,
        version.versionNumber,
        "MANUAL_SAVE",
        {
          versionId: version.id,
        },
      );
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
        payload: {
          contentId,
          versionId: version.id,
          versionNumber: version.versionNumber,
        },
      });
      return { version };
    });
    if ("version" in result) {
      void syncContentIndexFromDb(prisma, contentId).catch(() => undefined);
    }
    return result;
  },

  /**
   * Writes a new content version after linked-component propagation (admin).
   * Re-applies linked sync from the component registry, then formatting rules, without author-only checks.
   */
  async savePropagatedBody(
    ctx: AuditContext,
    contentId: string,
    inputBody: TipTapDocument,
  ): Promise<
    | { version: ContentVersion }
    | { notFound: true }
    | { invalidState: true; state: LifecycleState }
    | { invalidFormatting: true; violations: FormattingViolation[] }
  > {
    const prisma = getPrismaClient();
    const existingForRules = await prisma.content.findUnique({
      where: { id: contentId },
      select: { templateId: true },
    });
    const rules = await getFormattingRulesForTemplateId(
      existingForRules?.templateId,
    );

    let effectiveBody: TipTapDocument = inputBody;
    const ids = collectLinkedComponentVersionIds(inputBody);
    if (ids.length > 0) {
      const repos = new PrismaUnitOfWork(prisma).repos();
      const canonicalByVersionId = new Map<string, TipTapDocument | null>();
      for (const id of ids) {
        const ver = await repos.componentRegistry.getVersionById(id);
        const c =
          ver?.bodyJson != null && isTipTapDoc(ver.bodyJson)
            ? (ver.bodyJson as TipTapDocument)
            : null;
        canonicalByVersionId.set(id, c);
      }
      effectiveBody = refreshLinkedNodesInDocument(
        inputBody,
        canonicalByVersionId,
      );
    }

    const violations = enforceFormattingRules(effectiveBody, rules);
    if (violations.length > 0) {
      return { invalidFormatting: true, violations };
    }

    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const content = await repos.content.getById(contentId);
      if (!content) return { notFound: true } as const;
      if (
        content.lifecycleState !== "DRAFT" &&
        content.lifecycleState !== "IN_REVIEW"
      ) {
        return { invalidState: true, state: content.lifecycleState } as const;
      }
      const version = await repos.content.createVersion({
        contentId,
        authorId: content.authorId,
        changeType: "MANUAL_SAVE",
        title: content.title,
        body: effectiveBody,
      });
      await recordSnapshotForVersion(
        repos,
        ctx,
        contentId,
        version.versionNumber,
        "MANUAL_SAVE",
        {
          versionId: version.id,
          linkedComponentPropagation: true,
        },
      );
      await repos.audit.append({
        action: "BODY_SAVE",
        resource: "CONTENT_VERSION",
        resourceId: version.id,
        newValue: {
          contentId,
          versionNumber: version.versionNumber,
          linkedComponentPropagation: true,
        },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      await repos.outbox.add({
        aggregateType: "CONTENT",
        aggregateId: contentId,
        eventType: "CONTENT.BODY_SAVED",
        payload: {
          contentId,
          versionId: version.id,
          versionNumber: version.versionNumber,
          linkedComponentPropagation: true,
        },
      });
      return { version };
    });
    if ("version" in result) {
      void syncContentIndexFromDb(prisma, contentId).catch(() => undefined);
    }
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
      if (existing.authorId !== ctx.actorId && !ctx.isAdmin)
        return { forbidden: true } as const;
      // Idempotent transition: allow setting the current state again (no-op).
      if (existing.lifecycleState === lifecycleState) {
        return { content: existing } as const;
      }
      const allowed = VALID_TRANSITIONS[existing.lifecycleState] ?? [];
      if (!allowed.includes(lifecycleState)) {
        return {
          invalidTransition: true,
          current: existing.lifecycleState,
        } as const;
      }
      const updated = await repos.content.updateLifecycleState(
        contentId,
        lifecycleState,
      );
      const transitionVersion = await repos.content.createVersion({
        contentId: updated.id,
        authorId: ctx.actorId,
        changeType: "STATE_TRANSITION",
        title: updated.title,
        metadataSnapshot: { from: existing.lifecycleState, to: lifecycleState },
      });
      await recordSnapshotForVersion(
        repos,
        ctx,
        updated.id,
        transitionVersion.versionNumber,
        "STATE_TRANSITION",
        {
          versionId: transitionVersion.id,
          from: existing.lifecycleState,
          to: lifecycleState,
        },
      );
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
        payload: {
          contentId: updated.id,
          from: existing.lifecycleState,
          to: lifecycleState,
        },
      });
      return { content: updated };
    });
    if ("content" in result) {
      void syncContentIndexFromDb(prisma, contentId).catch(() => undefined);
    }
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
    const result = await uow.withTransaction(async (repos) => {
      const existing = await repos.content.getById(contentId);
      if (!existing) return { notFound: true } as const;
      if (existing.authorId !== ctx.actorId && !ctx.isAdmin)
        return { forbidden: true } as const;
      const updated = await repos.content.updateVisibility(
        contentId,
        visibility,
      );
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
    if ("content" in result) {
      void syncContentIndexFromDb(prisma, contentId).catch(() => undefined);
    }
    return result;
  },

  async assignTag(
    ctx: AuditContext,
    contentId: string,
    tagId: string,
  ): Promise<{ ok: true } | { notFound: true } | { forbidden: true }> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const content = await repos.content.getById(contentId);
      if (!content) return { notFound: true } as const;
      if (content.authorId !== ctx.actorId && !ctx.isAdmin)
        return { forbidden: true } as const;
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
    if ("ok" in result) {
      void syncContentIndexFromDb(prisma, contentId).catch(() => undefined);
    }
    return result;
  },

  async removeTag(
    ctx: AuditContext,
    contentId: string,
    tagId: string,
  ): Promise<{ ok: true } | { notFound: true } | { forbidden: true }> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const content = await repos.content.getById(contentId);
      if (!content) return { notFound: true } as const;
      if (content.authorId !== ctx.actorId && !ctx.isAdmin)
        return { forbidden: true } as const;
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
    if ("ok" in result) {
      void syncContentIndexFromDb(prisma, contentId).catch(() => undefined);
    }
    return result;
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
        if (existing.status === "ACCEPTED")
          return { alreadyCoAuthor: true } as const;
        if (existing.status === "PENDING")
          return { alreadyPending: true } as const;

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

  /**
   * Primary author only: invite a co-author by email (resolves to user id server-side).
   */
  async requestCoAuthorByEmail(
    ctx: AuditContext,
    contentId: string,
    email: string,
  ): Promise<
    | { created: true }
    | { notFound: true }
    | { forbidden: true }
    | { alreadyPending: true }
    | { alreadyCoAuthor: true }
    | { inviteeNotFound: true }
  > {
    const normalized = email.trim();
    if (!normalized) return { inviteeNotFound: true } as const;

    const prisma = getPrismaClient();
    const invitee = await prisma.user.findFirst({
      where: { email: { equals: normalized, mode: "insensitive" } },
      select: { id: true },
    });
    if (!invitee) return { inviteeNotFound: true } as const;

    return contentService.requestCoAuthor(ctx, contentId, invitee.id);
  },

  async listPendingCoAuthorInvitations(userId: string): Promise<
    Array<{
      contentId: string;
      title: string;
      requestedBy: { displayName: string; email: string };
    }>
  > {
    const prisma = getPrismaClient();
    const rows = await prisma.contentCoAuthor.findMany({
      where: { userId, status: "PENDING" },
      include: {
        content: { select: { id: true, title: true } },
        requestedBy: { select: { displayName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      contentId: r.contentId,
      title: r.content.title,
      requestedBy: {
        displayName: r.requestedBy.displayName,
        email: r.requestedBy.email,
      },
    }));
  },

  async respondToCoAuthorRequest(
    ctx: AuditContext,
    contentId: string,
    decision: "APPROVE" | "REJECT",
  ): Promise<{ updated: true; accepted: boolean } | { notFound: true }> {
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
        eventType: accepted
          ? "CONTENT.COAUTHOR_ACCEPTED"
          : "CONTENT.COAUTHOR_REJECTED",
        payload: {
          contentId,
          userId: ctx.actorId,
          requestedById: request.requestedById,
        },
      });

      return { updated: true, accepted } as const;
    });
  },

  /**
   * Word-level diff between two `ContentSnapshot` rows for the same content.
   * Left/right correspond to `snapshotAId` / `snapshotBId` request order.
   */
  async compareSnapshotsWordDiff(
    contentId: string,
    snapshotAId: string,
    snapshotBId: string,
    requester: { id: string; isAdmin?: boolean } | null,
  ): Promise<
    | SnapshotWordDiffResult
    | { notFound: true }
    | { badRequest: true; error: string }
  > {
    const detail = await this.getById(contentId, requester);
    if (!detail) {
      return { notFound: true } as const;
    }

    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    const [sa, sb] = await Promise.all([
      repos.contentSnapshot.getById(snapshotAId),
      repos.contentSnapshot.getById(snapshotBId),
    ]);
    if (!sa || !sb) {
      return { notFound: true } as const;
    }
    if (sa.contentId !== sb.contentId) {
      return {
        badRequest: true,
        error: "Snapshots belong to different content items",
      };
    }
    if (sa.contentId !== contentId) {
      return {
        badRequest: true,
        error: "Snapshots do not match content id in path",
      };
    }

    const [va, vb] = await Promise.all([
      repos.content.getVersionWithBodyAtOrBefore(contentId, sa.toVersionNumber),
      repos.content.getVersionWithBodyAtOrBefore(contentId, sb.toVersionNumber),
    ]);

    const leftPlain = buildPlainTextForSnapshotSide(va).plain;
    const rightPlain = buildPlainTextForSnapshotSide(vb).plain;
    const core = computeWordDiff(leftPlain, rightPlain);

    return {
      contentId,
      left: sideSummary(sa, va),
      right: sideSummary(sb, vb),
      ...core,
    };
  },
};
