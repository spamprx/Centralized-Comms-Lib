export type WordDiffPart = { type: 'equal' | 'insert' | 'delete'; text: string };

function tokenizeWords(s: string): string[] {
  const tokens = s.match(/\S+|\s+/g);
  return tokens && tokens.length > 0 ? tokens : s ? [s] : [];
}

function mergeParts(parts: WordDiffPart[]): WordDiffPart[] {
  const out: WordDiffPart[] = [];
  for (const p of parts) {
    const prev = out[out.length - 1];
    if (prev && prev.type === p.type) prev.text += p.text;
    else out.push({ ...p });
  }
  return out;
}

/**
 * Longest-common-subsequence backtrack on word tokens. Bounded work for large docs.
 */
export function diffWords(a: string, b: string): WordDiffPart[] {
  const A = tokenizeWords(a);
  const B = tokenizeWords(b);
  const n = A.length;
  const m = B.length;
  const MAX_CELLS = 1_200_000;

  if (n === 0 && m === 0) return [];
  if (n === 0) return [{ type: 'insert', text: B.join('') }];
  if (m === 0) return [{ type: 'delete', text: A.join('') }];
  if (n * m > MAX_CELLS) {
    if (a === b) return [{ type: 'equal', text: a }];
    return [
      { type: 'delete', text: a },
      { type: 'insert', text: b },
    ];
  }

  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 1; i <= n; i++) {
    const Ai = A[i - 1]!;
    const row = dp[i]!;
    const prev = dp[i - 1]!;
    for (let j = 1; j <= m; j++) {
      if (Ai === B[j - 1]) row[j] = prev[j - 1] + 1;
      else row[j] = prev[j] > row[j - 1] ? prev[j] : row[j - 1];
    }
  }

  const raw: WordDiffPart[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && A[i - 1] === B[j - 1]) {
      raw.push({ type: 'equal', text: A[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      raw.push({ type: 'insert', text: B[j - 1]! });
      j--;
    } else if (i > 0) {
      raw.push({ type: 'delete', text: A[i - 1]! });
      i--;
    } else {
      raw.push({ type: 'insert', text: B[j - 1]! });
      j--;
    }
  }

  raw.reverse();
  return mergeParts(raw);
}
