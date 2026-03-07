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
import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DirectorySearchResult {
  path: string;
  isNew: boolean;  // true if the path was manually typed and didn't exist
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
  maxEntries = 500
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
            if (depth < maxDepth) {
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

function fuzzyFilter(dirs: string[], term: string): NormalizedChoice[] {
  if (!term.trim()) {
    return dirs.slice(0, 200).map((d) => ({
      value: d,
      name: d,
      short: d,
      description: basename(d),
    }));
  }
  const lower = term.toLowerCase();
  return dirs
    .filter((d) => d.toLowerCase().includes(lower))
    .slice(0, 100)
    .map((d) => ({
      value: d,
      name: d,
      short: d,
    }));
}

// ─── @ mode: scan root chips ──────────────────────────────────────────────────

function buildAtChoices(
  scanRoots: ScanRoot[],
  term: string
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

    const [status, setStatus] = useState<"loading" | "idle" | "done">("loading");
    const [searchTerm, setSearchTerm] = useState(config.defaultPath ?? "");
    const [allDirs, setAllDirs] = useState<string[]>([]);
    const [choices, setChoices] = useState<NormalizedChoice[]>([]);

    const prefix = usePrefix({ status, theme });

    // Load all directories once
    useEffect(() => {
      let cancelled = false;
      scanDirectories(scanRoots).then((dirs) => {
        if (!cancelled) {
          setAllDirs(dirs);
          setChoices(fuzzyFilter(dirs, searchTerm));
          setStatus("idle");
        }
      });
      return () => { cancelled = true; };
    }, []);

    // Re-filter on search term change
    useEffect(() => {
      if (status === "loading") return;
      const term = searchTerm;
      if (term.startsWith("@")) {
        setChoices(buildAtChoices(scanRoots, term));
      } else {
        setChoices(fuzzyFilter(allDirs, term));
      }
    }, [searchTerm]);

    const bounds = useMemo(() => {
      const first = choices.findIndex((c) => !c.disabled);
      const last = choices.findLastIndex((c) => !c.disabled);
      return { first, last };
    }, [choices]);

    const [active = bounds.first, setActive] = useState<number | undefined>(undefined);

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
        rl.clearLine(0);
        rl.write(searchTerm);
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
            i === (active ?? 0) ? colors.cyan(`[${l}]`) : colors.dim(l)
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
        if ((item as { separator?: boolean }).separator) return ` ${(item as { separator: string }).separator}`;
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
  }
);
