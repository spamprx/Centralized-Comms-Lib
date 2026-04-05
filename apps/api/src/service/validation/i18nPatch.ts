/** BCP 47–style locale tags: e.g. en, en-US */
const LOCALE_RE = /^[a-z]{2}(-[A-Za-z0-9]+)*$/;

export type I18nStrings = Record<string, Record<string, string>>;

export function isValidLocaleTag(locale: string): boolean {
  return LOCALE_RE.test(locale);
}

export function parseI18nPatch(raw: unknown): I18nStrings {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("i18n payload must be an object of locale → key → string");
  }
  const root = raw as Record<string, unknown>;
  const out: I18nStrings = {};
  for (const [locale, bundle] of Object.entries(root)) {
    if (!isValidLocaleTag(locale)) {
      throw new Error(`Invalid locale tag: ${locale}`);
    }
    if (bundle == null || typeof bundle !== "object" || Array.isArray(bundle)) {
      throw new Error(`Invalid string bundle for locale ${locale}`);
    }
    const b = bundle as Record<string, unknown>;
    const inner: Record<string, string> = {};
    for (const [k, v] of Object.entries(b)) {
      if (typeof k !== "string" || !k.trim()) {
        throw new Error("i18n keys must be non-empty strings");
      }
      if (typeof v !== "string") {
        throw new Error(`i18n value for ${locale}.${k} must be a string`);
      }
      inner[k] = v;
    }
    out[locale] = inner;
  }
  return out;
}

export function mergeI18n(base: I18nStrings, patch: I18nStrings): I18nStrings {
  const next: I18nStrings = { ...base };
  for (const [locale, strings] of Object.entries(patch)) {
    next[locale] = { ...(next[locale] ?? {}), ...strings };
  }
  return next;
}

export function normalizeI18nFromDb(raw: unknown): I18nStrings {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const o = raw as Record<string, unknown>;
  const out: I18nStrings = {};
  for (const [locale, bundle] of Object.entries(o)) {
    if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) continue;
    const inner: Record<string, string> = {};
    for (const [k, v] of Object.entries(bundle as Record<string, unknown>)) {
      if (typeof v === "string") inner[k] = v;
    }
    out[locale] = inner;
  }
  return out;
}
