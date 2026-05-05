/**
 * In-memory user cache after /auth/me (JWT stays in HttpOnly cookie only).
 */

type CachedUser = {
  id: string;
  email: string;
  displayName?: string | null;
  role?: string;
};

let _cachedUser: CachedUser | null = null;

export function setCachedUser(user: CachedUser | null) {
  _cachedUser = user;
}

export function getCachedUser(): CachedUser | null {
  return _cachedUser;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(
    new RegExp('(?:^|;\\s*)' + name.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&') + '=([^;]*)'),
  );
  return m ? decodeURIComponent(m[1]) : null;
}

/** Double-submit CSRF header for mutating API calls. */
export function csrfHeader(method: string): Record<string, string> {
  const m = (method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(m)) return {};
  const csrf = readCookie('csrf_token');
  return csrf ? { 'X-CSRF-Token': csrf } : {};
}

/** @deprecated No JWT in JS — use cookie auth + csrfHeader */
export function getAuthToken(): string | null {
  return null;
}

/** @deprecated Token is HttpOnly — use setCachedUser / clearSession */
export function setAuthToken(_token: string | null) {
  if (_token === null) {
    _cachedUser = null;
  }
}

export function clearSession() {
  _cachedUser = null;
}

/** @deprecated Use /auth/me + setCachedUser */
export function decodeTokenPayload(): { id: string; email: string; role: string } | null {
  const u = _cachedUser;
  if (!u) return null;
  return { id: u.id, email: u.email, role: u.role ?? 'USER' };
}
