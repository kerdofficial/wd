import { input } from "@inquirer/prompts";
import { loadWorkspace, saveWorkspace } from "../config/manager";
import { workspaceEdit } from "./workspace-edit";
import { actionSelect, isEscape } from "../ui/action-select";
import type { Workspace } from "../config/schema";
import { bold, cyan, green, red, clearScreen, printHeader } from "../ui/format";
import { gracefulRun } from "../utils/prompt-wrapper";
import {
  isValidWorkspaceName,
  normalizeWorkspaceName,
} from "../core/workspace-names";

async function generateDuplicateName(baseName: string): Promise<string> {
  const strippedBase = normalizeWorkspaceName(baseName)
    .replace(/-duplicate-\d+$/, "")
    .replace(/-duplicate$/, "");
  const candidate = `${strippedBase}-duplicate`;
  if (!(await loadWorkspace(candidate))) return candidate;
  let i = 2;
  while (await loadWorkspace(`${candidate}-${i}`)) i++;
  return `${candidate}-${i}`;
}

export async function workspaceDuplicate(name: string): Promise<void> {
  await gracefulRun(() => _workspaceDuplicate(name));
}

async function _workspaceDuplicate(name: string): Promise<void> {
  const original = await loadWorkspace(name);
  if (!original) {
    console.error(`\n${red("✗")} Workspace not found: ${bold(name)}`);
    console.error(`  Run ${cyan("wd ws list")} to see available workspaces.\n`);
    process.exit(1);
  }

  const defaultName = await generateDuplicateName(name);

  clearScreen();
  printHeader();

  console.log(`${bold("Duplicate workspace")} ${bold(cyan(name))}\n`);

  const newName = await input({
    message: "New workspace name:",
    default: defaultName,
    validate: async (v) => {
      if (!v.trim()) return "Name cannot be empty";
      if (!isValidWorkspaceName(v))
        return "Use only lowercase letters, numbers, hyphens, underscores";
      const existing = await loadWorkspace(v.trim());
      if (existing) return `Workspace "${v.trim()}" already exists`;
      return true;
    },
  });

  const result = await actionSelect({
    message: `Duplicate "${name}" as "${newName.trim()}"?`,
    choices: [
      { name: "Save & Exit", value: "save" },
      { name: "Edit Workspace", value: "edit" },
      { name: "Cancel", value: "cancel" },
    ],
  });

  if (isEscape(result) || result === "cancel") {
    console.log(`\n${cyan("!")} Duplicate cancelled.\n`);
    return;
  }

  const duplicated: Workspace = { ...original, name: newName.trim() };
  await saveWorkspace(duplicated);

  if (result === "save") {
    console.log(
      `\n${green("✓")} Workspace ${bold(cyan(duplicated.name))} created!\n`,
    );
  } else if (result === "edit") {
    await workspaceEdit(duplicated.name);
  }
}
