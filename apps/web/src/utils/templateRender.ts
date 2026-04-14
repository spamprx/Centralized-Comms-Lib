export type RenderResult = {
  rendered: string;
  placeholders: string[];
  missing: string[];
};

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export function extractPlaceholders(template: string): string[] {
  const found = new Set<string>();
  for (const m of template.matchAll(PLACEHOLDER_RE)) {
    const key = m[1]?.trim();
    if (key) found.add(key);
  }
  return Array.from(found);
}

function getByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.').filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
    else return undefined;
  }
  return cur;
}

function toStringValue(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

export function renderTemplate(template: string, data: Record<string, unknown>): RenderResult {
  const placeholders = extractPlaceholders(template);
  const missing = new Set<string>();

  const rendered = template.replace(PLACEHOLDER_RE, (_full, keyRaw: string) => {
    const key = String(keyRaw ?? '').trim();
    if (!key) return '';
    const value = getByPath(data, key);
    const asString = toStringValue(value);
    if (asString == null) {
      missing.add(key);
      return `{{${key}}}`;
    }
    return asString;
  });

  return { rendered, placeholders, missing: Array.from(missing) };
}

export function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

