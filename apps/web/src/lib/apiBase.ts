/**
 * The API mounts authenticated routes at /api/v1 (see apps/api/src/app.ts).
 * Accept either a full base ending in /api/v1 or a bare origin; append /api/v1 when missing.
 */
export function resolveApiV1Base(): string {
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (!raw) {
    return import.meta.env.DEV ? '/api/v1' : 'http://127.0.0.1:8000/api/v1';
  }
  const base = raw.replace(/\/$/, '');
  if (/\/api\/v\d+$/i.test(base)) return base;
  return `${base}/api/v1`;
}

/** Absolute URL for a path under `/api/v1` (e.g. `/search/content`). */
export function joinApiV1Path(path: string): string {
  const base = resolveApiV1Base().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
