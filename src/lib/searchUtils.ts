/**
 * Smart Search & Typo Suggestion Utility
 * State 6: No Search Results -> Fix the typo for them and suggest a next search
 */

/**
 * Calculates Levenshtein distance between two strings
 */
export function getLevenshteinDistance(a: string, b: string): number {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  const m = s1.length;
  const n = s2.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Find closest matching keyword from dataset when search yields 0 results
 */
export function findTypoSuggestion(query: string, candidates: string[]): string | null {
  const cleanQ = query.trim().toLowerCase();
  if (cleanQ.length < 2 || candidates.length === 0) return null;

  // Extract individual words from candidates
  const wordSet = new Set<string>();
  for (const c of candidates) {
    if (!c) continue;
    // Add full candidate
    wordSet.add(c.trim());
    // Add individual words
    const tokens = c.split(/[\s,./\-_]+/);
    for (const t of tokens) {
      if (t.length >= 3) wordSet.add(t);
    }
  }

  let bestMatch: string | null = null;
  let minDistance = Infinity;

  for (const candidate of wordSet) {
    const cleanC = candidate.toLowerCase();
    if (cleanC === cleanQ) continue; // exact match already failed

    // If query is an anagram or prefix/contains
    if (cleanC.startsWith(cleanQ) || cleanQ.startsWith(cleanC)) {
      return candidate;
    }

    const dist = getLevenshteinDistance(cleanQ, cleanC);
    // Allow up to 2 typos for short words, 3 for longer words
    const maxAllowedDist = cleanQ.length <= 4 ? 1 : cleanQ.length <= 7 ? 2 : 3;

    if (dist <= maxAllowedDist && dist < minDistance) {
      minDistance = dist;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

