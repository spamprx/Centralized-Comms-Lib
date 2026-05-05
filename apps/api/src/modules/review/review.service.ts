import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import { Prisma } from "@prisma/client";
import type { ReviewComment } from "../../repository/types";
import type { AuditContext } from "../../shared/context";
import { requiredQuorumFromPolicies } from "./reviewPolicy.enforcement";
import { publishEvent } from "../../integration";
import { assertNoUnresolvedPlaceholdersForUnboundTemplate } from "../content/contentPlaceholderGate";

type Verdict = "APPROVED" | "DENIED" | "ROLLBACK";

export const reviewService = {
  async createRequest(
    ctx: AuditContext,
    input: {
      contentId: string;
      contentVersionId: string;
      quorumRequired?: number;
    },
  ) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const content = await repos.content.getById(input.contentId);
      if (!content) return { notFound: true } as const;
      if (content.authorId !== ctx.actorId && !ctx.isAdmin)
        return { forbidden: true } as const;
      if (
        content.lifecycleState !== "DRAFT" &&
        content.lifecycleState !== "IN_REVIEW"
      ) {
        return { invalidState: true, state: content.lifecycleState } as const;
      }

      const versionRow = await prisma.contentVersion.findFirst({
        where: { id: input.contentVersionId, contentId: input.contentId },
        select: { body: true },
      });
      if (!versionRow) {
        return { contentVersionNotFound: true } as const;
      }
      const gate = await assertNoUnresolvedPlaceholdersForUnboundTemplate(
        content,
        versionRow.body,
      );
      if ("unfilled" in gate && gate.unfilled) {
        return { unfilledPlaceholders: true, keys: gate.keys } as const;
      }

      if (content.lifecycleState === "DRAFT") {
        await repos.content.updateLifecycleState(input.contentId, "IN_REVIEW");
      }
      // Enforce: at most ONE active (OPEN) review per content.
      // If an OPEN request already exists, merge by upgrading it to the latest version and quorum.
      const open = await repos.review.listOpenRequestsForContent(
        input.contentId,
      );
      const authorGroups = await repos.userRole.listGroupsForUser(
        content.authorId,
      );
      const policies = await repos.reviewPolicy.listActiveCandidates({
        contentType: content.contentType,
        channelId: content.channelId ?? null,
        userGroupIds: authorGroups.map((g) => g.id),
      });
      const requiredQuorum =
        requiredQuorumFromPolicies({
          policies,
          channelId: content.channelId ?? null,
          userGroupIds: authorGroups.map((g) => g.id),
        }) ?? 1;

      const desiredQuorum = Math.max(input.quorumRequired ?? 1, requiredQuorum);
      let request =
        open.length > 0
          ? await repos.review.updateRequestVersionAndQuorum(open[0].id, {
              contentVersionId: input.contentVersionId,
              quorumRequired: Math.max(open[0].quorumRequired, desiredQuorum),
            })
          : await repos.review.createRequest({
              contentId: input.contentId,
              contentVersionId: input.contentVersionId,
              requestedById: ctx.actorId,
              quorumRequired: desiredQuorum,
            });

      // If multiple OPEN requests exist (legacy), cancel all but the newest one.
      if (open.length > 1) {
        for (const r of open.slice(1)) {
          try {
            await repos.review.updateRequestStatus(r.id, "CANCELLED");
          } catch {
            // ignore best-effort cancellation
          }
        }
      }
      await repos.audit.append({
        action: open.length > 0 ? "UPDATE" : "CREATE",
        resource: "REVIEW_REQUEST",
        resourceId: request.id,
        newValue: {
          contentId: input.contentId,
          contentVersionId: input.contentVersionId,
          quorumRequired: request.quorumRequired,
        },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      await publishEvent(repos.outbox, {
        aggregateType: "REVIEW_REQUEST",
        aggregateId: request.id,
        eventType:
          open.length > 0 ? "REVIEW_REQUEST.UPDATED" : "REVIEW_REQUEST.CREATED",
        payload: {
          contentId: input.contentId,
          requestId: request.id,
          requestedById: ctx.actorId,
        },
      });
      return { request };
    });
  },

  async getRequestById(
    requestId: string,
    requester: { id: string; isAdmin: boolean },
  ) {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    const request = await repos.review.getRequestById(requestId);
    if (!request) return null;
    const assignments = await repos.review.listAssignmentsForRequest(
      request.id,
    );
    const isAssignedReviewer = assignments.some(
      (a) => a.reviewerId === requester.id,
    );
    if (
      !requester.isAdmin &&
      request.requestedById !== requester.id &&
      !isAssignedReviewer
    ) {
      return { forbidden: true } as const;
    }
    return { ...request, assignments };
  },

  async listRequestsForContent(
    contentId: string,
    requester: { id: string; isAdmin: boolean },
  ) {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    const requests = await repos.review.listRequestsForContent(contentId);
    if (requester.isAdmin) return { requests };

    const content = await repos.content.getById(contentId);
    if (!content) return { notFound: true } as const;

    // Author can see all requests for their content.
    if (content.authorId === requester.id) {
      return { requests };
    }

    // Reviewer can only see requests where they are explicitly assigned.
    const assignmentLists = await Promise.all(
      requests.map((r) => repos.review.listAssignmentsForRequest(r.id)),
    );
    const allowedRequestIds = new Set(
      requests
        .filter((_, idx) =>
          assignmentLists[idx].some((a) => a.reviewerId === requester.id),
        )
        .map((r) => r.id),
    );
    if (allowedRequestIds.size === 0) return { forbidden: true } as const;

    return {
      requests: requests.filter((r) => allowedRequestIds.has(r.id)),
    };
  },

  async assignReviewer(
    ctx: AuditContext,
    requestId: string,
    reviewerId: string,
  ) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const request = await repos.review.getRequestById(requestId);
      if (!request) return null;
      if (request.requestedById !== ctx.actorId && !ctx.isAdmin) {
        return { forbidden: true } as const;
      }
      if (reviewerId === ctx.actorId) {
        return { selfAssign: true } as const;
      }
      let assignment: Awaited<
        ReturnType<typeof repos.review.assignReviewer>
      > | null = null;
      try {
        assignment = await repos.review.assignReviewer({
          reviewRequestId: request.id,
          reviewerId,
          assignedById: ctx.actorId,
        });
      } catch (e) {
        // Idempotent behavior: if reviewer already assigned, don't fail the whole flow.
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          return { alreadyAssigned: true } as const;
        }
        throw e;
      }
      await repos.audit.append({
        action: "ASSIGN",
        resource: "REVIEW_ASSIGNMENT",
        resourceId: assignment.id,
        newValue: { reviewRequestId: request.id, reviewerId },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      await publishEvent(repos.outbox, {
        aggregateType: "REVIEW_ASSIGNMENT",
        aggregateId: assignment.id,
        eventType: "REVIEWER.ASSIGNED",
        payload: {
          reviewRequestId: request.id,
          reviewerId,
          assignedById: ctx.actorId,
        },
      });
      return assignment;
    });
    return result;
  },

  async decide(
    ctx: AuditContext,
    assignmentId: string,
    verdict: Verdict,
    comment: string,
  ): Promise<
    | { ok: true }
    | { notFound: true }
    | { forbidden: true }
    | { alreadyCompleted: true }
  > {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const assignment = await repos.review.getAssignmentById(assignmentId);
      if (!assignment) return { notFound: true } as const;
      if (assignment.reviewerId !== ctx.actorId && !ctx.isAdmin)
        return { forbidden: true } as const;
      const trimmedComment = typeof comment === "string" ? comment.trim() : "";
      if (!trimmedComment) throw new Error("comment is required");

      // Allow undoing a previous APPROVED decision by submitting verdict=ROLLBACK.
      // This is the "undo approval" flow; it re-opens the review and moves content back to IN_REVIEW.
      if (assignment.status === "COMPLETED") {
        if (verdict !== "ROLLBACK") return { alreadyCompleted: true } as const;
        const request = await repos.review.getRequestById(
          assignment.reviewRequestId,
        );
        const content = request
          ? await repos.content.getById(request.contentId)
          : null;

        // Only allow rollback if the prior verdict was APPROVED.
        // Some legacy rows may have COMPLETED assignments without a decision row; in that case,
        // allow rollback only if the content is currently PUBLISHED (i.e. it was approved).
        const prior = await prisma.reviewDecision.findUnique({
          where: { reviewAssignmentId: assignment.id },
          select: { verdict: true, comment: true },
        });
        if (prior && prior.verdict !== ("APPROVED" as any)) {
          return { alreadyCompleted: true } as const;
        }
        if (!prior && content?.lifecycleState !== "PUBLISHED") {
          return { alreadyCompleted: true } as const;
        }

        // Delete prior decision (unique constraint) then record rollback decision.
        if (prior) {
          await prisma.reviewDecision.delete({
            where: { reviewAssignmentId: assignment.id },
          });
        }
        // recordDecision will keep assignment status COMPLETED; that's fine (decision exists) and request status drives workflow.
        await repos.review.recordDecision({
          reviewAssignmentId: assignment.id,
          verdict,
          comment: trimmedComment,
        });

        if (request) {
          const fromState = content?.lifecycleState ?? null;
          await repos.content.updateLifecycleState(
            request.contentId,
            "IN_REVIEW",
          );
          await repos.content.createVersion({
            contentId: request.contentId,
            authorId: ctx.actorId,
            changeType: "STATE_TRANSITION",
            title: content?.title ?? "Untitled",
            metadataSnapshot: {
              kind: "review_rollback",
              fromState,
              toState: "IN_REVIEW",
              reviewRequestId: request.id,
              reviewAssignmentId: assignment.id,
              justification: trimmedComment,
            },
          });
          await repos.review.updateRequestStatus(request.id, "OPEN");
          await publishEvent(repos.outbox, {
            aggregateType: "CONTENT",
            aggregateId: request.contentId,
            eventType: "CONTENT.ROLLBACK",
            payload: {
              contentId: request.contentId,
              reviewRequestId: request.id,
              reason: trimmedComment,
            },
          });
        }

        await repos.audit.append({
          action: "REVIEW_DECISION",
          resource: "REVIEW_ASSIGNMENT",
          resourceId: assignment.id,
          newValue: { verdict, comment: trimmedComment, undoApproval: true },
          actorId: ctx.actorId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });

        return { ok: true } as const;
      }

      await repos.review.recordDecision({
        reviewAssignmentId: assignment.id,
        verdict,
        comment: trimmedComment,
      });

      const request = await repos.review.getRequestById(
        assignment.reviewRequestId,
      );
      if (request && verdict === "APPROVED") {
        const allAssignments = await repos.review.listAssignmentsForRequest(
          request.id,
        );
        const completedApprovals = allAssignments.filter(
          (a) => a.id === assignment.id || a.status === "COMPLETED",
        ).length;
        if (completedApprovals >= request.quorumRequired) {
          await repos.review.updateRequestStatus(request.id, "CLOSED");
          const content = await repos.content.getById(request.contentId);
          const fromState = content?.lifecycleState ?? null;
          await repos.content.updateLifecycleState(
            request.contentId,
            "PUBLISHED",
          );
          await repos.content.createVersion({
            contentId: request.contentId,
            authorId: ctx.actorId,
            changeType: "STATE_TRANSITION",
            title: content?.title ?? "Untitled",
            metadataSnapshot: {
              kind: "review_approved",
              fromState,
              toState: "PUBLISHED",
              reviewRequestId: request.id,
              reviewAssignmentId: assignment.id,
            },
          });
          await publishEvent(repos.outbox, {
            aggregateType: "CONTENT",
            aggregateId: request.contentId,
            eventType: "CONTENT.PUBLISHED",
            payload: {
              contentId: request.contentId,
              reviewRequestId: request.id,
            },
          });
        }
      } else if (request && verdict === "DENIED") {
        const content = await repos.content.getById(request.contentId);
        const fromState = content?.lifecycleState ?? null;
        await repos.content.updateLifecycleState(request.contentId, "DRAFT");
        await repos.content.createVersion({
          contentId: request.contentId,
          authorId: ctx.actorId,
          changeType: "STATE_TRANSITION",
          title: content?.title ?? "Untitled",
          metadataSnapshot: {
            kind: "review_denied",
            fromState,
            toState: "DRAFT",
            reviewRequestId: request.id,
            reviewAssignmentId: assignment.id,
            reason: trimmedComment,
          },
        });
        await repos.review.updateRequestStatus(request.id, "CLOSED");
        await publishEvent(repos.outbox, {
          aggregateType: "CONTENT",
          aggregateId: request.contentId,
          eventType: "CONTENT.DENIED",
          payload: {
            contentId: request.contentId,
            reviewRequestId: request.id,
            reason: trimmedComment,
          },
        });
      } else if (request && verdict === "ROLLBACK") {
        const content = await repos.content.getById(request.contentId);
        const fromState = content?.lifecycleState ?? null;
        await repos.content.updateLifecycleState(
          request.contentId,
          "IN_REVIEW",
        );
        await repos.content.createVersion({
          contentId: request.contentId,
          authorId: ctx.actorId,
          changeType: "STATE_TRANSITION",
          title: content?.title ?? "Untitled",
          metadataSnapshot: {
            kind: "review_rollback",
            fromState,
            toState: "IN_REVIEW",
            reviewRequestId: request.id,
            reviewAssignmentId: assignment.id,
            justification: trimmedComment,
          },
        });
        await repos.review.updateRequestStatus(request.id, "OPEN");
        await publishEvent(repos.outbox, {
          aggregateType: "CONTENT",
          aggregateId: request.contentId,
          eventType: "CONTENT.ROLLBACK",
          payload: {
            contentId: request.contentId,
            reviewRequestId: request.id,
            reason: trimmedComment,
          },
        });
      }

      await repos.audit.append({
        action: "REVIEW_DECISION",
        resource: "REVIEW_ASSIGNMENT",
        resourceId: assignment.id,
        newValue: { verdict, comment: trimmedComment },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { ok: true } as const;
    });
    return result;
  },

  async rollbackToPending(
    ctx: AuditContext,
    assignmentId: string,
  ): Promise<{ ok: true } | { notFound: true } | { forbidden: true }> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const assignment = await repos.review.getAssignmentById(assignmentId);
      if (!assignment) return { notFound: true } as const;

      // Only the assigned reviewer can rollback their own decision
      if (assignment.reviewerId !== ctx.actorId) {
        return { forbidden: true } as const;
      }

      if (assignment.status !== "COMPLETED") {
        return { ok: true } as const; // nothing to do
      }

      await repos.review.rollbackDecision(assignmentId);

      await repos.audit.append({
        action: "REVIEW_ROLLBACK",
        resource: "REVIEW_ASSIGNMENT",
        resourceId: assignment.id,
        oldValue: { status: "COMPLETED" },
        newValue: { status: "PENDING" },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      return { ok: true } as const;
    });
    return result;
  },

  /**
   * Content author or admin: list active users that may be assigned as reviewers
   * (replaces unauthenticated-wide directory exposure via admin routes).
   */
  async listAssignableReviewersForContent(
    ctx: AuditContext,
    contentId: string,
  ): Promise<
    | { users: Array<{ id: string; displayName: string | null; email: string }> }
    | { notFound: true }
    | { forbidden: true }
  > {
    const prisma = getPrismaClient();
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: { authorId: true },
    });
    if (!content) return { notFound: true };
    if (content.authorId !== ctx.actorId && !ctx.isAdmin) {
      return { forbidden: true };
    }

    const users = await prisma.user.findMany({
      where: { isActive: true, id: { not: ctx.actorId } },
      select: { id: true, displayName: true, email: true },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
    });
    return { users };
  },

  /**
   * Minimal user fields for display, only for users the caller may see via
   * review participation (reviewer on an assignment, or author of reviewed content).
   */
  async listUserDisplayNamesForReviewContext(
    ctx: AuditContext,
    userIds: string[],
  ): Promise<Array<{ id: string; displayName: string | null; email: string }>> {
    const prisma = getPrismaClient();
    const unique = [...new Set(userIds.filter((id) => typeof id === "string" && id.length > 0))].slice(
      0,
      200,
    );
    if (unique.length === 0) return [];

    if (ctx.isAdmin) {
      return prisma.user.findMany({
        where: { id: { in: unique } },
        select: { id: true, displayName: true, email: true },
      });
    }

    const allowed = new Set<string>([ctx.actorId]);

    const asReviewer = await prisma.reviewAssignment.findMany({
      where: { reviewerId: ctx.actorId },
      include: {
        reviewRequest: {
          select: {
            requestedById: true,
            content: { select: { authorId: true } },
          },
        },
      },
    });
    for (const a of asReviewer) {
      allowed.add(a.reviewRequest.requestedById);
      allowed.add(a.reviewRequest.content.authorId);
    }

    const myContents = await prisma.content.findMany({
      where: { authorId: ctx.actorId },
      select: { id: true },
    });
    const myContentIds = myContents.map((c) => c.id);
    if (myContentIds.length > 0) {
      const reqs = await prisma.reviewRequest.findMany({
        where: { contentId: { in: myContentIds } },
        include: {
          assignments: { select: { reviewerId: true } },
        },
      });
      for (const r of reqs) {
        allowed.add(r.requestedById);
        for (const as of r.assignments) {
          allowed.add(as.reviewerId);
        }
      }
    }

    const filtered = unique.filter((id) => allowed.has(id));
    if (filtered.length === 0) return [];

    return prisma.user.findMany({
      where: { id: { in: filtered } },
      select: { id: true, displayName: true, email: true },
    });
  },

  async listAssignmentsForReviewer(reviewerId: string) {
    const prisma = getPrismaClient();
    const repos = new PrismaUnitOfWork(prisma).repos();
    const assignments =
      await repos.review.listAssignmentsForReviewer(reviewerId);
    if (assignments.length === 0) return assignments;

    const decisions = await prisma.reviewDecision.findMany({
      where: { reviewAssignmentId: { in: assignments.map((a) => a.id) } },
      select: {
        reviewAssignmentId: true,
        verdict: true,
        comment: true,
        decidedAt: true,
      },
    });
    const decisionByAssignmentId = new Map(
      decisions.map((d) => [
        d.reviewAssignmentId,
        {
          verdict: String(d.verdict),
          comment: d.comment,
          createdAt: d.decidedAt,
        },
      ]),
    );

    return assignments.map((a) => {
      const d = decisionByAssignmentId.get(a.id);
      return d ? { ...a, decision: d } : a;
    });
  },

  async addComment(
    ctx: AuditContext,
    assignmentId: string,
    body: string,
  ): Promise<
    { comment: ReviewComment } | { notFound: true } | { forbidden: true }
  > {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const assignment = await repos.review.getAssignmentById(assignmentId);
      if (!assignment) return { notFound: true } as const;
      if (assignment.reviewerId !== ctx.actorId && !ctx.isAdmin)
        return { forbidden: true } as const;

      const comment = await repos.review.addComment({
        reviewAssignmentId: assignmentId,
        authorId: ctx.actorId,
        body,
      });

      await repos.audit.append({
        action: "COMMENT",
        resource: "REVIEW_ASSIGNMENT",
        resourceId: assignmentId,
        newValue: { body },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      return { comment };
    });
  },
};
