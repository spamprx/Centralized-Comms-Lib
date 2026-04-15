/**
 * Best-effort plain text from a TipTap / ProseMirror JSON `doc` for indexing.
 */
export function tiptapToPlainText(doc: unknown, maxLen = 200_000): string {
  if (!doc || typeof doc !== "object") return "";
  const parts: string[] = [];

  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (typeof n.text === "string") parts.push(n.text);
    const content = n.content;
    if (Array.isArray(content)) {
      for (const c of content) walk(c);
    }
  }

  walk(doc);
  const s = parts.join(" ").replace(/\s+/g, " ").trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}
