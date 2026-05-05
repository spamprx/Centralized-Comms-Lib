/** Mirrors backend `collectPlaceholderKeysFromBlocks` for client-side validation. */

type TipTapNode = {
  type: string;
  content?: TipTapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
};

type TipTapDoc = { type: 'doc'; content: TipTapNode[] };

export type PlaceholderKeyManifest = {
  fieldTokens: string[];
  mediaTokens: string[];
  requiredRowKeys: string[];
};

type RichTextBlock = {
  type: 'richText';
  props: { doc: TipTapDoc };
};

type FieldBlock = {
  type: 'field';
  props: { fieldKey: string };
};

type ContentBlock = RichTextBlock | FieldBlock | { type: string };

export function collectPlaceholderKeysFromDoc(doc: TipTapDoc): PlaceholderKeyManifest {
  const field = new Set<string>();
  const media = new Set<string>();

  function walk(nodes: TipTapNode[] | undefined): void {
    if (!nodes) return;
    for (const n of nodes) {
      if (n.type === 'text' && typeof n.text === 'string') {
        const t = n.text;
        let m: RegExpExecArray | null;
        // Match resolveTokensInNode / publish modal: optional spaces inside {{ }} and <>
        const reF = /\{\{\s*([\w.-]+)\s*\}\}/g;
        while ((m = reF.exec(t)) !== null) {
          field.add(m[1]);
        }
        const reM = /<\s*([a-zA-Z][\w.-]*)\s*>/g;
        while ((m = reM.exec(t)) !== null) {
          media.add(m[1]);
        }
      }
      if (
        (n.type === 'field' || n.type === 'regionField') &&
        typeof n.attrs?.fieldKey === 'string'
      ) {
        const fk = n.attrs.fieldKey.trim();
        if (fk.length > 0) field.add(fk);
      }
      walk(n.content);
    }
  }

  walk(doc.content);
  const fieldTokens = [...field];
  const mediaTokens = [...media];
  const requiredRowKeys = [...new Set([...fieldTokens, ...mediaTokens])];
  return { fieldTokens, mediaTokens, requiredRowKeys };
}

export function collectPlaceholderKeysFromBlocks(blocks: ContentBlock[]): PlaceholderKeyManifest {
  const field = new Set<string>();
  const media = new Set<string>();
  for (const b of blocks) {
    if (b.type === 'richText') {
      const m = collectPlaceholderKeysFromDoc((b as RichTextBlock).props.doc);
      m.fieldTokens.forEach((k) => field.add(k));
      m.mediaTokens.forEach((k) => media.add(k));
    }
    if (b.type === 'field') {
      field.add((b as FieldBlock).props.fieldKey);
    }
  }
  const fieldTokens = [...field];
  const mediaTokens = [...media];
  const requiredRowKeys = [...new Set([...fieldTokens, ...mediaTokens])];
  return { fieldTokens, mediaTokens, requiredRowKeys };
}

/**
 * Fallback: scan serialized body for placeholders TipTap walk might miss (nested shapes, odd splits).
 * Keeps regex aligned with {@link collectPlaceholderKeysFromDoc}.
 */
export function collectPlaceholderKeysFromRaw(body: unknown): PlaceholderKeyManifest {
  const field = new Set<string>();
  const media = new Set<string>();
  let str: string;
  try {
    str = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  } catch {
    str = '';
  }
  let m: RegExpExecArray | null;
  const reF = /\{\{\s*([\w.-]+)\s*\}\}/g;
  while ((m = reF.exec(str)) !== null) {
    field.add(m[1]);
  }
  const reM = /<\s*([a-zA-Z][\w.-]*)\s*>/g;
  while ((m = reM.exec(str)) !== null) {
    media.add(m[1]);
  }
  const fieldTokens = [...field];
  const mediaTokens = [...media];
  const requiredRowKeys = [...new Set([...fieldTokens, ...mediaTokens])];
  return { fieldTokens, mediaTokens, requiredRowKeys };
}

export function mergePlaceholderManifests(
  a: PlaceholderKeyManifest,
  b: PlaceholderKeyManifest,
): PlaceholderKeyManifest {
  const fieldTokens = [...new Set([...a.fieldTokens, ...b.fieldTokens])];
  const mediaTokens = [...new Set([...a.mediaTokens, ...b.mediaTokens])];
  const requiredRowKeys = [...new Set([...a.requiredRowKeys, ...b.requiredRowKeys])].sort((x, y) =>
    x.localeCompare(y),
  );
  return { fieldTokens, mediaTokens, requiredRowKeys };
}
