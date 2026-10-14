// Viewer scoring (spec § Live mode). Shown on the waiting screen as:
// vote +10 · call the reveal right +100 · fast right answer up to +150.

export const VOTE_POINTS = 10;
export const PREDICT_POINTS = 100;
export const TEXT_POINTS = 100;
export const ARTIST_BONUS = 50;
export const TEXT_DOUBLE_FIRST = 10;

/** 50 for being right, plus up to 100 more for speed. */
export function quizPoints(elapsedMs: number, durationSeconds: number): number {
  const frac = Math.max(0, 1 - elapsedMs / (Math.max(5, durationSeconds) * 1000));
  return 50 + Math.round(100 * frac);
}

/** Lowercase, strip accents/punctuation and a leading "the". */
export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/^the\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Forgiving match: exact after normalising, or one typo on longer answers. */
export function answerMatches(given: string, expected: string): boolean {
  const a = normalizeAnswer(given);
  const b = normalizeAnswer(expected);
  if (!a || !b) return false;
  if (a === b || a.replace(/\s/g, "") === b.replace(/\s/g, "")) return true;
  return b.length >= 5 && levenshtein(a, b) <= 1;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}
