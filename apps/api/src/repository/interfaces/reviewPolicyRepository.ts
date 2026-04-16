import type {
  CreateReviewPolicyInput,
  ReviewPolicy,
  UpdateReviewPolicyInput,
} from "../types";

export interface ReviewPolicyRepository {
  list(): Promise<ReviewPolicy[]>;
  getById(id: string): Promise<ReviewPolicy | null>;
  create(input: CreateReviewPolicyInput): Promise<ReviewPolicy>;
  update(id: string, input: UpdateReviewPolicyInput): Promise<ReviewPolicy>;
  delete(id: string): Promise<void>;

  /**
   * Returns active policy candidates matching the content type and optionally
   * the content's channel and/or the author's user groups.
   */
  listActiveCandidates(input: {
    contentType: ReviewPolicy["contentType"];
    channelId: string | null;
    userGroupIds: string[];
  }): Promise<ReviewPolicy[]>;
}

