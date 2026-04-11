import { diffWords } from "diff";

import type { ContentSnapshotRecord, ContentVersion } from "../../repository";
import { tiptapToPlainText } from "../../search/tiptapPlainText";

export type WordDiffOp = "equal" | "insert" | "delete";

export interface WordDiffSegment {
  op: WordDiffOp;
  text: string;
  wordCount: number;
}

export interface SnapshotSideSummary {
  snapshotId: string;
  toVersionNumber: number;
  resolvedFromVersionNumber: number | null;
  title: string;
  plainTextLength: number;
}

export interface SnapshotWordDiffResult {
  granularity: "word";
  contentId: string;
  left: SnapshotSideSummary;
  right: SnapshotSideSummary;
  stats: {
    equalWords: number;
    insertWords: number;
    deleteWords: number;
  };
  segments: WordDiffSegment[];
}

function countWords(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function snapshotPlainDocument(version: ContentVersion | null): { title: string; plain: string } {
  const title = version?.title ?? "";
  const bodyPlain = version?.body ? tiptapToPlainText(version.body) : "";
  const plain = [title.trim(), bodyPlain].filter(Boolean).join("\n\n");
  return { title, plain };
}

export function buildPlainTextForSnapshotSide(
  version: ContentVersion | null,
): { title: string; plain: string; resolvedFromVersionNumber: number | null } {
  if (!version) {
    return { title: "", plain: "", resolvedFromVersionNumber: null };
  }
  const { title, plain } = snapshotPlainDocument(version);
  return { title, plain, resolvedFromVersionNumber: version.versionNumber };
}

export function computeWordDiff(leftPlain: string, rightPlain: string): Omit<SnapshotWordDiffResult, "contentId" | "left" | "right"> {
  const parts = diffWords(leftPlain, rightPlain);
  const segments: WordDiffSegment[] = [];
  let equalWords = 0;
  let insertWords = 0;
  let deleteWords = 0;

  for (const p of parts) {
    if (!p.value) continue;
    if (p.added) {
      const wc = countWords(p.value);
      insertWords += wc;
      segments.push({ op: "insert", text: p.value, wordCount: wc });
    } else if (p.removed) {
      const wc = countWords(p.value);
      deleteWords += wc;
      segments.push({ op: "delete", text: p.value, wordCount: wc });
    } else {
      const wc = countWords(p.value);
      equalWords += wc;
      segments.push({ op: "equal", text: p.value, wordCount: wc });
    }
  }

  return {
    granularity: "word",
    stats: { equalWords, insertWords, deleteWords },
    segments,
  };
}

export function sideSummary(
  snap: ContentSnapshotRecord,
  version: ContentVersion | null,
): SnapshotSideSummary {
  const { title, plain, resolvedFromVersionNumber } = buildPlainTextForSnapshotSide(version);
  return {
    snapshotId: snap.id,
    toVersionNumber: snap.toVersionNumber,
    resolvedFromVersionNumber,
    title,
    plainTextLength: plain.length,
  };
}
