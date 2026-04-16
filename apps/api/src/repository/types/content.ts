export type LifecycleState = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";

export type Visibility = "PUBLIC" | "PRIVATE_TO_GROUP";

export type VersionChangeType =
  | "MANUAL_SAVE"
  | "STATE_TRANSITION"
  | "RESTORE"
  | "AI_GENERATED";

export type ContentType = "ARTICLE" | "VIDEO" | "PODCAST" | "DOCUMENT";

export interface Content {
  id: string;
  title: string;
  slug: string;
  lifecycleState: LifecycleState;
  visibility: Visibility;
  contentType: ContentType;
  aiGenerated: boolean;
  authorId: string;
  author?: { id: string; displayName: string; email: string } | null;
  visibilityGroupId: string | null;
  templateId: string | null;
  /** Direct FK to the channel this content must comply with (set alongside templateId). */
  channelId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDraftInput {
  title: string;
  slug: string;
  authorId: string;
  contentType?: ContentType;
  aiGenerated?: boolean;
  templateId?: string | null;
  channelId?: string | null;
}

export interface ContentVersion {
  id: string;
  versionNumber: number;
  changeType: VersionChangeType;
  title: string;
  body: TipTapDocument | null;
  metadataSnapshot: unknown | null;
  contentId: string;
  authorId: string;
  createdAt: Date;
}

export type TipTapDocument = Record<string, unknown>;

export interface CreateContentVersionInput {
  contentId: string;
  authorId: string;
  changeType: VersionChangeType;
  title: string;
  body?: TipTapDocument | null;
  metadataSnapshot?: unknown;
}

export interface ContentListFilters {
  authorId?: string;
  lifecycleState?: LifecycleState;
  visibility?: Visibility;
  contentType?: ContentType;
  limit?: number;
  offset?: number;
}
