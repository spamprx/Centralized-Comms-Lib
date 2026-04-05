/**
 * Re-exports document and search packages from `packages/database/*`.
 * Use these when wiring snapshot storage or Elasticsearch indexing in the API.
 */
export * from "@comms-lib/db-mongo";
export * from "@comms-lib/db-elasticsearch";
