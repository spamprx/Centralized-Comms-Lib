import { getPrismaClient, PrismaUnitOfWork } from "../../repository";
import type { ReviewComment } from "../../repository/types";
import type { AuditContext } from "../context";

type Verdict = "APPROVED" | "DENIED" | "ROLLBACK";

export const reviewService = {
  async createRequest(
    ctx: AuditContext,
    input: { contentId: string; contentVersionId: string; quorumRequired?: number },
  ) {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const content = await repos.content.getById(input.contentId);
      if (!content) return { notFound: true } as const;
      if (content.lifecycleState !== "DRAFT" && content.lifecycleState !== "IN_REVIEW") {
        return { invalidState: true, state: content.lifecycleState } as const;
      }
      if (content.lifecycleState === "DRAFT") {
        await repos.content.updateLifecycleState(input.contentId, "IN_REVIEW");
      }
      const request = await repos.review.createRequest({
        contentId: input.contentId,
        contentVersionId: input.contentVersionId,
        requestedById: ctx.actorId,
        quorumRequired: input.quorumRequired ?? 1,
      });
      await repos.audit.append({
        action: "CREATE",
        resource: "REVIEW_REQUEST",
        resourceId: request.id,
        newValue: {
          contentId: input.contentId,
          contentVersionId: input.contentVersionId,
          quorumRequired: input.quorumRequired ?? 1,
        },
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      await repos.outbox.add({
        aggregateType: "REVIEW_REQUEST",
        aggregateId: request.id,
        eventType: "REVIEW_REQUEST.CREATED",
        payload: {
          contentId: input.contentId,
          requestId: request.id,
          requestedById: ctx.actorId,
        },
      });
      return { request };
    });
  },

  async getRequestById(requestId: string) {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    const request = await repos.review.getRequestById(requestId);
    if (!request) return null;
    const assignments = await repos.review.listAssignmentsForRequest(request.id);
    return { ...request, assignments };
  },

  async listRequestsForContent(contentId: string) {
    const repos = new PrismaUnitOfWork(getPrismaClient()).repos();
    return repos.review.listRequestsForContent(contentId);
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
      const assignment = await repos.review.assignReviewer({
        reviewRequestId: request.id,
        reviewerId,
        assignedById: ctx.actorId,
      });
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
    | { alreadyCompleted: true }
  > {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    const result = await uow.withTransaction(async (repos) => {
      const assignment = await repos.review.getAssignmentById(assignmentId);
      if (!assignment) return { notFound: true } as const;
      if (assignment.status === "COMPLETED") return { alreadyCompleted: true } as const;

      await repos.review.recordDecision({
        reviewAssignmentId: assignment.id,
        verdict,
        comment,
      });

      const request = await repos.review.getRequestById(assignment.reviewRequestId);
      if (request && verdict === "APPROVED") {
        const allAssignments = await repos.review.listAssignmentsForRequest(request.id);
        const completedApprovals = allAssignments.filter(
          (a) => a.id === assignment.id || a.status === "COMPLETED",
        ).length;
        if (completedApprovals >= request.quorumRequired) {
          await repos.review.updateRequestStatus(request.id, "CLOSED");
          await repos.content.updateLifecycleState(request.contentId, "PUBLISHED");
          await repos.outbox.add({
            aggregateType: "CONTENT",
            aggregateId: request.contentId,
            eventType: "CONTENT.PUBLISHED",
            payload: { contentId: request.contentId, reviewRequestId: request.id },
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
        await repos.content.updateLifecycleState(request.contentId, "IN_REVIEW");
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
  ): Promise<{ comment: ReviewComment } | { notFound: true }> {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    return uow.withTransaction(async (repos) => {
      const assignment = await repos.review.getAssignmentById(assignmentId);
      if (!assignment) return { notFound: true } as const;

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
