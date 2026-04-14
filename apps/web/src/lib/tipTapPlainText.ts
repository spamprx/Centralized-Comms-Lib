/**
 * Best-effort plain text from a TipTap / ProseMirror JSON document.
 */
export function tipTapJsonToPlainText(doc: unknown): string {
  if (doc == null) return '';
  if (typeof doc === 'string') return doc;
  if (typeof doc !== 'object') return '';
  const node = doc as Record<string, unknown>;
  if (typeof node.text === 'string') return node.text;
  const type = typeof node.type === 'string' ? node.type : '';
  const parts = Array.isArray(node.content) ? node.content.map(tipTapJsonToPlainText) : [];
  const inner = parts.join('');
  if (type === 'hardBreak') return '\n';
  if (
    type === 'paragraph' ||
    type === 'heading' ||
    type === 'blockquote' ||
    type === 'listItem' ||
    type === 'codeBlock' ||
    type === 'horizontalRule'
  ) {
    return inner ? `${inner}\n` : '\n';
  }
  if (type === 'bulletList' || type === 'orderedList') {
    return inner;
  }
  return inner;
}
