import type { Template } from "./types";

/** Coerce Prisma Json into nested locale → key → string maps. */
export function normalizeI18nFromDb(raw: unknown): Template["i18n"] {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const o = raw as Record<string, unknown>;
  const out: Record<string, Record<string, string>> = {};
  for (const [locale, bundle] of Object.entries(o)) {
    if (!bundle || typeof bundle !== "object" || Array.isArray(bundle))
      continue;
    const inner: Record<string, string> = {};
    for (const [k, v] of Object.entries(bundle as Record<string, unknown>)) {
      if (typeof v === "string") inner[k] = v;
    }
    out[locale] = inner;
  }
  return out;
}
