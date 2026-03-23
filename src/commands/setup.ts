import { select, confirm, number } from "@inquirer/prompts";
import { mkdir } from "node:fs/promises";
import { loadConfig, saveConfig, initConfigDir } from "../config/manager";
import { scanProjects } from "../core/scanner";
import { saveCache } from "../config/manager";
import type { Cache, Config } from "../config/schema";
import {
  bold,
  green,
  yellow,
  gray,
  cyan,
  Spinner,
  printHeader,
  clearScreen,
} from "../ui/format";
import { gracefulRun } from "../utils/prompt-wrapper";
import { paths } from "../config/paths";
import { existsSync } from "node:fs";
import { addScanRoot } from "../utils/scan-root-prompt";
import type { ShellAdapter } from "../adapters/shell/adapter";
import { resolveTerminal } from "../adapters/platform";

async function installShellScript(shell: ShellAdapter): Promise<string> {
  const content = shell.generateWrapper("wd-bin");
  const destPath = paths.shellScriptFor(shell.integrationFileName());
  await Bun.write(destPath, content);
  return destPath;
}

export async function setup(shell: ShellAdapter): Promise<void> {
  await gracefulRun(() => _setup(shell));
}

async function _setup(shell: ShellAdapter): Promise<void> {
  clearScreen();
  printHeader();

  await initConfigDir();

  let config: Config = (await loadConfig()) ?? {
    version: 1,
    configVersion: 0,
    scanRoots: [],
    customTypes: [],
    projectConstructor: { templates: { gistUrl: "" } },
    preferences: {
      showProjectType: true,
      showCategory: true,
      maxRecent: 20,
      scanIgnore: [
        "node_modules",
        ".git",
        "dist",
        "build",
        ".next",
        ".angular",
        "target",
        ".dart_tool",
        "Pods",
        ".build",
        "DerivedData",
        ".cache",
      ],
    },
  };

  // Show current roots if any
  if (config.scanRoots.length > 0) {
    console.log("Current scan roots:");
    config.scanRoots.forEach((r, i) => {
      console.log(
        `  ${gray(String(i + 1) + ".")} ${r.label ?? r.path}  ${gray(r.path)}`,
      );
    });
    console.log();
  }

  // Main setup loop
  let running = true;
  while (running) {
    const action = await select({
      message: "What would you like to do?",
      choices: [
        { name: "Add scan root", value: "add" },
        ...(config.scanRoots.length > 0
          ? [{ name: "Remove scan root", value: "remove" }]
          : []),
        { name: "Done", value: "done" },
      ],
    });

    if (action === "add") {
      const root = await addScanRoot(config.scanRoots);
      if (root) {
        config.scanRoots.push(root);
        console.log(`  ${green("✓")} Added: ${root.label} (${root.path})`);
      }
    } else if (action === "remove") {
      const toRemove = await select({
        message: "Which root to remove?",
        choices: config.scanRoots.map((r, i) => ({
          name: `${r.label ?? r.path}  ${gray(r.path)}`,
          value: i,
        })),
      });
      config.scanRoots.splice(toRemove, 1);
      console.log(`  ${yellow("✓")} Removed`);
    } else {
      running = false;
    }
  }

  if (config.scanRoots.length === 0) {
    console.log(
      `\n${yellow("!")} No scan roots configured. Run "wd setup" again to add directories.\n`,
    );
    await saveConfig(config);
    return;
  }

  await saveConfig(config);

  // Install shell script
  let shellScriptPath = "";
  try {
    shellScriptPath = await installShellScript(shell);
    console.log(
      `\n${green("✓")} Shell integration installed: ${gray(shellScriptPath)}`,
    );
  } catch {
    console.log(`\n${yellow("!")} Could not copy shell script automatically.`);
  }

  // Run initial scan
  const doScan = await confirm({
    message: "Scan projects now?",
    default: true,
  });

  if (doScan) {
    console.log();
    const spinner = new Spinner("Scanning projects...");
    spinner.start();

    const projects = await scanProjects(config.scanRoots, {
      ignore: config.preferences.scanIgnore,
      customTypes: config.customTypes,
      onProgress: (n) => spinner.update(`Scanning... (${n} found)`),
    });

    const cache: Cache = {
      version: 1,
      lastScan: new Date().toISOString(),
      projects,
    };
    await saveCache(cache);

    spinner.stop(
      `${green("✓")} Found ${bold(String(projects.length))} projects`,
    );
  }

  // Init templates directory with example template
  try {
    await mkdir(paths.templatesDir, { recursive: true });
    const examplePath = paths.template("example");
    if (!existsSync(examplePath)) {
      const exampleTemplate = {
        id: "example-hidden",
        hidden: true,
        name: "Example Template",
        description: "Example template — set hidden: false to show in wd new",
        variants: [
          {
            type: "default",
            name: "Default",
            command:
              "echo 'Creating {PROJECT_NAME} with {PACKAGE_MANAGER.command}'",
            supportedPackageManagers: [
              { name: "bun", command: "bunx --bun", commandParam: "bun" },
            ],
          },
        ],
      };
      await Bun.write(examplePath, JSON.stringify(exampleTemplate, null, 2));
    }
  } catch {
    // Non-fatal
  }

  const activationPath =
    shellScriptPath || paths.shellScriptFor(shell.integrationFileName());

  const terminal = resolveTerminal(process.env);
  let terminalLine: string;
  if (terminal) {
    if (terminal.id === "kitty") {
      terminalLine = `  ${yellow("!")} Terminal detected: ${bold("kitty")} - requires ${cyan("allow_remote_control yes")} in ${gray("~/.config/kitty/kitty.conf")}`;
    } else {
      terminalLine = `  ${green("✓")} Terminal detected: ${bold(terminal.id)} - tab opening supported`;
    }
  } else {
    terminalLine = `  ${yellow("!")} Terminal not recognized - workspace tab opening will be skipped`;
  }

  console.log(`
${bold("Setup complete!")}

${terminalLine}

To activate ${bold(cyan("wd"))}, add this line to your ${gray(shell.profilePath())}:

  ${cyan(shell.sourceCommand(activationPath))}

Then restart your shell:

  ${gray(shell.sourceCommand(shell.profilePath()))}

Quick start:
  ${cyan("wd")}          ${gray("→ interactive project selector")}
  ${cyan("wd recent")}   ${gray("→ recently visited projects")}
  ${cyan("wd new")}      ${gray("→ create a new project from template")}
  ${cyan("wd ws new")}   ${gray("→ create a workspace")}
  ${cyan("wd open")} ${gray("<name>")}  ${gray("→ open a workspace")}
`);
}
