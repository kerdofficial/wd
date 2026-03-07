import {
  input,
  confirm,
  search,
  checkbox,
  select,
  number,
} from "@inquirer/prompts";
import {
  loadCache,
  loadWorkspace,
  requireConfig,
  saveCache,
  saveWorkspace,
} from "../config/manager";
import { scanProjects } from "../core/scanner";
import { filterAndRank } from "../core/fuzzy";
import { listAllContainers, isDockerAvailable } from "../core/docker";
import { isValidWorkspaceName } from "../core/workspace-names";
import type {
  Cache,
  ProjectEntry,
  WorkspaceProject,
  WorkspaceTab,
  Workspace,
} from "../config/schema";
import {
  typeLabel,
  bold,
  cyan,
  green,
  yellow,
  gray,
  clearScreen,
  printHeader,
} from "../ui/format";
import { gracefulRun } from "../utils/prompt-wrapper";

function formatProjectChoice(project: ProjectEntry): {
  name: string;
  value: ProjectEntry;
  description: string;
} {
  const typeStr = typeLabel(project.type);
  const location = project.label
    ? `${project.label} / ${project.parentDir}`
    : project.parentDir;
  return {
    name: `${project.name.padEnd(32)} ${typeStr.padEnd(10)} ${location}`,
    value: project,
    description: project.path,
  };
}

export async function workspaceNew(): Promise<void> {
  await gracefulRun(_workspaceNew);
}

async function _workspaceNew(): Promise<void> {
  clearScreen();
  printHeader();

  const config = await requireConfig();

  // Load/refresh cache
  let cache = await import("../config/manager").then((m) => m.loadCache());
  if (!cache) {
    console.log("Scanning projects...");
    const projects = await scanProjects(config.scanRoots, {
      ignore: config.preferences.scanIgnore,
    });
    cache = { version: 1, lastScan: new Date().toISOString(), projects };
    await saveCache(cache);
  }

  const allProjects = cache.projects;

  console.log(`${bold("Create a new workspace")}\n`);

  // Workspace name
  const name = await input({
    message: "Workspace name:",
    validate: async (v) => {
      if (!v.trim()) return "Name cannot be empty";
      if (!isValidWorkspaceName(v))
        return "Use only lowercase letters, numbers, hyphens, underscores";
      const existing = await loadWorkspace(v.trim());
      if (existing) return `Workspace "${v.trim()}" already exists`;
      return true;
    },
  });

  const description = await input({
    message: "Description (optional):",
  });

  // Select projects — checkbox multi-select
  console.log(`\n${gray("Select projects to include in this workspace:")}`);

  const selectedProjects: ProjectEntry[] = await checkbox<ProjectEntry>({
    message: "Select projects (Space to select, Enter to confirm):",
    choices: allProjects.map((p) => formatProjectChoice(p)),
    pageSize: 20,
    validate: (choices) => {
      if (choices.length === 0) return "Select at least one project";
      return true;
    },
  });

  if (selectedProjects.length === 0) {
    console.log(
      `\n${yellow("!")} No projects selected. Workspace not created.\n`,
    );
    return;
  }

  for (const p of selectedProjects) {
    console.log(`  ${green("+")} ${p.name}`);
  }

  // Choose primary project
  let primaryIndex = 0;
  if (selectedProjects.length > 1) {
    const primaryPath = await select<string>({
      message: "Which is the primary project (where wd will cd)?",
      choices: selectedProjects.map((p) => ({
        name: p.name,
        value: p.path,
      })),
    });
    primaryIndex = selectedProjects.findIndex((p) => p.path === primaryPath);
  }

  // Tab configuration per project
  console.log(
    `\n${gray("Tab configuration (what opens when you run wd open):")}`,
  );

  const projectsWithTabs: WorkspaceProject[] = [];

  for (const p of selectedProjects) {
    const isPrimary = selectedProjects.indexOf(p) === primaryIndex;
    const label = isPrimary
      ? `${bold(p.name)} ${cyan("(primary)")}`
      : bold(p.name);
    console.log(`\n  ${label}  ${gray(p.path)}`);

    const tabCount = await number({
      message: `  How many tabs to open? (1 = just cd, 0 = skip)`,
      default: isPrimary ? 1 : 1,
      min: 0,
      max: 10,
    });

    const count = tabCount ?? (isPrimary ? 1 : 1);
    const tabs: WorkspaceTab[] = [];

    for (let i = 0; i < count; i++) {
      const isFirst = i === 0;
      const hint =
        isPrimary && isFirst ? gray(" (this is your current shell)") : "";
      const cmd = await input({
        message: `    Tab ${i + 1} command:${hint}`,
      });
      tabs.push({ command: cmd.trim() || undefined });
    }

    projectsWithTabs.push({
      path: p.path,
      isPrimary,
      tabs: tabs.length > 0 ? tabs : undefined,
    });
  }

  // Docker setup
  console.log(`\n${gray("Docker configuration (optional)")}`);

  const containerNames: string[] = [];
  let composeConfig: { path: string; file: string } | undefined;

  const dockerAvailable = await isDockerAvailable();

  if (dockerAvailable) {
    const setupDocker = await confirm({
      message: "Configure Docker containers for this workspace?",
      default: false,
    });

    if (setupDocker) {
      const containers = await listAllContainers();

      if (containers.length > 0) {
        const selected = await checkbox<string>({
          message: "Select containers to start when opening this workspace:",
          choices: containers.map((c) => ({
            name: `${c.name.padEnd(30)} ${c.image.padEnd(25)} [${c.state}]`,
            value: c.name,
            checked: false,
          })),
          pageSize: 15,
        });
        containerNames.push(...selected);

        if (containerNames.length > 0) {
          console.log(
            `  ${green("+")} ${containerNames.length} container${containerNames.length !== 1 ? "s" : ""} selected`,
          );
        }
      } else {
        console.log(
          `  ${yellow("!")} No Docker containers found. Start OrbStack/Docker Desktop and run containers first.`,
        );
      }

      const useCompose = await confirm({
        message: "Also configure a docker-compose file?",
        default: false,
      });

      if (useCompose) {
        const composeSuggestions: {
          label: string;
          path: string;
          file: string;
        }[] = [];
        for (const p of selectedProjects) {
          if (p.docker?.composeFiles) {
            for (const f of p.docker.composeFiles) {
              composeSuggestions.push({
                label: `${p.name} → ${f}`,
                path: p.path,
                file: f,
              });
            }
          }
        }

        if (composeSuggestions.length > 0) {
          const chosen = await select<{ path: string; file: string } | null>({
            message: "Select a docker-compose file:",
            choices: [
              ...composeSuggestions.map((s) => ({
                name: s.label,
                value: { path: s.path, file: s.file },
              })),
              { name: "None / Enter manually", value: null },
            ],
          });

          if (chosen) {
            composeConfig = chosen;
          }
        }

        if (!composeConfig) {
          const composePath = await input({
            message: "Path to project with compose file:",
          });
          const composeFile = await input({
            message: "Compose file name:",
            default: "docker-compose.yml",
          });
          if (composePath.trim() && composeFile.trim()) {
            composeConfig = {
              path: composePath.trim(),
              file: composeFile.trim(),
            };
          }
        }
      }
    }
  } else {
    console.log(gray("  (Docker not available, skipping)"));
  }

  // Build workspace
  const workspace: Workspace = {
    version: 2,
    name: name.trim(),
    description: description.trim() || undefined,
    projects: projectsWithTabs,
    docker:
      containerNames.length > 0 || composeConfig
        ? {
            containers: containerNames,
            compose: composeConfig,
          }
        : undefined,
  };

  await saveWorkspace(workspace);

  console.log(
    `\n${green("✓")} Workspace ${bold(cyan(workspace.name))} created!`,
  );
  console.log(`  Run ${cyan(`wd open ${workspace.name}`)} to open it.\n`);
}
