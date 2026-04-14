// Token store using sessionStorage for persistence and in-memory cache for fast access.
// This keeps the session intact across refreshes, but clears on tab/browser close.
// The JWT payload contains user info (id, email, role), so no separate user storage is needed.

let _token: string | null = null;

const STORAGE_KEY = 'auth_token';

function canUseSessionStorage(): boolean {
  try {
    return !!globalThis.window?.sessionStorage;
  } catch {
    return false;
  }
}

/** Store the token in sessionStorage and in-memory cache */
export function setAuthToken(token: string | null) {
  _token = token;
  if (canUseSessionStorage()) {
    try {
      if (token) globalThis.window!.sessionStorage.setItem(STORAGE_KEY, token);
      else globalThis.window!.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore (storage disabled)
    }
  }

  // Backward-compat cleanup: if an older build set a cookie, clear it.
  if (token === null) {
    document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax';
  }
}

/** Get the token — from memory first, then fall back to sessionStorage */
export function getAuthToken(): string | null {
  if (_token) return _token;
  if (canUseSessionStorage()) {
    try {
      const stored = globalThis.window!.sessionStorage.getItem(STORAGE_KEY);
      if (stored) _token = stored;
    } catch {
      // ignore
    }
  }
  return _token;
}

/** Decode the JWT payload to extract user info (id, email, role).
 *  Does NOT verify the signature — that's the server's job.  */
export function decodeTokenPayload(): { id: string; email: string; role: string } | null {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return { id: payload.id, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}
