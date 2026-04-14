export type LifecycleState = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";

export type Visibility =
  | "PUBLIC"
  | "PRIVATE"
  | "HIDDEN"
  | "ARCHIVED"
  | "PRIVATE_TO_GROUP";

export type VersionChangeType = "MANUAL_SAVE" | "STATE_TRANSITION" | "RESTORE" | "AI_GENERATED";

export interface Content {
  id: string;
  title: string;
  slug: string;
  lifecycleState: LifecycleState;
  visibility: Visibility;
  aiGenerated: boolean;
  authorId: string;
  visibilityGroupId: string | null;
  templateId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDraftInput {
  title: string;
  slug: string;
  authorId: string;
  aiGenerated?: boolean;
  templateId?: string | null;
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
  limit?: number;
  offset?: number;
}

