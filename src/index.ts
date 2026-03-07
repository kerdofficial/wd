#!/usr/bin/env bun
import { Command } from "commander";
import {
  getRootExtraArgs,
  getWorkspaceSubcommands,
  getWorkspaceTailArgs,
} from "./core/cli-routing";
import { ShellOutput } from "./utils/shell";

const program = new Command();

program
  .name("wd-bin")
  .description("Workspace Director — fast project navigation")
  .version("1.3.0")
  .option("--shell-out <path>", "internal: path to write shell commands")
  .allowUnknownOption()
  .allowExcessArguments(true);

// Default action: interactive project selector.
// Any extra arguments mean the user mistyped a command — show a helpful error.
program.action(async (options) => {
  const shellOut = new ShellOutput(options.shellOut as string | undefined);
  const extraArgs = getRootExtraArgs(process.argv);

  if (extraArgs.length > 0) {
    console.error(`\nUnknown command: ${extraArgs.join(" ")}`);
    console.error(`\nAvailable commands:`);
    console.error(`  wd                  — interactive project selector`);
    console.error(`  wd new <name>       — create a new project from a template`);
    console.error(`  wd ws               — manage workspace profiles`);
    console.error(`  wd open <name>      — open a workspace`);
    console.error(`  wd scan             — rescan project directories`);
    console.error(`  wd recent           — recently visited projects`);
    console.error(`  wd setup            — configure wd`);
    console.error(`  wd config           — manage settings`);
    process.exit(1);
  }

  const { select } = await import("./commands/select");
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

// wd config
program
  .command("config")
  .description("Manage wd configuration")
  .action(async () => {
    const { config } = await import("./commands/config");
    await config();
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

// wd new [app-name]
program
  .command("new [app-name]")
  .description("Create a new project from a template")
  .allowUnknownOption()
  .allowExcessArguments(true)
  .action(async (_, __, cmd) => {
    const { newProject } = await import("./commands/new");
    const parentCmd = cmd.parent as typeof program | undefined;
    const shellOut = new ShellOutput(
      parentCmd?.opts().shellOut as string | undefined,
    );
    await newProject(shellOut);
  });

// wd ws [new|list|delete]
const ws = program.command("ws").description("Manage workspace profiles");

ws.action(async (_, cmd) => {
  const tailArgs = getWorkspaceTailArgs(process.argv);
  if (tailArgs.length > 0) {
    console.error(`\nUnknown workspace command: ${tailArgs.join(" ")}`);
    console.error(`\nAvailable workspace commands:`);
    for (const subcommand of getWorkspaceSubcommands()) {
      console.error(`  wd ws ${subcommand}`);
    }
    process.exit(1);
  }

  const { workspaceSelect } = await import("./commands/workspace-select");
  const shellOut = new ShellOutput(
    (cmd.parent as Command | undefined)?.opts().shellOut as string | undefined,
  );
  await workspaceSelect(shellOut);
});

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

ws.command("duplicate <name>")
  .description("Duplicate an existing workspace")
  .action(async (name: string) => {
    const { workspaceDuplicate } =
      await import("./commands/workspace-duplicate");
    await workspaceDuplicate(name);
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
