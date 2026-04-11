import type { RankBlendWeights } from "./rankBlend";

export interface ContentSearchFilters {
  workspaceId?: string;
  lifecycleState?: string;
  visibility?: string;
  authorId?: string;
  templateId?: string;
  channelIds?: string[];
  tagIds?: string[];
  tagSlugs?: string[];
  aiGenerated?: boolean;
}

export interface ContentSearchRequest {
  q?: string;
  queryVector?: unknown;
  filters?: ContentSearchFilters;
  weights?: Partial<RankBlendWeights>;
  from?: number;
  size?: number;
  recencyHalfLifeDays?: number;
  includeFacets?: boolean;
  /** When true, keyword hits include highlighted snippets (safe HTML fragments). */
  includeSnippets?: boolean;
}

export interface FacetBucket {
  key: string | number | boolean;
  doc_count: number;
}

export interface ContentSearchHit {
  contentId: string;
  score: number;
  source: Record<string, unknown>;
  /** Combined safe HTML snippet for list UIs */
  snippetHtml?: string;
  /** Raw sanitized highlight fragments per field */
  highlight?: Record<string, string[]>;
}

export interface ContentSearchResponse {
  total: number;
  hits: ContentSearchHit[];
  facets?: Record<string, FacetBucket[]>;
}

export interface ContentCheckSearchRequest {
  contentId: string;
  filters?: ContentSearchFilters;
  minScore?: number;
  size?: number;
}

export interface ContentCheckByTextRequest {
  title?: string;
  summary?: string;
  body?: string;
  filters?: ContentSearchFilters;
  minScore?: number;
  size?: number;
}

export interface ContentCheckByTextResponse {
  total: number;
  hits: ContentSearchHit[];
  inputTooShort?: boolean;
  message?: string;
}
