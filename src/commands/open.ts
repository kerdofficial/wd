import { select } from "@inquirer/prompts";
import { loadWorkspace, loadHistory, saveHistory } from "../config/manager";
import {
  startContainers,
  startDockerCompose,
  isDockerAvailable,
  getContainerPorts,
  findPortConflict,
  stopContainer,
} from "../core/docker";
import { openWorkspaceTabs } from "../core/terminal";
import { recordVisit } from "../core/frecency";
import { gracefulRun } from "../utils/prompt-wrapper";
import type { ShellOutput } from "../utils/shell";
import { pathExists } from "../utils/fs";
import { bold, cyan, green, yellow, red, gray } from "../ui/format";

export async function open(name: string, shellOutput: ShellOutput): Promise<void> {
  await gracefulRun(() => _open(name, shellOutput));
}

async function _open(name: string, shellOutput: ShellOutput): Promise<void> {
  const workspace = await loadWorkspace(name);

  if (!workspace) {
    console.error(`\n${red("✗")} Workspace not found: ${bold(name)}`);
    console.error(`  Run ${cyan("wd ws list")} to see available workspaces.\n`);
    process.exit(1);
  }

  // Find primary project
  const primary = workspace.projects.find((p) => p.isPrimary);
  if (!primary) {
    console.error(`\n${red("✗")} No primary project set in workspace "${name}".`);
    process.exit(1);
  }

  // Validate primary path
  if (!(await pathExists(primary.path))) {
    console.error(`\n${red("✗")} Primary project path not found:`);
    console.error(`  ${primary.path}`);
    console.error(`\nThe drive may not be mounted. Run ${cyan("wd scan")} to refresh.\n`);
    process.exit(1);
  }

  console.log(`\n${bold(cyan(workspace.name))} ${workspace.description ? gray("— " + workspace.description) : ""}`);

  // Handle Docker
  if (workspace.docker) {
    const dockerAvailable = await isDockerAvailable();

    if (!dockerAvailable) {
      console.log(`  ${yellow("!")} Docker is not running. Start OrbStack first to use Docker containers.`);
    } else {
      // Start named containers with port conflict detection
      if (workspace.docker.containers.length > 0) {
        process.stdout.write(
          `  ${gray("🐳")} Starting containers: ${workspace.docker.containers.join(", ")}...`
        );
        const result = await startContainers(workspace.docker.containers);
        if (result.success) {
          process.stdout.write(` ${green("✓")}\n`);
        } else {
          process.stdout.write(` ${yellow("!")}\n`);
          if (result.started.length > 0) {
            console.log(`     Started: ${result.started.join(", ")}`);
          }

          // Handle failed containers with port conflict detection
          if (result.failed.length > 0) {
            for (const failedName of result.failed) {
              await handleFailedContainer(failedName);
            }
          }
        }
      }

      // Start docker-compose
      if (workspace.docker.compose) {
        const { path: composePath, file: composeFile } = workspace.docker.compose;
        const projectName = composePath.split("/").at(-1) ?? composePath;
        process.stdout.write(
          `  ${gray("🐳")} docker compose up (${projectName}/${composeFile})...`
        );
        const result = await startDockerCompose(composePath, composeFile);
        if (result.success) {
          process.stdout.write(` ${green("✓")}\n`);
        } else {
          process.stdout.write(` ${yellow("!")}\n`);
          if (result.error) {
            console.log(`     ${gray(result.error)}`);
          }
        }
      }
    }
  }

  // Record visit
  const history = await loadHistory();
  const updatedHistory = recordVisit(history, primary.path);
  await saveHistory(updatedHistory);

  const primaryName = primary.path.split("/").at(-1) ?? primary.path;
  console.log(`  ${green("✓")} cd → ${bold(primaryName)}`);

  // Open terminal tabs for all projects
  if (workspace.projects.some((p) => p.tabs && p.tabs.length > 0)) {
    console.log(`  ${gray("⇥")} Opening tabs...`);
    await openWorkspaceTabs(workspace.projects);
  }

  console.log();

  // Output cd command (always)
  shellOutput.cd(primary.path);

  // Run the first tab's command in the current shell (if any)
  const primaryFirstTabCommand = primary.tabs?.[0]?.command;
  if (primaryFirstTabCommand) {
    shellOutput.run(primaryFirstTabCommand);
  }

  await shellOutput.flush();
}

/**
 * Attempt to detect and resolve a port conflict for a failed container.
 */
async function handleFailedContainer(failedName: string): Promise<void> {
  // Get the host ports this container wants to bind (from HostConfig.PortBindings)
  const hostPorts = await getContainerPorts(failedName);

  // Find conflicting containers
  const conflicts: Array<{ blocker: string; port: string }> = [];
  for (const port of hostPorts) {
    const blocker = await findPortConflict(port);
    if (blocker && blocker !== failedName) {
      conflicts.push({ blocker, port });
    }
  }

  if (conflicts.length > 0) {
    // Report conflict
    const blockerNames = [...new Set(conflicts.map((c) => c.blocker))];
    const ports = [...new Set(conflicts.map((c) => c.port))];
    console.log(
      `     ${yellow("!")} ${bold(failedName)} failed: port ${ports.join(", ")} already in use by ${blockerNames.join(", ")}`
    );

    // Offer to stop blocker and retry
    for (const blocker of blockerNames) {
      let action: string;
      try {
        action = await select({
          message: `     What to do?`,
          choices: [
            { name: `Stop ${blocker} and retry ${failedName}`, value: "stop" },
            { name: "Skip", value: "skip" },
          ],
        });
      } catch {
        action = "skip";
      }

      if (action === "stop") {
        process.stdout.write(`     Stopping ${blocker}...`);
        const stopped = await stopContainer(blocker);
        if (stopped) {
          process.stdout.write(` ${green("✓")}\n`);
          process.stdout.write(`     Starting ${failedName}...`);
          const retryResult = await startContainers([failedName]);
          if (retryResult.success) {
            process.stdout.write(` ${green("✓")}\n`);
          } else {
            process.stdout.write(` ${red("✗")}\n`);
          }
        } else {
          process.stdout.write(` ${red("✗")}\n`);
        }
      }
    }
  } else {
    // No port conflict detected, just report failure
    console.log(`     ${red("✗")} ${bold(failedName)} failed to start`);
  }
}
