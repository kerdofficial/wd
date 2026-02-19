import { describe, expect, test } from "bun:test";
import {
  calculateFrecencyScore,
  recordVisit,
  rankByFrecency,
  timeAgo,
} from "../frecency";
import type { History, ProjectEntry } from "../../config/schema";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// ─── calculateFrecencyScore ─────────────────────────────────────────────────

describe("calculateFrecencyScore", () => {
  const now = 1_000_000_000_000;

  test("no visits returns 0", () => {
    expect(calculateFrecencyScore([], now)).toBe(0);
  });

  test("visit within 4 hours scores 100", () => {
    const visits = [now - 1 * HOUR];
    expect(calculateFrecencyScore(visits, now)).toBe(100);
  });

  test("visit within 24 hours scores 80", () => {
    const visits = [now - 12 * HOUR];
    expect(calculateFrecencyScore(visits, now)).toBe(80);
  });

  test("visit within 3 days scores 60", () => {
    const visits = [now - 2 * DAY];
    expect(calculateFrecencyScore(visits, now)).toBe(60);
  });

  test("visit within 7 days scores 40", () => {
    const visits = [now - 5 * DAY];
    expect(calculateFrecencyScore(visits, now)).toBe(40);
  });

  test("visit within 14 days scores 20", () => {
    const visits = [now - 10 * DAY];
    expect(calculateFrecencyScore(visits, now)).toBe(20);
  });

  test("visit within 30 days scores 10", () => {
    const visits = [now - 20 * DAY];
    expect(calculateFrecencyScore(visits, now)).toBe(10);
  });

  test("visit older than 30 days scores 2", () => {
    const visits = [now - 60 * DAY];
    expect(calculateFrecencyScore(visits, now)).toBe(2);
  });

  test("multiple visits sum their scores", () => {
    const visits = [
      now - 1 * HOUR,   // 100
      now - 12 * HOUR,  // 80
      now - 5 * DAY,    // 40
    ];
    expect(calculateFrecencyScore(visits, now)).toBe(220);
  });

  test("frequent recent use scores much higher than single old visit", () => {
    const frequentRecent = [now - 1 * HOUR, now - 2 * HOUR, now - 3 * HOUR];
    const singleOld = [now - 60 * DAY];
    expect(calculateFrecencyScore(frequentRecent, now)).toBeGreaterThan(
      calculateFrecencyScore(singleOld, now)
    );
  });
});

// ─── recordVisit ────────────────────────────────────────────────────────────

describe("recordVisit", () => {
  test("adds new entry for first visit", () => {
    const history: History = { version: 1, entries: [] };
    const result = recordVisit(history, "/path/to/project");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].path).toBe("/path/to/project");
    expect(result.entries[0].visits).toHaveLength(1);
  });

  test("prepends visit to existing entry", () => {
    const oldVisit = Date.now() - 1000;
    const history: History = {
      version: 1,
      entries: [{ path: "/project", visits: [oldVisit] }],
    };
    const result = recordVisit(history, "/project");
    expect(result.entries[0].visits).toHaveLength(2);
    expect(result.entries[0].visits[0]).toBeGreaterThan(oldVisit);
  });

  test("prunes visits older than 90 days", () => {
    const ancient = Date.now() - 91 * DAY;
    const history: History = {
      version: 1,
      entries: [{ path: "/project", visits: [ancient] }],
    };
    const result = recordVisit(history, "/project");
    // The ancient visit should be pruned, only the new one remains
    expect(result.entries[0].visits).toHaveLength(1);
    expect(result.entries[0].visits[0]).toBeGreaterThan(ancient);
  });

  test("caps visits at 50 per entry", () => {
    const visits = Array.from({ length: 55 }, (_, i) => Date.now() - i * HOUR);
    const history: History = {
      version: 1,
      entries: [{ path: "/project", visits }],
    };
    const result = recordVisit(history, "/project");
    expect(result.entries[0].visits.length).toBeLessThanOrEqual(50);
  });

  test("removes entries with no remaining visits after prune", () => {
    const ancient = Date.now() - 91 * DAY;
    const history: History = {
      version: 1,
      entries: [
        { path: "/old-project", visits: [ancient] },
        { path: "/active", visits: [Date.now() - 1000] },
      ],
    };
    const result = recordVisit(history, "/active");
    expect(result.entries.find((e) => e.path === "/old-project")).toBeUndefined();
  });
});

// ─── rankByFrecency ─────────────────────────────────────────────────────────

describe("rankByFrecency", () => {
  const makeProject = (name: string, path: string): ProjectEntry => ({
    name,
    path,
    type: "node",
    hasGit: true,
    parentDir: "test",
  });

  test("projects with history rank above those without", () => {
    const projects = [
      makeProject("never-visited", "/a"),
      makeProject("visited", "/b"),
    ];
    const history: History = {
      version: 1,
      entries: [{ path: "/b", visits: [Date.now()] }],
    };
    const ranked = rankByFrecency(projects, history);
    expect(ranked[0].name).toBe("visited");
  });

  test("more recent visits rank higher", () => {
    const now = Date.now();
    const projects = [
      makeProject("old", "/old"),
      makeProject("recent", "/recent"),
    ];
    const history: History = {
      version: 1,
      entries: [
        { path: "/old", visits: [now - 30 * DAY] },
        { path: "/recent", visits: [now - 1 * HOUR] },
      ],
    };
    const ranked = rankByFrecency(projects, history);
    expect(ranked[0].name).toBe("recent");
  });

  test("does not mutate original array", () => {
    const projects = [
      makeProject("b", "/b"),
      makeProject("a", "/a"),
    ];
    const original = [...projects];
    const history: History = {
      version: 1,
      entries: [{ path: "/a", visits: [Date.now()] }],
    };
    rankByFrecency(projects, history);
    expect(projects[0].name).toBe(original[0].name);
  });
});

// ─── timeAgo ────────────────────────────────────────────────────────────────

describe("timeAgo", () => {
  test("just now for <1 minute", () => {
    expect(timeAgo(Date.now() - 30_000)).toBe("just now");
  });

  test("minutes ago", () => {
    expect(timeAgo(Date.now() - 5 * 60_000)).toBe("5m ago");
  });

  test("hours ago", () => {
    expect(timeAgo(Date.now() - 3 * 3_600_000)).toBe("3h ago");
  });

  test("yesterday", () => {
    expect(timeAgo(Date.now() - 1 * 86_400_000)).toBe("yesterday");
  });

  test("days ago", () => {
    expect(timeAgo(Date.now() - 5 * 86_400_000)).toBe("5d ago");
  });
});
