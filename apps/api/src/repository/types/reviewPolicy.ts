import type { ContentType } from "./content";

export type ReviewPolicy = {
  id: string;
  contentType: ContentType;
  channelId: string | null;
  userGroupId: string | null;
  quorumRequired: number;
  isActive: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateReviewPolicyInput = {
  contentType: ContentType;
  channelId?: string | null;
  userGroupId?: string | null;
  quorumRequired: number;
  isActive?: boolean;
  createdById?: string | null;
};

export type UpdateReviewPolicyInput = {
  contentType?: ContentType;
  channelId?: string | null;
  userGroupId?: string | null;
  quorumRequired?: number;
  isActive?: boolean;
};

