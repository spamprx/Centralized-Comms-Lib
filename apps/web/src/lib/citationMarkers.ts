/** How the inline citation callout appears in the document (TipTap HTML). */
export type CitationMarkerMode = 'chip' | 'raised' | 'paren';

/** Matches our References block; allows legacy plain `<h2>References</h2>`. */
const BIB_BLOCK_RE =
  /<h2(?:\s+class="editor-references-heading")?>References<\/h2>\s*<ol>[\s\S]*?<\/ol>/im;
const LEGACY_BIB_RE = /<!--BIBLIO_START-->[\s\S]*?<!--BIBLIO_END-->/m;

const REFERENCES_HEADING = '<h2 class="editor-references-heading">References</h2>';

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Visible block TipTap can keep (vs HTML comments, which are often dropped). */
export function hasBibliographySection(html: string): boolean {
  return BIB_BLOCK_RE.test(html) || LEGACY_BIB_RE.test(html);
}

/** Empty scaffold the user can place at the cursor; first citation fills the list. */
export function emptyReferencesSectionHtml(): string {
  return `${REFERENCES_HEADING}<ol><li><p></p></li></ol>`;
}

type BibItem = { marker: number; text: string };

function bibliographyBlock(items: BibItem[]): string {
  if (items.length === 0) return '';
  const lis = items.map((c) => `<li>[${c.marker}] ${escapeHtml(c.text)}</li>`).join('');
  return `${REFERENCES_HEADING}<ol>${lis}</ol>`;
}

/**
 * Updates or appends the References list. Prefers an existing `<h2>References</h2><ol>…</ol>` block,
 * then legacy `<!--BIBLIO_*-->` markers; otherwise appends at the end of the HTML.
 */
export function upsertBibliographySection(currentHtml: string, citations: BibItem[]): string {
  const block = bibliographyBlock(citations);
  if (BIB_BLOCK_RE.test(currentHtml)) {
    if (!block) return currentHtml.replace(BIB_BLOCK_RE, '');
    return currentHtml.replace(BIB_BLOCK_RE, block);
  }
  if (LEGACY_BIB_RE.test(currentHtml)) {
    if (!block) return currentHtml.replace(LEGACY_BIB_RE, '');
    return currentHtml.replace(LEGACY_BIB_RE, block);
  }
  if (!block) return currentHtml;
  return `${currentHtml}${currentHtml.endsWith('</p>') ? '' : '<p></p>'}${block}`;
}
