import type { ReviewRepository } from "../../interfaces";
import type {
  ReviewAssignment,
  ReviewComment,
  ReviewCommentInput,
  ReviewDecisionInput,
  ReviewRequest,
  ReviewRequestStatus,
} from "../../types";
import type { PrismaDb } from "./prismaTypes";

function toRequest(row: {
  id: string;
  status: string;
  quorumRequired: number;
  contentId: string;
  contentVersionId: string;
  requestedById: string;
  createdAt: Date;
  updatedAt: Date;
}): ReviewRequest {
  return {
    id: row.id,
    status: row.status as ReviewRequestStatus,
    quorumRequired: row.quorumRequired,
    contentId: row.contentId,
    contentVersionId: row.contentVersionId,
    requestedById: row.requestedById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAssignment(row: {
  id: string;
  status: string;
  reviewRequestId: string;
  reviewerId: string;
  assignedById: string;
  assignedAt: Date;
  completedAt: Date | null;
}): ReviewAssignment {
  return {
    id: row.id,
    status: row.status as any,
    reviewRequestId: row.reviewRequestId,
    reviewerId: row.reviewerId,
    assignedById: row.assignedById,
    assignedAt: row.assignedAt,
    completedAt: row.completedAt,
  };
}

export class PrismaReviewRepository implements ReviewRepository {
  public constructor(private readonly db: PrismaDb) {}

  async createRequest(input: {
    contentId: string;
    contentVersionId: string;
    requestedById: string;
    quorumRequired?: number;
  }): Promise<ReviewRequest> {
    const row = await this.db.reviewRequest.create({
      data: {
        contentId: input.contentId,
        contentVersionId: input.contentVersionId,
        requestedById: input.requestedById,
        quorumRequired: input.quorumRequired ?? 1,
      },
    });
    return toRequest(row);
  }

  async getRequestById(id: string): Promise<ReviewRequest | null> {
    const row = await this.db.reviewRequest.findUnique({ where: { id } });
    return row ? toRequest(row) : null;
  }

  async listRequestsForContent(contentId: string): Promise<ReviewRequest[]> {
    const rows = await this.db.reviewRequest.findMany({
      where: { contentId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toRequest);
  }

  async updateRequestStatus(
    requestId: string,
    status: ReviewRequestStatus,
  ): Promise<ReviewRequest> {
    const row = await this.db.reviewRequest.update({
      where: { id: requestId },
      data: { status },
    });
    return toRequest(row);
  }

  async assignReviewer(input: {
    reviewRequestId: string;
    reviewerId: string;
    assignedById: string;
  }): Promise<ReviewAssignment> {
    const row = await this.db.reviewAssignment.create({
      data: {
        reviewRequestId: input.reviewRequestId,
        reviewerId: input.reviewerId,
        assignedById: input.assignedById,
      },
    });
    return toAssignment(row);
  }

  async getAssignmentById(id: string): Promise<ReviewAssignment | null> {
    const row = await this.db.reviewAssignment.findUnique({ where: { id } });
    return row ? toAssignment(row) : null;
  }

  async listAssignmentsForRequest(
    requestId: string,
  ): Promise<ReviewAssignment[]> {
    const rows = await this.db.reviewAssignment.findMany({
      where: { reviewRequestId: requestId },
      orderBy: { assignedAt: "desc" },
    });
    return rows.map(toAssignment);
  }

  async listAssignmentsForReviewer(
    reviewerId: string,
  ): Promise<ReviewAssignment[]> {
    const rows = await this.db.reviewAssignment.findMany({
      where: { reviewerId },
      orderBy: { assignedAt: "desc" },
    });
    return rows.map(toAssignment);
  }

  async recordDecision(input: ReviewDecisionInput): Promise<void> {
    await this.db.reviewDecision.create({
      data: {
        reviewAssignmentId: input.reviewAssignmentId,
        verdict: input.verdict as any,
        comment: input.comment,
        isAutoApproval: input.isAutoApproval ?? false,
      },
    });

    await this.db.reviewAssignment.update({
      where: { id: input.reviewAssignmentId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }

  async rollbackDecision(assignmentId: string): Promise<void> {
    await this.db.reviewDecision.deleteMany({
      where: { reviewAssignmentId: assignmentId },
    });
    await this.db.reviewAssignment.update({
      where: { id: assignmentId },
      data: { status: "PENDING", completedAt: null },
    });
  }

  async addComment(input: ReviewCommentInput): Promise<ReviewComment> {
    const row = await this.db.reviewComment.create({
      data: {
        reviewAssignmentId: input.reviewAssignmentId,
        authorId: input.authorId,
        body: input.body,
      },
    });
    return {
      id: row.id,
      body: row.body,
      reviewAssignmentId: row.reviewAssignmentId,
      authorId: row.authorId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listComments(assignmentId: string): Promise<ReviewComment[]> {
    const rows = await this.db.reviewComment.findMany({
      where: { reviewAssignmentId: assignmentId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row: (typeof rows)[number]) => ({
      id: row.id,
      body: row.body,
      reviewAssignmentId: row.reviewAssignmentId,
      authorId: row.authorId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
}
