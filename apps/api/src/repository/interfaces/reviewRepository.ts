import {
  ReviewAssignment,
  ReviewComment,
  ReviewCommentInput,
  ReviewDecisionInput,
  ReviewRequest,
  ReviewRequestStatus,
} from "../types";

export interface ReviewRepository {
  createRequest(input: {
    contentId: string;
    contentVersionId: string;
    requestedById: string;
    quorumRequired?: number;
  }): Promise<ReviewRequest>;

  getRequestById(id: string): Promise<ReviewRequest | null>;
  listRequestsForContent(contentId: string): Promise<ReviewRequest[]>;
  updateRequestStatus(requestId: string, status: ReviewRequestStatus): Promise<ReviewRequest>;

  assignReviewer(input: {
    reviewRequestId: string;
    reviewerId: string;
    assignedById: string;
  }): Promise<ReviewAssignment>;

  getAssignmentById(id: string): Promise<ReviewAssignment | null>;
  listAssignmentsForRequest(requestId: string): Promise<ReviewAssignment[]>;
  listAssignmentsForReviewer(reviewerId: string): Promise<ReviewAssignment[]>;

  recordDecision(input: ReviewDecisionInput): Promise<void>;

  rollbackDecision(assignmentId: string): Promise<void>;

  addComment(input: ReviewCommentInput): Promise<ReviewComment>;

  listComments(assignmentId: string): Promise<ReviewComment[]>;
}

