import {
  listWorkspaces,
  loadWorkspace,
  deleteWorkspace,
} from "../config/manager";
import { printWorkspaceInfo } from "./workspace-list";
import { actionSelect, isEscape } from "../ui/action-select";
import { open } from "./open";
import { workspaceEdit } from "./workspace-edit";
import { workspaceDuplicate } from "./workspace-duplicate";
import { gracefulRun } from "../utils/prompt-wrapper";
import type { ShellOutput } from "../utils/shell";
import type { Workspace } from "../config/schema";
import { bold, cyan, gray, red, green, clearScreen, printHeader } from "../ui/format";

function buildWorkspaceChoiceName(ws: Workspace): string {
  const lines: string[] = [];
  lines.push(bold(cyan(ws.name)));
  if (ws.description) {
    lines.push(`  ${gray(ws.description)}`);
  }
  for (const p of ws.projects) {
    const name = p.path.split("/").at(-1) ?? p.path;
    const tag = p.isPrimary ? green(" (primary)") : "";
    lines.push(`  ${gray("→")} ${name}${tag}`);
  }
  if (ws.docker) {
    if (ws.docker.containers.length > 0) {
      lines.push(`  ${gray("🐳")} Containers: ${ws.docker.containers.join(", ")}`);
    }
    if (ws.docker.compose) {
      lines.push(`  ${gray("🐳")} Compose: ${ws.docker.compose.file} ${gray("in")} ${ws.docker.compose.path.split("/").at(-1)}`);
    }
  }
  return lines.join("\n") + "\n";
}

export async function workspaceSelect(shellOutput: ShellOutput): Promise<void> {
  await gracefulRun(() => _workspaceSelect(shellOutput));
}

async function _workspaceSelect(shellOutput: ShellOutput): Promise<void> {
  let running = true;

  while (running) {
    clearScreen();
    printHeader();

    const workspaces = await listWorkspaces();

    if (workspaces.length === 0) {
      console.log(
        `\nNo workspaces configured. Run ${cyan("wd ws new")} to create one.\n`
      );
      return;
    }

    const choices = [
      ...workspaces.map((ws) => ({ name: buildWorkspaceChoiceName(ws), value: ws.name })),
      { name: "Back", value: "back" },
    ];

    const result = await actionSelect({
      message: "Select a workspace",
      choices,
      shortcut: {
        key: "o",
        value: "quick-open",
        label: "open directly",
        includeChoice: true,
      },
    });

    if (isEscape(result) || result === "back") {
      running = false;
    } else if (result.startsWith("quick-open:")) {
      const name = result.slice("quick-open:".length);
      await open(name, shellOutput);
      return;
    } else {
      const shouldExit = await showWorkspaceDetail(result, shellOutput);
      if (shouldExit) return;
    }
  }
}

/**
 * Returns true if the caller should exit entirely (workspace was opened),
 * false if we should return to the workspace list.
 */
async function showWorkspaceDetail(
  name: string,
  shellOutput: ShellOutput
): Promise<boolean> {
  let running = true;

  while (running) {
    clearScreen();
    printHeader();

    const ws = await loadWorkspace(name);
    if (!ws) {
      console.log(`\n${red("✗")} Workspace not found: ${bold(name)}\n`);
      return false;
    }

    console.log();
    printWorkspaceInfo(ws);

    const result = await actionSelect({
      message: ws.name,
      choices: [
        { name: "Open", value: "open" },
        { name: "Edit", value: "edit" },
        { name: "Duplicate", value: "duplicate" },
        { name: "Delete", value: "delete" },
        { name: "Back", value: "back" },
      ],
    });

    if (isEscape(result) || result === "back") {
      running = false;
    } else if (result === "open") {
      await open(name, shellOutput);
      return true;
    } else if (result === "duplicate") {
      await workspaceDuplicate(name);
      // After duplicate, loop back to detail view
    } else if (result === "edit") {
      await workspaceEdit(name);
      // After edit the name might have changed — reload from disk by rescanning
      // Simplest: reload the workspace with same name; if renamed, it won't be found
      // and we'll gracefully fall back to list. workspaceEdit handles its own clearScreen.
    } else if (result === "delete") {
      const confirmed = await confirmDelete(name);
      if (confirmed) {
        await deleteWorkspace(name);
        console.log(`\n${green("✓")} Workspace ${bold(cyan(name))} deleted.\n`);
        return false;
      }
    }
  }

  return false;
}

async function confirmDelete(name: string): Promise<boolean> {
  clearScreen();
  printHeader();
  console.log(`\n${red("Delete workspace")} ${bold(cyan(name))}\n`);

  const result = await actionSelect({
    message: `Delete "${name}"?`,
    choices: [
      { name: "Yes, delete", value: "yes" },
      { name: "Cancel", value: "cancel" },
    ],
  });

  return result === "yes";
}
