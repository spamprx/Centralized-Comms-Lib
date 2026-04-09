/**
 * Elasticsearch highlight HTML: allow only <em> and <mark>; strip other tags.
 */
export function sanitizeHighlightFragments(fragments: string[] | undefined): string[] {
  if (!fragments?.length) return [];
  return fragments.map(sanitizeOne);
}

function sanitizeOne(fragment: string): string {
  return fragment
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<(?!\/?\s*(?:em|mark)\b)[^>]+>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

export function joinSnippet(fragments: string[], maxLen = 280): string {
  const parts = sanitizeHighlightFragments(fragments);
  if (!parts.length) return "";
  let out = parts[0] ?? "";
  for (let i = 1; i < parts.length && out.length < maxLen; i++) {
    out += " … " + parts[i];
  }
  if (out.length > maxLen) {
    return `${out.slice(0, maxLen)}…`;
  }
  return out;
}
