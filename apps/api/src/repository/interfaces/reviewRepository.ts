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
  /** Active review request(s) for a content (used to merge to latest). */
  listOpenRequestsForContent(contentId: string): Promise<ReviewRequest[]>;
  /** Update which version is under review (used when merging/upgrading). */
  updateRequestVersionAndQuorum(
    requestId: string,
    input: { contentVersionId?: string; quorumRequired?: number },
  ): Promise<ReviewRequest>;
  updateRequestStatus(
    requestId: string,
    status: ReviewRequestStatus,
  ): Promise<ReviewRequest>;

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

  /**
   * Clears any decisions and resets assignment status back to PENDING for all assignments in a request.
   * Used when content is re-submitted for review so reviewers can decide again.
   */
  resetAssignmentsForRequest(requestId: string): Promise<void>;

  addComment(input: ReviewCommentInput): Promise<ReviewComment>;

  listComments(assignmentId: string): Promise<ReviewComment[]>;

  /**
   * True when there exists a CLOSED review request for this exact content version
   * whose quorumRequired meets or exceeds `requiredQuorum`.
   */
  hasClosedRequestMeetingQuorumForVersion(input: {
    contentId: string;
    contentVersionId: string;
    requiredQuorum: number;
  }): Promise<boolean>;
}
