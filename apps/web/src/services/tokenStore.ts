// Token store using cookies for persistence and in-memory cache for fast access.
// The JWT payload contains user info (id, email, role), so no separate user storage is needed.

let _token: string | null = null;

/** Parse a cookie value by name from document.cookie */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Store the token in a cookie and in-memory cache */
export function setAuthToken(token: string | null) {
  _token = token;
  if (token) {
    document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; max-age=${24 * 60 * 60}; SameSite=Lax`;
  } else {
    document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax';
  }
}

/** Get the token — from memory first, then fall back to cookie */
export function getAuthToken(): string | null {
  if (_token) return _token;
  // Restore from cookie on first access (e.g. after page refresh)
  const cookieToken = getCookie('auth_token');
  if (cookieToken) {
    _token = cookieToken;
  }
  return _token;
}

/** Decode the JWT payload to extract user info (id, email, role).
 *  Does NOT verify the signature — that's the server's job.  */
export function decodeTokenPayload(): { id: string; email: string; role?: string } | null {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // JWT payload is base64url encoded (not standard base64).
    const base64Url = parts[1] ?? '';
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>;
    const id =
      String(payload.id ?? payload.userId ?? payload.user_id ?? payload.sub ?? '').trim();
    const email =
      String(payload.email ?? payload.userEmail ?? payload.user_email ?? '').trim();
    const roleRaw = payload.role ?? payload.userRole ?? payload.user_role;
    const role = typeof roleRaw === 'string' ? roleRaw : undefined;

    if (!id || !email) return null;
    return { id, email, role };
  } catch {
    return null;
  }
}
