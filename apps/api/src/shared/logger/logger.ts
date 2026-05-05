/**
 * Structured logging with token / secret redaction (NFR-SEC-03).
 */

const JWT_RE =
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "passwordhash",
  "token",
  "apikey",
  "api_key",
  "csrf_token",
  "auth_token",
  "refreshtoken",
  "secret",
  "jwt",
]);

function redactString(s: string): string {
  let out = s.replace(JWT_RE, "[REDACTED_JWT]");
  out = out.replace(/password[=:]\s*[^\s&]+/gi, "password=[REDACTED]");
  return out;
}

function redactValue(key: string, value: unknown): unknown {
  const lk = key.toLowerCase();
  if (SENSITIVE_KEYS.has(lk)) return "[REDACTED]";
  if (typeof value === "string") return redactString(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return redactObject(value as Record<string, unknown>);
  }
  if (Array.isArray(value)) {
    return value.map((v, i) => redactValue(String(i), v));
  }
  return value;
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = redactValue(k, v);
  }
  return out;
}

function redactArgs(args: unknown[]): unknown[] {
  return args.map((a) => {
    if (typeof a === "string") return redactString(a);
    if (a instanceof Error) {
      return new Error(redactString(a.message));
    }
    if (a && typeof a === "object" && !Array.isArray(a)) {
      try {
        return redactObject(a as Record<string, unknown>);
      } catch {
        return a;
      }
    }
    return a;
  });
}

export const logger = {
  info: (...args: unknown[]) => {
    console.log(...redactArgs(args));
  },
  warn: (...args: unknown[]) => {
    console.warn(...redactArgs(args));
  },
  error: (...args: unknown[]) => {
    console.error(...redactArgs(args));
  },
};
