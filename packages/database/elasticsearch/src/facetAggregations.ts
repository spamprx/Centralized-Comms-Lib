/**
 * Default facet fields for filter UIs. All use `keyword` or compatible mappings
 * so `terms` aggregations stay fast (doc_values).
 */
export const CONTENT_FACET_FIELDS = [
  "lifecycleState",
  "visibility",
  "workspaceId",
  "authorId",
  "templateId",
  "channelIds",
  "tagIds",
  "tagSlugs",
  "aiGenerated",
] as const;

export type ContentFacetField = (typeof CONTENT_FACET_FIELDS)[number];

const DEFAULT_TERMS_SIZE = 50;

/**
 * Builds a `terms` aggregation per facet field for efficient filter buckets.
 */
export function buildContentFacetAggregations(
  fields: readonly ContentFacetField[] = CONTENT_FACET_FIELDS,
): Record<string, unknown> {
  const aggs: Record<string, unknown> = {};
  for (const field of fields) {
    aggs[`facet_${field}`] = {
      terms: { field, size: DEFAULT_TERMS_SIZE, missing: "__missing__" },
    };
  }
  return aggs;
}
