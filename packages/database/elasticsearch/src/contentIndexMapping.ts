import indexJson from "./comms-content-index.json";

/**
 * Default index name for searchable content (title / summary / body).
 */
export const CONTENT_INDEX_NAME =
  process.env.ELASTICSEARCH_CONTENT_INDEX?.trim() || "comms-content";

/** Same structure as `src/comms-content-index.json` (bundled) for `indices.create`. */
export function buildContentIndexSettingsAndMappings(): Record<string, unknown> {
  return indexJson as Record<string, unknown>;
}
