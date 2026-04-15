import type { Content } from '../services/contentService';

/** Strip HTML to plain text for token overlap. */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  const stripped = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped;
}

const STOP = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'for',
  'on',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'this',
  'that',
  'it',
  'as',
  'at',
  'by',
]);

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
  return new Set(words);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export type LocalSimilarItem = {
  contentId: string;
  title: string;
  similarityScore: number;
};

/**
 * Lightweight duplicate hint before a draft exists in the search index:
 * rank the author's existing items by token overlap on title + body snippet.
 */
export function rankLocalSimilarContent(
  title: string,
  bodyHtml: string,
  items: Content[],
  opts?: { excludeContentId?: string; limit?: number },
): LocalSimilarItem[] {
  const exclude = opts?.excludeContentId;
  const limit = opts?.limit ?? 8;
  const plainBody = htmlToPlainText(bodyHtml).slice(0, 2000);
  const qTitle = tokenize(title);
  const qBody = tokenize(plainBody);
  const query = new Set([...qTitle, ...qBody]);
  if (query.size === 0) return [];

  const scored: LocalSimilarItem[] = [];

  for (const item of items) {
    if (exclude && item.id === exclude) continue;
    const t = tokenize(item.title);
    const overlap = jaccard(query, t);
    const qWords = tokenize(title + ' ' + plainBody.slice(0, 800));
    const deeper = jaccard(qWords, t);
    const titleSub =
      title.trim().length > 2 &&
      item.title
        .toLowerCase()
        .includes(title.trim().toLowerCase().slice(0, Math.min(title.length, 48)))
        ? 0.18
        : 0;
    const raw = Math.min(1, overlap * 0.45 + deeper * 0.45 + titleSub);
    const similarityScore = Math.round(raw * 100);
    if (similarityScore < 12) continue;
    scored.push({ contentId: item.id, title: item.title, similarityScore });
  }

  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  return scored.slice(0, limit);
}
