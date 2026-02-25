import { input, confirm, checkbox, select, number } from "@inquirer/prompts";
import {
  loadCache,
  loadWorkspace,
  requireConfig,
  saveCache,
  saveWorkspace,
  deleteWorkspace,
} from "../config/manager";
import { scanProjects } from "../core/scanner";
import { listAllContainers, isDockerAvailable } from "../core/docker";
import type {
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
  red,
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

export async function workspaceEdit(name: string): Promise<void> {
  await gracefulRun(() => _workspaceEdit(name));
}

async function _workspaceEdit(name: string): Promise<void> {
  const existing = await loadWorkspace(name);
  if (!existing) {
    console.error(`\n${red("✗")} Workspace not found: ${bold(name)}`);
    console.error(`  Run ${cyan("wd ws list")} to see available workspaces.\n`);
    process.exit(1);
  }

  clearScreen();
  printHeader();

  const config = await requireConfig();

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

  console.log(`${bold("Edit workspace")} ${bold(cyan(existing.name))}\n`);

  // Name (editable — rename handled on save)
  const newName = await input({
    message: "Workspace name:",
    default: existing.name,
    validate: async (v) => {
      if (!v.trim()) return "Name cannot be empty";
      if (!/^[a-z0-9-_]+$/i.test(v.trim()))
        return "Use only letters, numbers, hyphens, underscores";
      const duplicate = await loadWorkspace(v.trim());
      if (duplicate && v.trim() !== existing.name)
        return `Workspace "${v.trim()}" already exists`;
      return true;
    },
  });

  const description = await input({
    message: "Description (optional):",
    default: existing.description ?? "",
  });

  // Project selection — existing ones pre-checked
  console.log(`\n${gray("Select projects to include in this workspace:")}`);

  const existingPaths = new Set(existing.projects.map((p) => p.path));

  const selectedProjects: ProjectEntry[] = await checkbox<ProjectEntry>({
    message: "Select projects (Space to select, Enter to confirm):",
    choices: allProjects.map((p) => ({
      ...formatProjectChoice(p),
      checked: existingPaths.has(p.path),
    })),
    pageSize: 20,
    validate: (choices) => {
      if (choices.length === 0) return "Select at least one project";
      return true;
    },
  });

  if (selectedProjects.length === 0) {
    console.log(
      `\n${yellow("!")} No projects selected. Workspace not saved.\n`,
    );
    return;
  }

  for (const p of selectedProjects) {
    console.log(`  ${green("+")} ${p.name}`);
  }

  // Primary project — existing primary pre-selected
  const existingPrimary = existing.projects.find((p) => p.isPrimary);
  let primaryIndex = 0;

  if (selectedProjects.length > 1) {
    // Default to current primary if it's still in the selection, otherwise first
    const defaultPrimary =
      selectedProjects.find((p) => p.path === existingPrimary?.path)?.path ??
      selectedProjects[0]!.path;

    const primaryPath = await select<string>({
      message: "Which is the primary project (where wd will cd)?",
      default: defaultPrimary,
      choices: selectedProjects.map((p) => ({
        name: p.name,
        value: p.path,
      })),
    });
    primaryIndex = selectedProjects.findIndex((p) => p.path === primaryPath);
  }

  // Tab configuration — pre-fill from existing workspace
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

    const existingProject = existing.projects.find((ep) => ep.path === p.path);
    const existingTabs = existingProject?.tabs ?? [];
    const defaultTabCount = existingTabs.length > 0 ? existingTabs.length : 1;

    const tabCount = await number({
      message: `  How many tabs to open? (1 = just cd, 0 = skip)`,
      default: defaultTabCount,
      min: 0,
      max: 10,
    });

    const count = tabCount ?? defaultTabCount;
    const tabs: WorkspaceTab[] = [];

    for (let i = 0; i < count; i++) {
      const hint =
        isPrimary && i === 0 ? gray(" (this is your current shell)") : "";
      const existingCmd = existingTabs[i]?.command ?? "";
      const cmd = await input({
        message: `    Tab ${i + 1} command:${hint}`,
        default: existingCmd,
      });
      tabs.push({ command: cmd.trim() || undefined });
    }

    projectsWithTabs.push({
      path: p.path,
      isPrimary,
      tabs: tabs.length > 0 ? tabs : undefined,
    });
  }

  // Docker setup — pre-fill from existing workspace
  console.log(`\n${gray("Docker configuration (optional)")}`);

  const containerNames: string[] = [];
  let composeConfig: { path: string; file: string } | undefined =
    existing.docker?.compose;

  const dockerAvailable = await isDockerAvailable();

  if (dockerAvailable) {
    const hasExistingDocker =
      (existing.docker?.containers.length ?? 0) > 0 ||
      !!existing.docker?.compose;

    const setupDocker = await confirm({
      message: "Configure Docker containers for this workspace?",
      default: hasExistingDocker,
    });

    if (setupDocker) {
      const containers = await listAllContainers();

      if (containers.length > 0) {
        const existingContainerSet = new Set(existing.docker?.containers ?? []);
        const selected = await checkbox<string>({
          message: "Select containers to start when opening this workspace:",
          choices: containers.map((c) => ({
            name: `${c.name.padEnd(30)} ${c.image.padEnd(25)} [${c.state}]`,
            value: c.name,
            checked: existingContainerSet.has(c.name),
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
        message: "Configure a docker-compose file?",
        default: !!existing.docker?.compose,
      });

      if (useCompose) {
        const composeSuggestions: {
          label: string;
          path: string;
          file: string;
        }[] = [];

        // Add current compose config as first option (if set)
        if (existing.docker?.compose) {
          const c = existing.docker.compose;
          composeSuggestions.push({
            label: `${c.path.split("/").at(-1)} → ${c.file} (current)`,
            path: c.path,
            file: c.file,
          });
        }

        for (const p of selectedProjects) {
          if (p.docker?.composeFiles) {
            for (const f of p.docker.composeFiles) {
              const alreadyAdded = composeSuggestions.some(
                (s) => s.path === p.path && s.file === f,
              );
              if (!alreadyAdded) {
                composeSuggestions.push({
                  label: `${p.name} → ${f}`,
                  path: p.path,
                  file: f,
                });
              }
            }
          }
        }

        if (composeSuggestions.length > 0) {
          const chosen = await select<{ path: string; file: string } | null>({
            message: "Select a docker-compose file:",
            default: existing.docker?.compose ?? null,
            choices: [
              ...composeSuggestions.map((s) => ({
                name: s.label,
                value: { path: s.path, file: s.file },
              })),
              { name: "None / Enter manually", value: null },
            ],
          });

          composeConfig = chosen ?? undefined;
        }

        if (!composeConfig) {
          const composePath = await input({
            message: "Path to project with compose file:",
            default: existing.docker?.compose?.path ?? "",
          });
          const composeFile = await input({
            message: "Compose file name:",
            default: existing.docker?.compose?.file ?? "docker-compose.yml",
          });
          if (composePath.trim() && composeFile.trim()) {
            composeConfig = {
              path: composePath.trim(),
              file: composeFile.trim(),
            };
          }
        }
      } else {
        composeConfig = undefined;
      }
    }
  } else {
    console.log(gray("  (Docker not available, skipping)"));
  }

  // Save workspace (handle rename)
  const updatedWorkspace: Workspace = {
    version: 2,
    name: newName.trim(),
    description: description.trim() || undefined,
    projects: projectsWithTabs,
    docker:
      containerNames.length > 0 || composeConfig
        ? { containers: containerNames, compose: composeConfig }
        : undefined,
  };

  if (newName.trim() !== existing.name) {
    await deleteWorkspace(existing.name);
  }

  await saveWorkspace(updatedWorkspace);

  console.log(
    `\n${green("✓")} Workspace ${bold(cyan(updatedWorkspace.name))} saved!`,
  );
  if (newName.trim() !== existing.name) {
    console.log(`  ${gray(`(renamed from ${existing.name})`)}`);
  }
  console.log(
    `  Run ${cyan(`wd open ${updatedWorkspace.name}`)} to open it.\n`,
  );
}
