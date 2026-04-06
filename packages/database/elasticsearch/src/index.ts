export { getElasticsearchClient } from "./client";
export {
  CONTENT_INDEX_NAME,
  buildContentIndexSettingsAndMappings,
} from "./contentIndexMapping";
export { TITLE_EMBEDDING_DIMS } from "./embedding";
export {
  CONTENT_FACET_FIELDS,
  buildContentFacetAggregations,
  type ContentFacetField,
} from "./facetAggregations";
