/**
 * How the version history screen loads data.
 *
 * - Omitted / unknown → **`static-then-api`** (default): show sample timeline immediately, then replace with API data when the request succeeds.
 * - `static` → sample data only; no list/detail API calls (restore still requires API when used).
 * - `api-first` → try API first; on failure, fall back to sample data (legacy integration style).
 *
 * Set in `.env`: `VITE_VERSION_HISTORY_MODE=static` or `api-first`
 */
export type VersionHistoryMode = 'static' | 'static-then-api' | 'api-first';

export function getVersionHistoryMode(): VersionHistoryMode {
  const v = String(import.meta.env.VITE_VERSION_HISTORY_MODE ?? '').trim().toLowerCase();
  if (v === 'static') return 'static';
  if (v === 'api' || v === 'api-first' || v === 'live') return 'api-first';
  return 'static-then-api';
}
