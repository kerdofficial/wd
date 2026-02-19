import { search } from "@inquirer/prompts";
import {
  loadCache,
  loadHistory,
  requireConfig,
  saveHistory,
} from "../config/manager";
import { rankByFrecency, timeAgo, getScoreMap } from "../core/frecency";
import { recordVisit } from "../core/frecency";
import type { ShellOutput } from "../utils/shell";
import type { ProjectEntry } from "../config/schema";
import { typeLabel, clearScreen } from "../ui/format";
import { pathExists } from "../utils/fs";
import { gracefulRun } from "../utils/prompt-wrapper";

function formatChoice(
  project: ProjectEntry,
  lastVisit: number | undefined
): { name: string; value: string; description: string } {
  const typeStr = typeLabel(project.type);
  const namePadded = project.name.padEnd(32);
  const typePadded = typeStr.padEnd(10);
  const ago = lastVisit ? timeAgo(lastVisit) : "";

  return {
    name: `${namePadded} ${typePadded} ${ago}`,
    value: project.path,
    description: project.path,
  };
}

export async function recent(shellOutput: ShellOutput): Promise<void> {
  await gracefulRun(() => _recent(shellOutput));
}

async function _recent(shellOutput: ShellOutput): Promise<void> {
  clearScreen();
  const config = await requireConfig();
  const history = await loadHistory();

  if (history.entries.length === 0) {
    console.log("No recent projects. Use `wd` to navigate to projects first.");
    return;
  }

  const cache = await loadCache();
  const allProjects = cache?.projects ?? [];

  // Build a map for last visit lookup
  const lastVisitMap = new Map<string, number>();
  for (const entry of history.entries) {
    const latest = Math.max(...entry.visits);
    lastVisitMap.set(entry.path, latest);
  }

  // Rank by frecency
  const ranked = rankByFrecency(allProjects, history);

  // Filter to only those with history
  const withHistory = ranked.filter((p) => lastVisitMap.has(p.path));
  const maxRecent = config.preferences.maxRecent;
  const top = withHistory.slice(0, maxRecent);

  if (top.length === 0) {
    console.log("No recent projects found in current cache. Run `wd scan` to refresh.");
    return;
  }

  const selectedPath = await search({
    message: "Recent projects",
    source: async (input) => {
      const choices = top.map((p) =>
        formatChoice(p, lastVisitMap.get(p.path))
      );
      if (!input?.trim()) return choices;
      const q = input.toLowerCase();
      return choices.filter((c) => c.name.toLowerCase().includes(q));
    },
    pageSize: Math.min(top.length, 15),
  });

  if (!(await pathExists(selectedPath))) {
    console.error(
      `\nProject path does not exist: ${selectedPath}\nRun 'wd scan' to refresh.`
    );
    process.exit(1);
  }

  const updatedHistory = recordVisit(history, selectedPath);
  await saveHistory(updatedHistory);

  shellOutput.cd(selectedPath);
  await shellOutput.flush();
}
