import type { ContentSearchFilters } from "../../search/searchTypes";

const LIFECYCLE = new Set(["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"]);
const VISIBILITY = new Set(["PUBLIC", "PRIVATE", "HIDDEN", "ARCHIVED", "PRIVATE_TO_GROUP"]);

function splitCsv(v: string | undefined): string[] | undefined {
  if (!v || !v.trim()) return undefined;
  const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
}

function parseBool(v: string | undefined): boolean | undefined {
  if (v === undefined || v === "") return undefined;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return undefined;
}

export interface ParsedFiltersResult {
  filters: ContentSearchFilters;
  errors: string[];
}

/**
 * Parses and validates facet filter query parameters for `/search/content`.
 */
export function parseContentSearchFilters(q: Record<string, unknown>): ParsedFiltersResult {
  const errors: string[] = [];
  const filters: ContentSearchFilters = {};

  const ws = typeof q.workspaceId === "string" ? q.workspaceId : undefined;
  if (ws) filters.workspaceId = ws;

  const ls = typeof q.lifecycleState === "string" ? q.lifecycleState : undefined;
  if (ls) {
    if (!LIFECYCLE.has(ls)) errors.push(`Invalid lifecycleState: ${ls}`);
    else filters.lifecycleState = ls;
  }

  const vis = typeof q.visibility === "string" ? q.visibility : undefined;
  if (vis) {
    if (!VISIBILITY.has(vis)) errors.push(`Invalid visibility: ${vis}`);
    else filters.visibility = vis;
  }

  const aid = typeof q.authorId === "string" ? q.authorId : undefined;
  if (aid) filters.authorId = aid;

  const tid = typeof q.templateId === "string" ? q.templateId : undefined;
  if (tid) filters.templateId = tid;

  const ch = splitCsv(typeof q.channelIds === "string" ? q.channelIds : undefined);
  if (ch) filters.channelIds = ch;

  const tagIds = splitCsv(typeof q.tagIds === "string" ? q.tagIds : undefined);
  if (tagIds) filters.tagIds = tagIds;

  const tagSlugs = splitCsv(typeof q.tagSlugs === "string" ? q.tagSlugs : undefined);
  if (tagSlugs) filters.tagSlugs = tagSlugs;

  const ai = parseBool(typeof q.aiGenerated === "string" ? q.aiGenerated : undefined);
  if (ai !== undefined) filters.aiGenerated = ai;

  return { filters, errors };
}
