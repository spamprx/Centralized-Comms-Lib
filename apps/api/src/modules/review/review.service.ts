import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import { Prisma } from "@prisma/client";
import type { ReviewComment } from "../../repository/types";
import type { AuditContext } from "../../shared/context";

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
      if (content.lifecycleState === "DRAFT") {
        await repos.content.updateLifecycleState(input.contentId, "IN_REVIEW");
      }
      // Enforce: at most ONE active (OPEN) review per content.
      // If an OPEN request already exists, merge by upgrading it to the latest version and quorum.
      const open = await repos.review.listOpenRequestsForContent(input.contentId);
      const desiredQuorum = input.quorumRequired ?? 1;
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
      await repos.outbox.add({
        aggregateType: "REVIEW_REQUEST",
        aggregateId: request.id,
        eventType: open.length > 0 ? "REVIEW_REQUEST.UPDATED" : "REVIEW_REQUEST.CREATED",
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
    if (!requester.isAdmin) {
      // Check if the requester is the content author or an assigned reviewer for this content
      const content = await repos.content.getById(contentId);
      if (!content) return { notFound: true } as const;
      if (content.authorId !== requester.id) {
        const allRequests =
          await repos.review.listRequestsForContent(contentId);
        const allAssignments = await Promise.all(
          allRequests.map((r) => repos.review.listAssignmentsForRequest(r.id)),
        );
        const isReviewer = allAssignments
          .flat()
          .some((a) => a.reviewerId === requester.id);
        if (!isReviewer) return { forbidden: true } as const;
      }
    }
    return { requests: await repos.review.listRequestsForContent(contentId) };
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
      let assignment:
        | Awaited<ReturnType<typeof repos.review.assignReviewer>>
        | null = null;
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
      await repos.outbox.add({
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
      if (assignment.status === "COMPLETED")
        return { alreadyCompleted: true } as const;

      await repos.review.recordDecision({
        reviewAssignmentId: assignment.id,
        verdict,
        comment,
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
          await repos.content.updateLifecycleState(
            request.contentId,
            "PUBLISHED",
          );
          await repos.outbox.add({
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
        await repos.content.updateLifecycleState(request.contentId, "DRAFT");
        await repos.review.updateRequestStatus(request.id, "CLOSED");
        await repos.outbox.add({
          aggregateType: "CONTENT",
          aggregateId: request.contentId,
          eventType: "CONTENT.DENIED",
          payload: {
            contentId: request.contentId,
            reviewRequestId: request.id,
            reason: comment,
          },
        });
      } else if (request && verdict === "ROLLBACK") {
        await repos.content.updateLifecycleState(
          request.contentId,
          "IN_REVIEW",
        );
        await repos.review.updateRequestStatus(request.id, "OPEN");
        await repos.outbox.add({
          aggregateType: "CONTENT",
          aggregateId: request.contentId,
          eventType: "CONTENT.ROLLBACK",
          payload: {
            contentId: request.contentId,
            reviewRequestId: request.id,
            reason: comment,
          },
        });
      }

      await repos.audit.append({
        action: "REVIEW_DECISION",
        resource: "REVIEW_ASSIGNMENT",
        resourceId: assignment.id,
        newValue: { verdict, comment },
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

  async listAssignmentsForReviewer(reviewerId: string) {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.review.listAssignmentsForReviewer(reviewerId);
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
