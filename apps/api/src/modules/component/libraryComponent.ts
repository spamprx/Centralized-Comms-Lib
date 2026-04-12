import type { TipTapDocument } from "../../repository/types";

export type InsertionMode = "linked" | "detached";

/** TipTap node type for library blocks (linked live-sync vs detached snapshot). */
export const LIBRARY_NODE_TYPE = "commsLibraryComponent";

const LIBRARY_NODE = LIBRARY_NODE_TYPE;

function deepCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function isTipTapDoc(obj: unknown): obj is TipTapDocument {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const d = obj as Record<string, unknown>;
  return d.type === "doc" && Array.isArray(d.content);
}

/**
 * Accepts a full doc or a fragment array; returns a canonical TipTap doc for storage in attrs.
 */
export function normalizeSnapshotDoc(raw: unknown): TipTapDocument | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    return { type: "doc", content: deepCloneJson(raw) } as TipTapDocument;
  }
  if (isTipTapDoc(raw)) {
    return deepCloneJson(raw);
  }
  return null;
}

function defaultPlaceholderParagraph(kind: "linked" | "detached", label: string): unknown {
  const prefix = kind === "linked" ? "↻ Linked" : "⎘ Detached";
  return {
    type: "paragraph",
    content: [
      {
        type: "text",
        text: `${prefix} · ${label} (${kind === "linked" ? "updates with library" : "frozen copy"})`,
      },
    ],
  };
}

function contentFromDocOrEmpty(doc: TipTapDocument | null | undefined): unknown[] {
  if (!doc || !Array.isArray((doc as { content?: unknown }).content)) {
    return [];
  }
  return deepCloneJson((doc as { content: unknown[] }).content);
}

export function buildLinkedLibraryNode(input: {
  componentKey: string;
  componentVersionId: string;
  label: string;
  componentName?: string | null;
  canonicalBody: TipTapDocument | null | undefined;
}): Record<string, unknown> {
  const label = input.label.trim() || input.componentKey;
  const fromCanonical = contentFromDocOrEmpty(input.canonicalBody ?? null);
  const content =
    fromCanonical.length > 0 ? fromCanonical : [defaultPlaceholderParagraph("linked", label)];

  return {
    type: LIBRARY_NODE,
    attrs: {
      linkMode: "linked" satisfies InsertionMode,
      componentKey: input.componentKey,
      componentVersionId: input.componentVersionId,
      label,
      ...(input.componentName?.trim() ? { componentName: input.componentName.trim() } : {}),
    },
    content,
  };
}

/**
 * Replaces inner `content` of a linked library node from the canonical version body.
 * Detached nodes and non-library nodes are returned unchanged.
 */
export function refreshLinkedLibraryNodeFromCanonical(
  node: Record<string, unknown>,
  canonical: TipTapDocument | null | undefined,
): Record<string, unknown> {
  if (node.type !== LIBRARY_NODE) return node;
  const attrs = (node.attrs as Record<string, unknown> | undefined) ?? {};
  /** Detached blocks keep frozen `content` + `attrs.detachedSnapshot`; only linked nodes sync from the registry. */
  if (attrs.linkMode !== "linked") return node;
  const label =
    typeof attrs.label === "string" ? attrs.label : String(attrs.componentKey ?? "component");
  const fromCanonical = contentFromDocOrEmpty(canonical ?? null);
  const content =
    fromCanonical.length > 0 ? fromCanonical : [defaultPlaceholderParagraph("linked", label)];
  return { ...node, content };
}

export function buildDetachedLibraryNode(input: {
  componentKey: string;
  /** Version id at time of detach (provenance). */
  snapshotVersionId: string;
  label: string;
  componentName?: string | null;
  snapshotDoc: TipTapDocument;
}): Record<string, unknown> {
  const label = input.label.trim() || input.componentKey;
  const snap = deepCloneJson(input.snapshotDoc);
  const inner = contentFromDocOrEmpty(snap);
  const content = inner.length > 0 ? inner : [defaultPlaceholderParagraph("detached", label)];

  return {
    type: LIBRARY_NODE,
    attrs: {
      linkMode: "detached" satisfies InsertionMode,
      componentKey: input.componentKey,
      snapshotVersionId: input.snapshotVersionId,
      capturedAt: new Date().toISOString(),
      label,
      detachedSnapshot: snap,
      ...(input.componentName?.trim() ? { componentName: input.componentName.trim() } : {}),
    },
    content,
  };
}

function visitBlockNodes(node: Record<string, unknown>, visit: (n: Record<string, unknown>) => void): void {
  visit(node);
  const ch = node.content;
  if (!Array.isArray(ch)) return;
  for (const c of ch) {
    if (c && typeof c === "object" && !Array.isArray(c)) {
      visitBlockNodes(c as Record<string, unknown>, visit);
    }
  }
}

/**
 * Returns distinct `componentVersionId` values for linked library nodes in a TipTap document.
 */
export function collectLinkedComponentVersionIds(doc: unknown): string[] {
  const ids = new Set<string>();
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return [];
  const root = doc as Record<string, unknown>;
  if (root.type !== "doc") return [];
  visitBlockNodes(root, (n) => {
    if (n.type !== LIBRARY_NODE) return;
    const attrs = (n.attrs as Record<string, unknown> | undefined) ?? {};
    if (attrs.linkMode === "linked" && typeof attrs.componentVersionId === "string") {
      ids.add(attrs.componentVersionId);
    }
  });
  return [...ids];
}

/**
 * For each linked `commsLibraryComponent` node, replaces inner `content` from the canonical library body
 * for that `componentVersionId`. Detached nodes are unchanged.
 */
export function refreshLinkedNodesInDocument(
  doc: TipTapDocument,
  canonicalByVersionId: Map<string, TipTapDocument | null>,
): TipTapDocument {
  const cloned = deepCloneJson(doc) as TipTapDocument;
  const root = cloned as Record<string, unknown>;
  if (root.type !== "doc") return cloned;
  visitBlockNodes(root, (n) => {
    if (n.type !== LIBRARY_NODE) return;
    const attrs = (n.attrs as Record<string, unknown> | undefined) ?? {};
    if (attrs.linkMode !== "linked" || typeof attrs.componentVersionId !== "string") return;
    const canonical = canonicalByVersionId.get(attrs.componentVersionId);
    const refreshed = refreshLinkedLibraryNodeFromCanonical(n, canonical ?? undefined);
    Object.assign(n, refreshed);
  });
  return cloned;
}
