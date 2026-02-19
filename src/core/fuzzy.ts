import type { ProjectEntry } from "../config/schema";
import type { History } from "../config/schema";
import { rankByFrecency } from "./frecency";

/**
 * Fuzzy match: checks if all chars of query appear in order in target.
 * Returns a score (higher = better) or null if no match.
 */
export function fuzzyMatch(query: string, target: string): number | null {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (q === "") return 0;

  let qi = 0;
  let score = 0;
  let prevMatchIdx = -2;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1;

      // Bonus for consecutive match
      if (ti === prevMatchIdx + 1) score += 5;

      // Bonus for match at word boundary
      if (
        ti === 0 ||
        t[ti - 1] === "-" ||
        t[ti - 1] === "_" ||
        t[ti - 1] === "/" ||
        t[ti - 1] === " "
      ) {
        score += 10;
      }

      prevMatchIdx = ti;
      qi++;
    }
  }

  if (qi < q.length) return null; // Not all chars matched

  // Preference for shorter strings
  score -= t.length * 0.1;
  return score;
}

export interface FuzzyResult {
  item: ProjectEntry;
  score: number;
}

export function filterAndRank(
  projects: ProjectEntry[],
  query: string,
  history?: History
): FuzzyResult[] {
  const trimmed = query.trim();

  if (!trimmed) {
    // No query: frecency-ranked
    const ranked = history ? rankByFrecency(projects, history) : projects;
    return ranked.map((item) => ({ item, score: 0 }));
  }

  const results: FuzzyResult[] = [];

  for (const project of projects) {
    const targets = [
      project.name,
      `${project.parentDir}/${project.name}`,
      project.type,
    ];

    let bestScore: number | null = null;
    for (const target of targets) {
      const s = fuzzyMatch(trimmed, target);
      if (s !== null && (bestScore === null || s > bestScore)) {
        bestScore = s;
      }
    }

    if (bestScore !== null) {
      results.push({ item: project, score: bestScore });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
