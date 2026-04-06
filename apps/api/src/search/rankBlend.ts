import { TITLE_EMBEDDING_DIMS } from "@comms-lib/db-elasticsearch";

export interface RankBlendWeights {
  keyword: number;
  vector: number;
  recency: number;
  engagement: number;
}

const DEFAULT_WEIGHTS: RankBlendWeights = {
  keyword: 0.45,
  vector: 0.25,
  recency: 0.2,
  engagement: 0.1,
};

function parseFloatEnv(name: string, fallback: number): number {
  const v = process.env[name]?.trim();
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getDefaultRankBlendWeights(): RankBlendWeights {
  return {
    keyword: parseFloatEnv("SEARCH_RANK_WEIGHT_KEYWORD", DEFAULT_WEIGHTS.keyword),
    vector: parseFloatEnv("SEARCH_RANK_WEIGHT_VECTOR", DEFAULT_WEIGHTS.vector),
    recency: parseFloatEnv("SEARCH_RANK_WEIGHT_RECENCY", DEFAULT_WEIGHTS.recency),
    engagement: parseFloatEnv("SEARCH_RANK_WEIGHT_ENGAGEMENT", DEFAULT_WEIGHTS.engagement),
  };
}

export function normalizeRankBlendWeights(w: Partial<RankBlendWeights> | undefined): RankBlendWeights {
  const base = getDefaultRankBlendWeights();
  const merged: RankBlendWeights = {
    keyword: w?.keyword ?? base.keyword,
    vector: w?.vector ?? base.vector,
    recency: w?.recency ?? base.recency,
    engagement: w?.engagement ?? base.engagement,
  };
  const sum =
    merged.keyword + merged.vector + merged.recency + merged.engagement || 1;
  return {
    keyword: merged.keyword / sum,
    vector: merged.vector / sum,
    recency: merged.recency / sum,
    engagement: merged.engagement / sum,
  };
}

/** Reciprocal-rank contribution (higher is better). */
export function rrfScore(rankIndex: number, k = 60): number {
  return 1 / (k + rankIndex + 1);
}

export function recencyScore(updatedAtIso: string | undefined, nowMs: number, halfLifeDays: number): number {
  if (!updatedAtIso) return 0;
  const t = new Date(updatedAtIso).getTime();
  if (!Number.isFinite(t)) return 0;
  const ageMs = Math.max(0, nowMs - t);
  const half = Math.max(1, halfLifeDays) * 86400000;
  return Math.exp(-ageMs / half);
}

export function engagementNorm(score: number | undefined): number {
  const s = score ?? 0;
  return Math.min(1, Math.log1p(Math.max(0, s)) / 5);
}

export function normalizeEsScores(scores: number[]): Map<number, number> {
  const m = new Map<number, number>();
  if (scores.length === 0) return m;
  let min = scores[0];
  let max = scores[0];
  for (const x of scores) {
    if (x < min) min = x;
    if (x > max) max = x;
  }
  const span = max - min || 1;
  scores.forEach((x, i) => m.set(i, (x - min) / span));
  return m;
}

export function assertValidQueryVector(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length !== TITLE_EMBEDDING_DIMS) return null;
  const out: number[] = new Array(TITLE_EMBEDDING_DIMS);
  for (let i = 0; i < TITLE_EMBEDDING_DIMS; i++) {
    const n = Number((v as unknown[])[i]);
    if (!Number.isFinite(n)) return null;
    out[i] = n;
  }
  return out;
}
