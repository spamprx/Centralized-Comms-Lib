import type { ContentItem } from '../data/mockLibraryData';
import type { ContentSearchHit } from '../services/searchService';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wrap query token matches in <mark>; safe for injection when fed mock catalog text. */
export function highlightTokensInText(text: string, query: string): string {
  const rawTokens = query.trim().split(/\s+/).filter(Boolean);
  if (!rawTokens.length) return escapeHtml(text);
  const escaped = rawTokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  let result = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    result += escapeHtml(text.slice(last, m.index));
    result += `<mark>${escapeHtml(m[0])}</mark>`;
    last = m.index + m[0].length;
  }
  result += escapeHtml(text.slice(last));
  return result;
}

function haystack(item: ContentItem): string {
  return [item.title, item.author, item.tags.join(' '), item.type, item.channel, item.status]
    .join(' ')
    .toLowerCase();
}

function itemMatchesQuery(item: ContentItem, query: string): boolean {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  const h = haystack(item);
  return tokens.every((t) => h.includes(t.toLowerCase()));
}

function scoreItem(item: ContentItem, query: string): number {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const qLower = query.trim().toLowerCase();
  const title = item.title.toLowerCase();
  const author = item.author.toLowerCase();
  let score = 0;

  if (tokens.length <= 1) {
    if (title.includes(qLower)) {
      score += 100;
      if (title.startsWith(qLower)) score += 35;
      const pos = title.indexOf(qLower);
      if (pos >= 0) score += Math.max(0, 24 - pos / 4);
    }
    if (author.includes(qLower)) score += 48;
    for (const tag of item.tags) {
      if (tag.toLowerCase().includes(qLower)) score += 32;
    }
  } else {
    for (const t of tokens) {
      const tl = t.toLowerCase();
      if (title.includes(tl)) score += 55;
      if (author.includes(tl)) score += 28;
      for (const tag of item.tags) {
        if (tag.toLowerCase().includes(tl)) score += 18;
      }
    }
  }

  const meta = `${item.type} ${item.channel} ${item.status}`.toLowerCase();
  if (meta.includes(qLower)) score += 10;
  score += Math.log1p(Math.max(0, item.views)) * 0.12;
  return score;
}

function buildSnippetText(item: ContentItem, maxLen = 240): string {
  const line1 = `${item.type} · ${item.channel} · ${item.status}`;
  const line2 = item.tags.length ? `Tags: ${item.tags.join(', ')}` : '';
  const base = line2 ? `${line1} · ${line2}` : line1;
  if (base.length <= maxLen) return base;
  return `${base.slice(0, maxLen - 1)}…`;
}

/**
 * Offline full-text style search over mock library rows: match, rank, snippets, highlights.
 */
export function staticSearchLibrary(items: ContentItem[], query: string): ContentSearchHit[] {
  const q = query.trim();
  if (!q) return [];

  const matched = items.filter((item) => itemMatchesQuery(item, q));
  const hits: ContentSearchHit[] = matched.map((item) => {
    const s = scoreItem(item, q);
    const titleHtml = highlightTokensInText(item.title, q);
    const snippetRaw = buildSnippetText(item);
    const snippetHtml = highlightTokensInText(snippetRaw, q);

    return {
      contentId: item.id,
      score: s,
      source: {
        title: item.title,
        author: item.author,
        type: item.type,
        channel: item.channel,
        status: item.status,
      },
      highlight: { title: [titleHtml] },
      snippetHtml,
    };
  });

  hits.sort((a, b) => b.score - a.score);
  return hits;
}
