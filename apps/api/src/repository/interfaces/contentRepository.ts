import {
  Content,
  ContentListFilters,
  ContentVersion,
  CreateContentVersionInput,
  CreateDraftInput,
  LifecycleState,
  Visibility,
} from "../types";

export interface ContentRepository {
  createDraft(input: CreateDraftInput): Promise<Content>;
  getById(id: string): Promise<Content | null>;
  getBySlug(slug: string): Promise<Content | null>;
  list(filters?: ContentListFilters): Promise<Content[]>;
  updateTitle(contentId: string, title: string): Promise<Content>;

  updateLifecycleState(
    contentId: string,
    lifecycleState: LifecycleState,
  ): Promise<Content>;

  updateVisibility(contentId: string, visibility: Visibility): Promise<Content>;
  bindVisibilityGroup(
    contentId: string,
    visibilityGroupId: string | null,
  ): Promise<Content>;

  createVersion(input: CreateContentVersionInput): Promise<ContentVersion>;
  listVersions(contentId: string): Promise<ContentVersion[]>;
  getLatestVersion(contentId: string): Promise<ContentVersion | null>;
  /**
   * Latest version at or before `maxVersionNumber` whose `body` is non-null.
   * Used to resolve document text for snapshots when intermediate rows omit `body` (e.g. state transitions).
   */
  getVersionWithBodyAtOrBefore(
    contentId: string,
    maxVersionNumber: number,
  ): Promise<ContentVersion | null>;
}

