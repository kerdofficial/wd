#!/usr/bin/env bun
import { Command } from "commander";
import { ShellOutput } from "./utils/shell";

const program = new Command();

program
  .name("wd-bin")
  .description("Workspace Director — fast project navigation")
  .version("1.2.1")
  .option("--shell-out <path>", "internal: path to write shell commands");

// Default action: interactive project selector
program.action(async (options) => {
  const { select } = await import("./commands/select");
  const shellOut = new ShellOutput(options.shellOut as string | undefined);
  await select(shellOut);
});

// wd setup
program
  .command("setup")
  .description("Configure base directories to scan for projects")
  .action(async () => {
    const { setup } = await import("./commands/setup");
    await setup();
  });

// wd scan
program
  .command("scan")
  .description("Rescan all configured project directories")
  .action(async () => {
    const { scan } = await import("./commands/scan");
    await scan();
  });

// wd recent
program
  .command("recent")
  .description("Show recently visited projects (frecency-ranked)")
  .action(async (_, cmd) => {
    const { recent } = await import("./commands/recent");
    const shellOut = new ShellOutput(
      (cmd.parent as Command | undefined)?.opts().shellOut as
        | string
        | undefined,
    );
    await recent(shellOut);
  });

// wd open <name>
program
  .command("open <name>")
  .description(
    "Open a workspace: cd to primary project and start Docker containers",
  )
  .action(async (name: string, _, cmd) => {
    const { open } = await import("./commands/open");
    const shellOut = new ShellOutput(
      (cmd.parent as Command | undefined)?.opts().shellOut as
        | string
        | undefined,
    );
    await open(name, shellOut);
  });

// wd ws [new|list|delete]
const ws = program.command("ws").description("Manage workspace profiles");

ws.command("new")
  .description("Create a new workspace profile")
  .action(async () => {
    const { workspaceNew } = await import("./commands/workspace-new");
    await workspaceNew();
  });

ws.command("list")
  .description("List all saved workspaces")
  .action(async () => {
    const { workspaceList } = await import("./commands/workspace-list");
    await workspaceList();
  });

ws.command("edit <name>")
  .description("Edit an existing workspace profile")
  .action(async (name: string) => {
    const { workspaceEdit } = await import("./commands/workspace-edit");
    await workspaceEdit(name);
  });

ws.command("delete <name>")
  .description("Delete a workspace")
  .action(async (name: string) => {
    const { deleteWorkspace } = await import("./config/manager");
    const { bold, green, red, cyan } = await import("./ui/format");
    const deleted = await deleteWorkspace(name);
    if (deleted) {
      console.log(`${green("✓")} Workspace ${bold(cyan(name))} deleted.`);
    } else {
      console.error(`${red("✗")} Workspace not found: ${name}`);
      process.exit(1);
    }
  });

program.parse();
