/**
 * Search module public surface (HTTP handlers live in `search.routes.ts`).
 */
export {
  searchContentCached,
  searchContentCheck,
  searchContentCheckByText,
  syncContentIndexFromDb,
} from "./contentSearch.service";
