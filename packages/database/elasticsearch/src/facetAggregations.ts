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

const BOOLEAN_FACET_FIELDS: ReadonlySet<string> = new Set(["aiGenerated"]);

/**
 * Builds a `terms` aggregation per facet field for efficient filter buckets.
 * The `missing` placeholder is omitted for boolean fields because ES cannot
 * parse a string placeholder as a boolean value.
 */
export function buildContentFacetAggregations(
  fields: readonly ContentFacetField[] = CONTENT_FACET_FIELDS,
): Record<string, unknown> {
  const aggs: Record<string, unknown> = {};
  for (const field of fields) {
    const terms: Record<string, unknown> = { field, size: DEFAULT_TERMS_SIZE };
    if (!BOOLEAN_FACET_FIELDS.has(field)) {
      terms.missing = "__missing__";
    }
    aggs[`facet_${field}`] = { terms };
  }
  return aggs;
}
