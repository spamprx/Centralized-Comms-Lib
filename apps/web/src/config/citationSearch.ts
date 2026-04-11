/**
 * Reference picker data source for the citation dialog.
 *
 * - Default (omit env or `static`): bundled mock hits — no `/search/content` calls.
 * - `live`: use Search & Retrieval — `GET /search/content`.
 *
 * In `.env`: `VITE_CITATION_SEARCH_MODE=live`
 */
export function isLiveCitationSearchMode(): boolean {
  return import.meta.env.VITE_CITATION_SEARCH_MODE === 'live';
}
