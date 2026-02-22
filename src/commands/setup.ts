import { input, select, confirm, number } from "@inquirer/prompts";
import { mkdir } from "node:fs/promises";
import { loadConfig, saveConfig, initConfigDir } from "../config/manager";
import { scanProjects } from "../core/scanner";
import { saveCache } from "../config/manager";
import type { Cache, Config, ScanRoot } from "../config/schema";
import { pathExists, isDirectory } from "../utils/fs";
import { bold, green, yellow, gray, cyan, Spinner, printHeader, clearScreen } from "../ui/format";
import { gracefulRun } from "../utils/prompt-wrapper";
import { paths } from "../config/paths";
import { readFileSync, existsSync } from "node:fs";

async function installShellScript(): Promise<void> {
  // Copy shell/wd.zsh to ~/.config/wd/wd.zsh
  const srcPath = new URL("../../shell/wd.zsh", import.meta.url).pathname;
  const content = readFileSync(srcPath, "utf-8");
  await Bun.write(paths.shellScript, content);
}

async function addScanRoot(existing: ScanRoot[]): Promise<ScanRoot | null> {
  console.log();
  const rawPath = await input({
    message: "Directory path to scan:",
    validate: async (val) => {
      if (!val.trim()) return "Path cannot be empty";
      if (!(await pathExists(val.trim()))) return `Path does not exist: ${val}`;
      if (!(await isDirectory(val.trim()))) return `Not a directory: ${val}`;
      if (existing.some((r) => r.path === val.trim())) return "Already added";
      return true;
    },
  });

  const dirPath = rawPath.trim();
  const defaultLabel = dirPath.split("/").at(-1) ?? "Projects";

  const label = await input({
    message: "Label for this root:",
    default: defaultLabel,
  });

  const category = await input({
    message: "Category (for grouping):",
    default: label.toLowerCase(),
  });

  const maxDepth = await number({
    message: "Max scan depth (how deep to look for projects):",
    default: 3,
    min: 1,
    max: 6,
  });

  return {
    path: dirPath,
    label,
    category,
    maxDepth: maxDepth ?? 3,
  };
}

export async function setup(): Promise<void> {
  await gracefulRun(_setup);
}

async function _setup(): Promise<void> {
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
      console.log(`  ${gray(String(i + 1) + ".")} ${r.label ?? r.path}  ${gray(r.path)}`);
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
      `\n${yellow("!")} No scan roots configured. Run "wd setup" again to add directories.\n`
    );
    await saveConfig(config);
    return;
  }

  await saveConfig(config);

  // Install shell script
  try {
    await installShellScript();
    console.log(`\n${green("✓")} Shell integration installed: ${gray(paths.shellScript)}`);
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

    spinner.stop(`${green("✓")} Found ${bold(String(projects.length))} projects`);
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
            command: "echo 'Creating {PROJECT_NAME} with {PACKAGE_MANAGER.command}'",
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

  console.log(`
${bold("Setup complete!")}

To activate ${bold(cyan("wd"))}, add this line to your ${gray("~/.zshrc")}:

  ${cyan(`source ${paths.shellScript}`)}

Then restart your shell:

  ${gray("source ~/.zshrc")}

Quick start:
  ${cyan("wd")}          ${gray("→ interactive project selector")}
  ${cyan("wd recent")}   ${gray("→ recently visited projects")}
  ${cyan("wd new")}      ${gray("→ create a new project from template")}
  ${cyan("wd ws new")}   ${gray("→ create a workspace")}
  ${cyan("wd open")} ${gray("<name>")}  ${gray("→ open a workspace")}
`);
}
