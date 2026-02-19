import { search } from "@inquirer/prompts";
import {
  loadCache,
  loadHistory,
  requireConfig,
  saveCache,
  saveHistory,
  isCacheStale,
} from "../config/manager";
import { scanProjects } from "../core/scanner";
import { filterAndRank } from "../core/fuzzy";
import { recordVisit } from "../core/frecency";
import type { ShellOutput } from "../utils/shell";
import type { Cache, ProjectEntry } from "../config/schema";
import { typeLabel, registerCustomTypes, clearScreen } from "../ui/format";
import { pathExists } from "../utils/fs";
import { gracefulRun } from "../utils/prompt-wrapper";

function formatChoice(project: ProjectEntry): { name: string; value: string; description: string } {
  const typeStr = typeLabel(project.type);
  const locationStr = project.label
    ? `${project.label} / ${project.parentDir}`
    : project.parentDir;

  const namePadded = project.name.padEnd(32);
  const typePadded = typeStr.padEnd(10);

  return {
    name: `${namePadded} ${typePadded} ${locationStr}`,
    value: project.path,
    description: project.path,
  };
}

export async function select(shellOutput: ShellOutput): Promise<void> {
  await gracefulRun(() => _select(shellOutput));
}

async function _select(shellOutput: ShellOutput): Promise<void> {
  clearScreen();
  const config = await requireConfig();

  registerCustomTypes(config.customTypes);

  let cache = await loadCache();

  // Auto-rescan if cache is missing or stale
  if (!cache || isCacheStale(cache)) {
    const projects = await scanProjects(config.scanRoots, {
      ignore: config.preferences.scanIgnore,
      customTypes: config.customTypes,
    });
    cache = {
      version: 1,
      lastScan: new Date().toISOString(),
      projects,
    };
    await saveCache(cache);
  }

  const history = await loadHistory();
  const allProjects = cache.projects;

  const selectedPath = await search({
    message: "Select a project",
    source: async (input) => {
      const results = filterAndRank(allProjects, input ?? "", history);
      return results.map((r) => formatChoice(r.item));
    },
    pageSize: 15,
  });

  // Validate the path still exists
  if (!(await pathExists(selectedPath))) {
    console.error(
      `\nProject path does not exist: ${selectedPath}\nThe drive may not be mounted. Run 'wd scan' to refresh.`
    );
    process.exit(1);
  }

  // Record visit
  const updatedHistory = recordVisit(history, selectedPath);
  await saveHistory(updatedHistory);

  // Output cd command
  shellOutput.cd(selectedPath);
  await shellOutput.flush();
}
