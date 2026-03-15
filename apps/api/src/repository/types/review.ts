export type ReviewRequestStatus = "OPEN" | "CLOSED" | "CANCELLED";
export type ReviewAssignmentStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";
export type ReviewDecisionVerdict = "APPROVED" | "DENIED" | "ROLLBACK";

export interface ReviewRequest {
  id: string;
  status: ReviewRequestStatus;
  quorumRequired: number;
  contentId: string;
  contentVersionId: string;
  requestedById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewAssignment {
  id: string;
  status: ReviewAssignmentStatus;
  reviewRequestId: string;
  reviewerId: string;
  assignedById: string;
  assignedAt: Date;
  completedAt: Date | null;
}

export interface ReviewDecisionInput {
  reviewAssignmentId: string;
  verdict: ReviewDecisionVerdict;
  comment: string;
  isAutoApproval?: boolean;
}

