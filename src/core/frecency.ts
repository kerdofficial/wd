import type { History, ProjectEntry } from "../config/schema";

const DECAY_BUCKETS = [
  { maxAge: 4 * 60 * 60 * 1000, weight: 100 }, // Last 4 hours
  { maxAge: 24 * 60 * 60 * 1000, weight: 80 }, // Last day
  { maxAge: 3 * 24 * 60 * 60 * 1000, weight: 60 }, // Last 3 days
  { maxAge: 7 * 24 * 60 * 60 * 1000, weight: 40 }, // Last week
  { maxAge: 14 * 24 * 60 * 60 * 1000, weight: 20 }, // Last 2 weeks
  { maxAge: 30 * 24 * 60 * 60 * 1000, weight: 10 }, // Last month
] as const;

const ANCIENT_WEIGHT = 2;
const MAX_VISITS_PER_ENTRY = 50;
const PRUNE_OLDER_THAN = 90 * 24 * 60 * 60 * 1000; // 90 days

export function calculateFrecencyScore(
  visits: number[],
  now: number = Date.now()
): number {
  let score = 0;
  for (const timestamp of visits) {
    const age = now - timestamp;
    const bucket = DECAY_BUCKETS.find((b) => age <= b.maxAge);
    score += bucket ? bucket.weight : ANCIENT_WEIGHT;
  }
  return score;
}

export function recordVisit(history: History, projectPath: string): History {
  const now = Date.now();
  const cutoff = now - PRUNE_OLDER_THAN;

  const existing = history.entries.find((e) => e.path === projectPath);
  if (existing) {
    existing.visits.unshift(now);
    existing.visits = existing.visits
      .filter((t) => t > cutoff)
      .slice(0, MAX_VISITS_PER_ENTRY);
  } else {
    history.entries.push({ path: projectPath, visits: [now] });
  }

  // Prune all entries
  for (const entry of history.entries) {
    entry.visits = entry.visits.filter((t) => t > cutoff);
  }
  history.entries = history.entries.filter((e) => e.visits.length > 0);

  return history;
}

export function rankByFrecency(
  projects: ProjectEntry[],
  history: History
): ProjectEntry[] {
  const now = Date.now();
  const scoreMap = new Map<string, number>();
  for (const entry of history.entries) {
    scoreMap.set(entry.path, calculateFrecencyScore(entry.visits, now));
  }

  return [...projects].sort((a, b) => {
    const scoreA = scoreMap.get(a.path) ?? 0;
    const scoreB = scoreMap.get(b.path) ?? 0;
    return scoreB - scoreA;
  });
}

export function getScoreMap(history: History): Map<string, number> {
  const now = Date.now();
  const map = new Map<string, number>();
  for (const entry of history.entries) {
    map.set(entry.path, calculateFrecencyScore(entry.visits, now));
  }
  return map;
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}
