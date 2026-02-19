import { describe, expect, test } from "bun:test";
import { fuzzyMatch, filterAndRank } from "../fuzzy";
import type { ProjectEntry, History } from "../../config/schema";

// ─── fuzzyMatch ─────────────────────────────────────────────────────────────

describe("fuzzyMatch", () => {
  test("empty query returns 0", () => {
    expect(fuzzyMatch("", "anything")).toBe(0);
  });

  test("exact match scores high", () => {
    const score = fuzzyMatch("next", "next");
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThan(0);
  });

  test("returns null when not all chars match", () => {
    expect(fuzzyMatch("xyz", "abc")).toBeNull();
  });

  test("returns null when chars are out of order", () => {
    expect(fuzzyMatch("ba", "abc")).toBeNull();
  });

  test("case insensitive", () => {
    expect(fuzzyMatch("NEXT", "next-app")).not.toBeNull();
    expect(fuzzyMatch("next", "NEXT-APP")).not.toBeNull();
  });

  test("subsequence match works", () => {
    // m...a...w in my-app-web
    expect(fuzzyMatch("maw", "my-app-web")).not.toBeNull();
  });

  test("word boundary bonus: matches after - score higher", () => {
    const boundaryScore = fuzzyMatch("a", "my-app")!;
    const midScore = fuzzyMatch("a", "xxaxx")!;
    expect(boundaryScore).toBeGreaterThan(midScore);
  });

  test("consecutive match bonus", () => {
    const consecutiveScore = fuzzyMatch("ab", "abc")!;
    const spreadScore = fuzzyMatch("ab", "axbx")!;
    expect(consecutiveScore).toBeGreaterThan(spreadScore);
  });

  test("shorter targets preferred over longer ones at equal match", () => {
    const shortScore = fuzzyMatch("app", "app")!;
    const longScore = fuzzyMatch("app", "app-very-long-name")!;
    expect(shortScore).toBeGreaterThan(longScore);
  });

  test("start of string gets word boundary bonus", () => {
    // First char is always a word boundary (ti === 0)
    const startScore = fuzzyMatch("a", "abc")!;
    const midScore = fuzzyMatch("b", "abc")!;
    expect(startScore).toBeGreaterThan(midScore);
  });
});

// ─── filterAndRank ──────────────────────────────────────────────────────────

const makeProject = (name: string, type = "node", parentDir = "Projects"): ProjectEntry => ({
  name,
  path: `/home/user/${parentDir}/${name}`,
  type,
  hasGit: true,
  parentDir,
});

describe("filterAndRank", () => {
  const projects = [
    makeProject("my-app-web", "nextjs"),
    makeProject("my-app-api", "nestjs"),
    makeProject("blog-site", "nextjs"),
    makeProject("rust-tool", "rust"),
  ];

  test("empty query returns all projects", () => {
    const results = filterAndRank(projects, "");
    expect(results).toHaveLength(projects.length);
  });

  test("whitespace-only query returns all projects", () => {
    const results = filterAndRank(projects, "   ");
    expect(results).toHaveLength(projects.length);
  });

  test("filters to matching projects only", () => {
    const results = filterAndRank(projects, "blog");
    expect(results).toHaveLength(1);
    expect(results[0].item.name).toBe("blog-site");
  });

  test("no matches returns empty", () => {
    const results = filterAndRank(projects, "zzzzz");
    expect(results).toHaveLength(0);
  });

  test("matches against project type", () => {
    const results = filterAndRank(projects, "rust");
    expect(results.some((r) => r.item.name === "rust-tool")).toBe(true);
  });

  test("matches against parentDir/name", () => {
    const projects = [makeProject("web", "node", "my-app")];
    const results = filterAndRank(projects, "my-app/web");
    expect(results).toHaveLength(1);
  });

  test("results are sorted by score descending", () => {
    const results = filterAndRank(projects, "my");
    expect(results.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  test("empty query with history uses frecency ranking", () => {
    const now = Date.now();
    const history: History = {
      version: 1,
      entries: [
        { path: projects[2].path, visits: [now] },          // blog-site: recent
        { path: projects[0].path, visits: [now - 86400000 * 30] }, // my-app-web: old
      ],
    };
    const results = filterAndRank(projects, "", history);
    expect(results[0].item.name).toBe("blog-site");
  });
});
