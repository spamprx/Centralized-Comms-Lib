/** How the inline citation callout appears in the document (TipTap HTML). */
export type CitationMarkerMode = 'chip' | 'raised' | 'paren';

/** Matches our References block; allows legacy plain `<h2>References</h2>`. */
const BIB_BLOCK_RE =
  /<h2(?:\s+class="editor-references-heading")?>References<\/h2>\s*<ol[^>]*>[\s\S]*?<\/ol>/im;
const BIB_BLOCK_CAPTURE_RE =
  /<h2(?:\s+class="editor-references-heading")?>References<\/h2>\s*(<ol[^>]*>[\s\S]*?<\/ol>)/im;
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
  // New shape: keep a manual slot at the end so authors can add extra references.
  return `${REFERENCES_HEADING}<ol class="editor-references-list" data-editor-references="true"><li data-ref-kind="manual"><p></p></li></ol>`;
}

type BibItem = { marker: number; text: string; contentId?: string };

function extractManualLisFromExistingHtml(existingHtml: string): string {
  const m = BIB_BLOCK_CAPTURE_RE.exec(existingHtml);
  if (!m?.[1]) return '';
  const ol = m[1];
  const idx = ol.search(/<li[^>]*data-ref-kind="manual"[^>]*>/i);
  if (idx < 0) return '';
  // Keep manual content from first manual li through end of <ol>.
  const innerStart = ol.indexOf('>') + 1;
  const innerEnd = ol.lastIndexOf('</ol>');
  if (innerStart < 0 || innerEnd < 0 || innerEnd <= innerStart) return '';
  const inner = ol.slice(innerStart, innerEnd);
  return inner.slice(idx).trim();
}

function bibliographyBlock(items: BibItem[], manualLisHtml: string): string {
  if (items.length === 0 && !manualLisHtml) return '';
  const citationLis = items
    .map((c) => {
      const safeText = escapeHtml(c.text);
      const idRaw = typeof c.contentId === 'string' ? c.contentId.trim() : '';
      const href = idRaw ? `/library/${encodeURIComponent(idRaw)}` : '';
      const body = href
        ? `<a class="editor-reference-link" href="${href}" data-content-id="${escapeHtml(
            idRaw,
          )}">${safeText}</a>`
        : safeText;
      return `<li data-ref-kind="citation" data-citation-marker="${c.marker}"><span class="ref-index">[${c.marker}]</span> ${body}</li>`;
    })
    .join('');
  const manual =
    manualLisHtml && manualLisHtml.trim()
      ? manualLisHtml
      : '<li data-ref-kind="manual"><p></p></li>';
  return `${REFERENCES_HEADING}<ol class="editor-references-list" data-editor-references="true">${citationLis}${manual}</ol>`;
}

/**
 * Updates or appends the References list. Prefers an existing `<h2>References</h2><ol>…</ol>` block,
 * then legacy `<!--BIBLIO_*-->` markers; otherwise appends at the end of the HTML.
 */
export function upsertBibliographySection(currentHtml: string, citations: BibItem[]): string {
  const manualLis = extractManualLisFromExistingHtml(currentHtml);
  // Support callers passing richer citation objects (e.g. EditorLayout's `CitationItem`)
  // by picking `sourceId` as the canonical content id when `contentId` is absent.
  const normalized = citations.map((c) => ({
    marker: c.marker,
    text: c.text,
    contentId:
      typeof c.contentId === 'string'
        ? c.contentId
        : typeof (c as any).sourceId === 'string'
          ? String((c as any).sourceId)
          : undefined,
  }));
  const block = bibliographyBlock(normalized, manualLis);
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
