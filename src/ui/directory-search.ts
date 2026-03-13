/**
 * Custom directory picker prompt with @ tag autocomplete for scan roots.
 *
 * Normal mode: filterable list of directories under scan roots (up to maxDepth)
 * @ mode: when input starts with "@", fuzzy-match scan root labels for quick jump
 * Tab: autocomplete selected @ chip
 * Enter: accept path
 */
import {
  createPrompt,
  useState,
  useKeypress,
  usePrefix,
  usePagination,
  useEffect,
  useMemo,
  isDownKey,
  isEnterKey,
  isTabKey,
  isUpKey,
  Separator,
  makeTheme,
  type KeypressEvent,
} from "@inquirer/core";
import colors from "yoctocolors-cjs";
import figures from "@inquirer/figures";
import type { ScanRoot } from "../config/schema";
import { fuzzyMatch } from "../core/fuzzy";
import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DirectorySearchResult {
  path: string;
  isNew: boolean; // true if the path was manually typed and didn't exist
}

type Choice = {
  value: string;
  name: string;
  description?: string;
  disabled?: boolean | string;
};

type NormalizedChoice = Choice & { short: string };

interface DirectorySearchConfig {
  message: string;
  scanRoots: ScanRoot[];
  pageSize?: number;
  defaultPath?: string;
  excludedPaths?: Set<string>;
}

// ─── Theme ────────────────────────────────────────────────────────────────────

const dirTheme = {
  icon: { cursor: figures.pointer },
  style: {
    disabled: (text: string) => colors.dim(`- ${text}`),
    searchTerm: (text: string) => colors.cyan(text),
    description: (text: string) => colors.cyan(text),
    keysHelpTip: (keys: [key: string, action: string][]) =>
      keys
        .map(([key, action]) => `${colors.bold(key)} ${colors.dim(action)}`)
        .join(colors.dim(" • ")),
  },
  helpMode: "always" as const,
};

// ─── Directory scanning ───────────────────────────────────────────────────────

async function scanDirectories(
  scanRoots: ScanRoot[],
  excludedPaths: Set<string>,
  maxEntries = 2000,
): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string, depth: number, maxDepth: number) {
    if (results.length >= maxEntries) return;
    try {
      const entries = await readdir(dir);
      for (const entry of entries) {
        if (results.length >= maxEntries) return;
        if (entry.startsWith(".")) continue;
        const full = join(dir, entry);
        try {
          const info = await stat(full);
          if (info.isDirectory()) {
            results.push(full);
            // Don't recurse into known project directories
            if (!excludedPaths.has(full) && depth < maxDepth) {
              await walk(full, depth + 1, maxDepth);
            }
          }
        } catch {
          // skip inaccessible
        }
      }
    } catch {
      // skip inaccessible root
    }
  }

  for (const root of scanRoots) {
    results.push(root.path);
    await walk(root.path, 1, root.maxDepth ?? 3);
  }

  return results;
}

// ─── Fuzzy filter ─────────────────────────────────────────────────────────────

function dirToChoice(d: string): NormalizedChoice {
  return { value: d, name: d, short: d, description: basename(d) };
}

function fuzzyFilter(
  dirs: string[],
  term: string,
  scanRoots: ScanRoot[],
): NormalizedChoice[] {
  if (!term.trim()) {
    return dirs.slice(0, 200).map(dirToChoice);
  }
  // Absolute path: prefix + fuzzy on the trailing segment
  if (term.startsWith("/")) {
    // Find the last '/' to split into parent prefix and partial name
    const lastSlash = term.lastIndexOf("/");
    const parentPrefix = term.slice(0, lastSlash); // e.g. "/a/b/test-folder"
    const partial = term.slice(lastSlash + 1); // e.g. "ex" or ""

    // Candidates: dirs under parentPrefix (or equal to it)
    const candidates = dirs.filter(
      (d) => d === parentPrefix || d.startsWith(parentPrefix + "/"),
    );

    if (!partial) {
      // Trailing slash or exact path — show the dir itself + direct children
      return candidates.slice(0, 100).map(dirToChoice);
    }

    // Fuzzy match the partial against the tail after parentPrefix
    const scored: { dir: string; score: number }[] = [];
    for (const d of candidates) {
      const tail = d.slice(parentPrefix.length + 1); // e.g. "test-project" or "wd"
      if (!tail) continue; // skip the parent itself
      const s = fuzzyMatch(partial, tail);
      if (s !== null) scored.push({ dir: d, score: s });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 100).map(({ dir }) => dirToChoice(dir));
  }
  const scored: { dir: string; score: number }[] = [];
  for (const d of dirs) {
    // Match against basename (most relevant for short queries)
    const baseScore = fuzzyMatch(term, basename(d));
    // Match against path relative to scan root (avoids /Volumes/... false positives)
    let relScore: number | null = null;
    for (const root of scanRoots) {
      if (d.startsWith(root.path + "/")) {
        relScore = fuzzyMatch(term, d.slice(root.path.length + 1));
        break;
      }
    }
    const best = Math.max(baseScore ?? -Infinity, relScore ?? -Infinity);
    if (best > -Infinity) {
      scored.push({ dir: d, score: best });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 100).map(({ dir }) => dirToChoice(dir));
}

// ─── @ mode: scan root chips ──────────────────────────────────────────────────

function buildAtChoices(
  scanRoots: ScanRoot[],
  term: string,
): NormalizedChoice[] {
  const query = term.slice(1).toLowerCase();
  return scanRoots
    .filter((r) => {
      const label = (r.label ?? basename(r.path)).toLowerCase();
      return !query || label.includes(query);
    })
    .map((r) => ({
      value: r.path,
      name: `@${r.label ?? basename(r.path)}  ${colors.dim(r.path)}`,
      short: r.path,
      description: r.path,
    }));
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

export default createPrompt<DirectorySearchResult, DirectorySearchConfig>(
  (config, done) => {
    const { pageSize = 10, scanRoots } = config;
    const theme = makeTheme(dirTheme, undefined);

    const [status, setStatus] = useState<"loading" | "idle" | "done">(
      "loading",
    );
    const [searchTerm, setSearchTerm] = useState(config.defaultPath ?? "");
    const [allDirs, setAllDirs] = useState<string[]>([]);

    const prefix = usePrefix({ status, theme });

    // Load all directories once
    useEffect(() => {
      let cancelled = false;
      scanDirectories(scanRoots, config.excludedPaths ?? new Set()).then(
        (dirs) => {
          if (!cancelled) {
            setAllDirs(dirs);
            setStatus("idle");
          }
        },
      );
      return () => {
        cancelled = true;
      };
    }, []);

    // Choices computed synchronously during render — always in sync with searchTerm
    const choices = useMemo<NormalizedChoice[]>(() => {
      if (status === "loading" || allDirs.length === 0) return [];
      if (searchTerm.startsWith("@"))
        return buildAtChoices(scanRoots, searchTerm);
      return fuzzyFilter(allDirs, searchTerm, scanRoots);
    }, [allDirs, searchTerm, status]);

    const bounds = useMemo(() => {
      const first = choices.findIndex((c) => !c.disabled);
      const last = choices.findLastIndex((c) => !c.disabled);
      return { first, last };
    }, [choices]);

    const [active = bounds.first, setActive] = useState<number | undefined>(
      undefined,
    );

    const selectedChoice = active !== undefined ? choices[active] : undefined;

    useKeypress((_key: KeypressEvent, rl) => {
      const key = _key;

      // Enter: accept path
      if (isEnterKey(key)) {
        const path = selectedChoice?.value ?? searchTerm;
        if (path) {
          setStatus("done");
          done({ path, isNew: !allDirs.includes(path) });
        }
        return;
      }

      // Tab: autocomplete with selected item
      if (isTabKey(key) && selectedChoice) {
        // If in @ mode and selected a root, switch to that root path
        const newTerm = selectedChoice.value;
        rl.clearLine(0);
        rl.write(newTerm);
        setSearchTerm(newTerm);
        setActive(undefined);
        return;
      }

      // Up/Down navigation
      if (status !== "loading" && (isUpKey(key) || isDownKey(key))) {
        if (
          (isUpKey(key) && active !== bounds.first) ||
          (isDownKey(key) && active !== bounds.last)
        ) {
          const offset = isUpKey(key) ? -1 : 1;
          let next = active ?? 0;
          const max = choices.length;
          let tries = 0;
          do {
            next = (next + offset + max) % max;
            tries++;
          } while (choices[next]?.disabled && tries < max);
          setActive(next);
        }
        return;
      }

      // Left/Right in @ mode: cycle through root chips
      if (
        searchTerm.startsWith("@") &&
        (key.name === "left" || key.name === "right")
      ) {
        const roots = buildAtChoices(scanRoots, searchTerm);
        if (roots.length === 0) return;
        const cur = active ?? 0;
        const offset = key.name === "right" ? 1 : -1;
        const next = (cur + offset + roots.length) % roots.length;
        setActive(next);
        return;
      }

      // Any other key: update search term
      setSearchTerm(rl.line);
      setActive(undefined);
    });

    // ─── Render ───────────────────────────────────────────────────────────────

    const message = theme.style.message(config.message, status);

    const helpParts: [string, string][] = [
      ["↑↓", "navigate"],
      ["⏎", "select"],
      ["tab", "autocomplete"],
    ];
    if (searchTerm.startsWith("@")) {
      helpParts.push(["←→", "cycle roots"]);
    }
    const helpLine = theme.style.keysHelpTip(helpParts);

    if (status === "done" && selectedChoice) {
      return [prefix, message, theme.style.answer(selectedChoice.short)]
        .filter(Boolean)
        .join(" ")
        .trimEnd();
    }

    const searchStr = theme.style.searchTerm(searchTerm);
    const header = [prefix, message, searchStr]
      .filter(Boolean)
      .join(" ")
      .trimEnd();

    // @ mode hint: show root chips inline
    let atHint = "";
    if (searchTerm.startsWith("@")) {
      const roots = scanRoots.map((r) => {
        const label = `@${r.label ?? basename(r.path)}`;
        return label;
      });
      atHint =
        colors.dim("  Roots: ") +
        roots
          .map((l, i) =>
            i === (active ?? 0) ? colors.cyan(`[${l}]`) : colors.dim(l),
          )
          .join("  ");
    }

    const page = usePagination({
      items: choices,
      active: active ?? bounds.first,
      renderItem({
        item,
        isActive,
      }: {
        item: NormalizedChoice;
        isActive: boolean;
      }) {
        if ((item as { separator?: boolean }).separator)
          return ` ${(item as unknown as { separator: string }).separator}`;
        if (item.disabled) {
          const label =
            typeof item.disabled === "string" ? item.disabled : "(disabled)";
          return colors.dim(`- ${item.name} ${label}`);
        }
        const color = isActive ? theme.style.highlight : (x: string) => x;
        const cursor = isActive ? theme.icon.cursor : " ";
        return color(`${cursor} ${item.name}`);
      },
      pageSize,
      loop: false,
    });

    const body = [
      atHint,
      choices.length === 0 && status === "idle"
        ? colors.dim("  No directories found. Type a path manually.")
        : page,
      " ",
      helpLine,
    ]
      .filter(Boolean)
      .join("\n")
      .trimEnd();

    return [header, body];
  },
);
