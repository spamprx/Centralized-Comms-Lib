/**
 * S2 — Object-Level Authorization (SRS §3.4.6)
 *
 * Implements per-object permission checks after Gateway authentication.
 * The Gateway verifies *who* the user is; this layer verifies *whether*
 * they are allowed to access a specific resource instance.
 *
 * Resources supported:
 *   content  — actions: read, write, delete, transition, manage_reviewers
 *   template — actions: read, write, delete
 *   review   — actions: read, submit, rollback
 *   asset    — actions: read, write, delete (MY_ASSETS: owner; LIBRARY: any signed-in user may read)
 *   admin    — actions: any (ADMIN role only)
 *
 * Content rules (summary):
 *   1. ADMIN role → full bypass except draft-read privacy boundaries
 *   2. Author & accepted co-authors → full content access
 *   3. Assigned reviewers → read / review actions while IN_REVIEW
 *   4. Channel-bound published sends → never “open web” via PUBLIC; only author/co-author/admin,
 *      and PRIVATE_TO_GROUP still requires group membership
 *   5. Non–channel-bound published + PUBLIC → catalog / library read for everyone
 *   6. PRIVATE_TO_GROUP (published) → group members
 *
 * The function performs lazy database lookups only for the checks required
 * by the requested action, keeping hot paths (admin, author) fast.
 */

import { getPrismaClient } from "../../repository";

export type ResourceAction =
  | "read"
  | "write"
  | "delete"
  | "transition"
  | "manage_reviewers"
  | "submit"
  | "rollback";

export type ResourceType = "content" | "template" | "review" | "admin" | "asset";

export interface AccessContext {
  actorId: string;
  isAdmin?: boolean;
}

export interface AccessResult {
  allowed: boolean;
  reason?: string;
}

export interface RequesterPrincipal {
  id: string;
  isAdmin?: boolean;
}

async function checkContentAccess(
  ctx: AccessContext,
  resourceId: string,
  action: ResourceAction,
): Promise<AccessResult> {
  const prisma = getPrismaClient();

  const content = await prisma.content.findUnique({
    where: { id: resourceId },
    select: {
      authorId: true,
      lifecycleState: true,
      visibility: true,
      visibilityGroupId: true,
      channelId: true,
    },
  });

  if (!content) {
    return { allowed: false, reason: "Content not found" };
  }

  const channelBound = Boolean(content.channelId);
  const isReadAction =
    action === "read" || action === "submit" || action === "rollback";

  // Owner has full access
  if (content.authorId === ctx.actorId) {
    return { allowed: true };
  }

  // Co-author check for write operations
  if (action === "write" || action === "read" || action === "transition") {
    const coAuthor = await prisma.contentCoAuthor.findFirst({
      where: {
        contentId: resourceId,
        userId: ctx.actorId,
        status: "ACCEPTED",
      },
      select: { id: true },
    });
    if (coAuthor) return { allowed: true };
  }

  // Draft visibility is intentionally strict: only author / accepted co-author can read drafts.
  if (isReadAction && content.lifecycleState === "DRAFT") {
    return {
      allowed: false,
      reason: "Draft content is visible only to the author or accepted co-authors",
    };
  }

  // Admin bypass still applies for non-draft reads and all non-read actions.
  if (ctx.isAdmin) return { allowed: true };

  // Assigned reviewers can read while content is IN_REVIEW.
  if (isReadAction) {
    const assignment = await prisma.reviewAssignment.findFirst({
      where: {
        reviewRequest: { contentId: resourceId },
        reviewerId: ctx.actorId,
      },
      select: { id: true },
    });
    if (assignment && content.lifecycleState === "IN_REVIEW") {
      return { allowed: true };
    }
  }

  // Standalone (non–channel-bound) content: library-style PUBLIC read once published.
  if (
    action === "read" &&
    content.lifecycleState === "PUBLISHED" &&
    content.visibility === "PUBLIC" &&
    !channelBound
  ) {
    return { allowed: true };
  }

  // Private-to-group (published): applies to both channel-bound and standalone sends.
  if (
    action === "read" &&
    content.lifecycleState === "PUBLISHED" &&
    content.visibility === "PRIVATE_TO_GROUP" &&
    content.visibilityGroupId
  ) {
    const membership = await prisma.userGroupMembership.findFirst({
      where: {
        groupId: content.visibilityGroupId,
        userId: ctx.actorId,
      },
      select: { id: true },
    });
    if (membership) return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Forbidden: actor ${ctx.actorId} cannot perform '${action}' on content ${resourceId}`,
  };
}

async function checkTemplateAccess(
  ctx: AccessContext,
  resourceId: string,
  action: ResourceAction,
): Promise<AccessResult> {
  const prisma = getPrismaClient();

  const template = await prisma.template.findUnique({
    where: { id: resourceId },
    select: { authorId: true, status: true },
  });

  if (!template) {
    return { allowed: false, reason: "Template not found" };
  }

  // Owner can always access their templates.
  if (template.authorId === ctx.actorId) return { allowed: true };

  // Draft templates are never visible outside the owner.
  if (action === "read" && template.status === "DRAFT") {
    return {
      allowed: false,
      reason: "Draft templates are visible only to the template author",
    };
  }

  // ACTIVE templates are discoverable/readable for all signed-in users.
  if (action === "read" && template.status === "ACTIVE") {
    return { allowed: true };
  }

  if (ctx.isAdmin) return { allowed: true };

  return {
    allowed: false,
    reason: `Forbidden: actor ${ctx.actorId} cannot perform '${action}' on template ${resourceId}`,
  };
}

/** Asset placement: MY_ASSETS = private to owner; LIBRARY = readable by any authenticated user. */
async function checkAssetAccess(
  ctx: AccessContext,
  resourceId: string,
  action: ResourceAction,
): Promise<AccessResult> {
  const prisma = getPrismaClient();
  const row = await prisma.asset.findFirst({
    where: { id: resourceId, deletedAt: null },
    select: {
      ownerUserId: true,
      placement: true,
      status: true,
    },
  });
  if (!row) return { allowed: false, reason: "Asset not found" };

  if (ctx.isAdmin) return { allowed: true };

  const isOwner = row.ownerUserId === ctx.actorId;
  const isLibrary = row.placement === "LIBRARY";

  if (action === "read") {
    if (isLibrary || isOwner) return { allowed: true };
    return {
      allowed: false,
      reason: "Asset is private to its owner",
    };
  }

  if (action === "write" || action === "delete") {
    if (isOwner) return { allowed: true };
    return {
      allowed: false,
      reason: `Forbidden: actor ${ctx.actorId} cannot ${action} asset ${resourceId}`,
    };
  }

  return {
    allowed: false,
    reason: `Unsupported action '${action}' for asset`,
  };
}

async function checkReviewAccess(
  ctx: AccessContext,
  resourceId: string,
  action: ResourceAction,
): Promise<AccessResult> {
  if (ctx.isAdmin) return { allowed: true };

  const prisma = getPrismaClient();

  const assignment = await prisma.reviewAssignment.findFirst({
    where: { id: resourceId, reviewerId: ctx.actorId },
    select: { id: true },
  });

  if (assignment) return { allowed: true };

  // Content author can read their own review requests
  if (action === "read") {
    const request = await prisma.reviewRequest.findFirst({
      where: {
        id: resourceId,
        content: { authorId: ctx.actorId },
      },
      select: { id: true },
    });
    if (request) return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Forbidden: actor ${ctx.actorId} cannot perform '${action}' on review ${resourceId}`,
  };
}

/**
 * Check whether `actorId` is allowed to perform `action` on a specific
 * resource instance identified by `resource` type and `resourceId`.
 *
 * Callers should treat a `false` result as a 403 and not expose the
 * existence of the resource to unauthorised actors.
 */
export async function checkResourceAccess(
  actorId: string,
  resource: ResourceType,
  resourceId: string,
  action: ResourceAction,
  opts: { isAdmin?: boolean } = {},
): Promise<AccessResult> {
  const ctx: AccessContext = { actorId, isAdmin: opts.isAdmin ?? false };

  switch (resource) {
    case "content":
      return checkContentAccess(ctx, resourceId, action);
    case "template":
      return checkTemplateAccess(ctx, resourceId, action);
    case "review":
      return checkReviewAccess(ctx, resourceId, action);
    case "asset":
      return checkAssetAccess(ctx, resourceId, action);
    case "admin":
      return ctx.isAdmin
        ? { allowed: true }
        : { allowed: false, reason: "Admin privileges required" };
    default:
      return { allowed: false, reason: `Unknown resource type: ${resource}` };
  }
}

/**
 * Object-level filter for content read access.
 *
 * Rules:
 * - DRAFT: author/co-author/admin only
 * - IN_REVIEW: above + assigned reviewers
 * - PUBLISHED: visibility applies (PUBLIC or PRIVATE_TO_GROUP), and owner/co-author/reviewer/admin always allowed
 * - Until published, visibility is ignored.
 */
export async function filterReadableContent<T extends {
  id: string;
  authorId: string;
  lifecycleState: string;
  visibility: string;
  visibilityGroupId: string | null;
  channelId?: string | null;
}>(
  requester: RequesterPrincipal | null,
  contents: T[],
): Promise<T[]> {
  if (contents.length === 0) return [];
  const ids = contents.map((c) => c.id);

  // Unauthenticated: only standalone published + public (never channel-bound sends).
  if (!requester) {
    return contents.filter(
      (c) =>
        !c.channelId &&
        c.lifecycleState === "PUBLISHED" &&
        c.visibility === "PUBLIC",
    );
  }

  const prisma = getPrismaClient();
  const [coAuthors, reviewAssignments, memberships] = await Promise.all([
    prisma.contentCoAuthor.findMany({
      where: {
        userId: requester.id,
        status: "ACCEPTED",
        contentId: { in: ids },
      },
      select: { contentId: true },
    }),
    prisma.reviewAssignment.findMany({
      where: {
        reviewerId: requester.id,
        reviewRequest: { contentId: { in: ids } },
      },
      select: { reviewRequest: { select: { contentId: true } } },
    }),
    prisma.userGroupMembership.findMany({
      where: { userId: requester.id },
      select: { groupId: true },
    }),
  ]);

  const coAuthorSet = new Set(
    coAuthors.map((r: { contentId: string }) => r.contentId),
  );
  const reviewerSet = new Set(
    reviewAssignments.map(
      (r: { reviewRequest: { contentId: string } }) =>
        r.reviewRequest.contentId,
    ),
  );
  const groupSet = new Set(
    memberships.map((m: { groupId: string }) => m.groupId),
  );

  return contents.filter((c) => {
    const channelBound = Boolean(c.channelId);
    const isOwner = c.authorId === requester.id;
    const isCoAuthor = coAuthorSet.has(c.id);
    const isReviewer = reviewerSet.has(c.id);

    if (isOwner || isCoAuthor) return true;

    // Draft visibility is strict even for admins: only owner or accepted co-author.
    if (c.lifecycleState === "DRAFT") return false;

    if (requester.isAdmin) return true;

    if (c.lifecycleState === "IN_REVIEW") return isReviewer;

    if (c.lifecycleState === "PUBLISHED") {
      if (c.visibility === "PRIVATE_TO_GROUP" && c.visibilityGroupId) {
        return groupSet.has(c.visibilityGroupId);
      }
      if (c.visibility === "PUBLIC") {
        if (channelBound) return false;
        return true;
      }
      return false;
    }

    // ARCHIVED or unknown: no non-owner access.
    return false;
  });
}

/**
 * Object-level filter for template read access.
 *
 * Rules:
 * - Owner can always read.
 * - Draft templates are owner-only.
 * - Active templates are readable by all signed-in users.
 * - Admin can read any template.
 */
export function filterReadableTemplates<
  T extends { authorId: string; status?: string },
>(
  requester: RequesterPrincipal,
  templates: T[],
): T[] {
  return templates.filter((t): t is T => {
    if (t.authorId === requester.id) return true;
    if (t.status === "ACTIVE") return true;
    if (t.status === "DRAFT") return false;
    return !!requester.isAdmin;
  });
}
