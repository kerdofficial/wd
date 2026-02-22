/**
 * `wd new` — Project Constructor wizard.
 *
 * Interactive wizard for creating new projects from templates.
 * Supports pre-filled values via CLI flags (--template, --pm, --dir, etc.)
 * and dynamic flags for additional parameters (--base-color zinc, etc.)
 */
import { input, select, search, checkbox, confirm } from "@inquirer/prompts";
import { join, basename } from "node:path";
import { mkdir } from "node:fs/promises";
import { loadTemplates, type CollisionError } from "../core/templates";
import { interpolate, validatePlaceholders } from "../core/interpolation";
import { executeCommand, printCommandError } from "../core/executor";
import { parseNewArgs, extractNewArgv } from "../core/arg-parser";
import { requireConfig, saveConfig, loadHistory, saveHistory } from "../config/manager";
import { runPendingMigrations } from "../config/migrations";
import type { ShellOutput } from "../utils/shell";
import type {
  Template,
  Variant,
  PackageManager,
  AdditionalParameter,
} from "../config/schema";
import {
  bold,
  cyan,
  green,
  yellow,
  red,
  gray,
  clearScreen,
  printHeader,
  Spinner,
} from "../ui/format";
import { gracefulRun } from "../utils/prompt-wrapper";
import { recordVisit } from "../core/frecency";
import { pathExists } from "../utils/fs";
import directorySearch from "../ui/directory-search";

// ─── Snapshot of a wizard round's collected values ───────────────────────────

interface WizardState {
  appName: string;
  template: Template;
  variant: Variant;
  pm: PackageManager;
  additionalParams: Map<string, string>;
  targetDir: string;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function newProject(shellOutput: ShellOutput): Promise<void> {
  await gracefulRun(() => _newProject(shellOutput));
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

async function _newProject(shellOutput: ShellOutput): Promise<void> {
  // ── One-time setup (before wizard loop) ───────────────────────────────────

  const cliArgs = parseNewArgs(extractNewArgv(process.argv));

  const config = await runPendingMigrations();
  const gistUrl = config?.projectConstructor?.templates?.gistUrl ?? "";

  const spinner = new Spinner("Loading templates…");
  spinner.start();

  const { templates, collisions, cacheStale } = await loadTemplates({
    gistUrl,
    forceRefresh: cliArgs.raw,
  });

  spinner.stop();

  if (cacheStale) {
    console.log(
      `${yellow("!")} Template cache is stale (offline?). Using cached templates.`,
    );
  }

  if (collisions.length > 0) {
    console.error(`\n${red("✗")} Template ID collision detected:\n`);
    for (const col of collisions as CollisionError[]) {
      console.error(
        `  ID: ${bold(col.id)}\n` +
          `    Gist template:   ${col.gistName}\n` +
          `    Custom template: ${col.customName}\n`,
      );
    }
    console.error(
      `\n${yellow("Tip:")} Rename the custom template's ${bold("id")} field to a unique value.\n`,
    );
    process.exit(1);
  }

  const visibleTemplates = templates.filter((t) => !t.hidden);

  if (visibleTemplates.length === 0 && templates.length === 0) {
    console.log(
      `${yellow("!")} No templates found.\n\n` +
        `Add custom templates to: ${gray("~/.config/wd/templates/*.json")}\n` +
        `Or configure a template gist URL in config.\n`,
    );
    return;
  }

  const cliArgsFull = parseNewArgs(extractNewArgv(process.argv), templates);

  if (cliArgsFull.unknownFlags.length > 0) {
    for (const flag of cliArgsFull.unknownFlags) {
      console.log(`${yellow("!")} Unknown flag ignored: ${gray(flag)}`);
    }
  }

  // ── Wizard loop ───────────────────────────────────────────────────────────
  // `prev` is null on the first run, set to the previous round's values on edit.

  let prev: WizardState | null = null;

  while (true) {
    clearScreen();
    printHeader();
    console.log(`${bold("Project Constructor")}\n`);

    const isEdit = prev !== null;

    // ── Step 1: Project name ────────────────────────────────────────────────

    let appName: string;
    if (cliArgsFull.appName && !isEdit) {
      appName = cliArgsFull.appName;
      console.log(`${green("✓")} Project name: ${bold(appName)}`);
    } else {
      appName = await input({
        message: "Project name:",
        default: prev?.appName ?? cliArgsFull.appName,
        validate: (v) => {
          if (!v.trim()) return "Name cannot be empty";
          if (!/^[a-z0-9\-_]+$/i.test(v.trim()))
            return "Use only letters, numbers, hyphens, underscores";
          return true;
        },
      });
    }
    appName = appName.trim();

    // ── Step 2: Template ────────────────────────────────────────────────────

    let selectedTemplate: Template;
    if (cliArgsFull.template && !isEdit) {
      const found = findTemplate(visibleTemplates, cliArgsFull.template);
      if (!found) {
        console.error(
          `${red("✗")} Template not found: ${bold(cliArgsFull.template)}\n` +
            `Available: ${visibleTemplates.map((t) => t.id).join(", ")}`,
        );
        process.exit(1);
      }
      selectedTemplate = found;
      console.log(`${green("✓")} Template: ${bold(selectedTemplate.name)}`);
    } else if (isEdit) {
      // Edit mode: select with previous value pre-highlighted
      selectedTemplate = await select<Template>({
        message: "Select template:",
        default: prev?.template,
        choices: visibleTemplates.map((t) => ({
          name: t.name,
          value: t,
          description: t.description ?? t.id,
        })),
        pageSize: 12,
      });
    } else {
      // First run: fuzzy search
      selectedTemplate = await search<Template>({
        message: "Select template:",
        source: (term) => {
          const q = (term ?? "").toLowerCase();
          return visibleTemplates
            .filter(
              (t) =>
                !q ||
                t.name.toLowerCase().includes(q) ||
                t.id.toLowerCase().includes(q) ||
                (t.description ?? "").toLowerCase().includes(q),
            )
            .map((t) => ({
              name: t.name,
              value: t,
              description: t.description ?? t.id,
            }));
        },
      });
    }

    // ── Step 3: Variant ─────────────────────────────────────────────────────

    let selectedVariant: Variant;
    if (selectedTemplate.variants.length === 1) {
      selectedVariant = selectedTemplate.variants[0]!;
      if (
        cliArgsFull.variant &&
        cliArgsFull.variant !== selectedVariant.type &&
        cliArgsFull.variant.toLowerCase() !== selectedVariant.name.toLowerCase()
      ) {
        console.log(
          `${yellow("!")} Variant "${cliArgsFull.variant}" not available for this template; using ${bold(selectedVariant.name)}`,
        );
      } else if (selectedVariant.type !== "default") {
        console.log(`${green("✓")} Variant: ${bold(selectedVariant.name)}`);
      }
    } else if (cliArgsFull.variant && !isEdit) {
      const found = selectedTemplate.variants.find(
        (v) =>
          v.type === cliArgsFull.variant ||
          v.name.toLowerCase() === cliArgsFull.variant!.toLowerCase(),
      );
      if (!found) {
        console.error(
          `${red("✗")} Variant not found: ${bold(cliArgsFull.variant!)}\n` +
            `Available: ${selectedTemplate.variants.map((v) => v.type).join(", ")}`,
        );
        process.exit(1);
      }
      selectedVariant = found;
      console.log(`${green("✓")} Variant: ${bold(selectedVariant.name)}`);
    } else {
      // Preserve previous variant if it still exists in the newly selected template
      const prevVariant = prev?.variant
        ? selectedTemplate.variants.find((v) => v.type === prev!.variant.type)
        : undefined;
      selectedVariant = await select<Variant>({
        message: "Select variant:",
        default: prevVariant,
        choices: selectedTemplate.variants.map((v) => ({
          name: v.name,
          value: v,
        })),
      });
    }

    // ── Step 4: Package manager ─────────────────────────────────────────────

    let selectedPm: PackageManager;
    const pms = selectedVariant.supportedPackageManagers;

    if (pms.length === 1) {
      selectedPm = pms[0]!;
      console.log(`${green("✓")} Package manager: ${bold(selectedPm.name)}`);
    } else if (cliArgsFull.pm && !isEdit) {
      const found = pms.find(
        (pm) => pm.name.toLowerCase() === cliArgsFull.pm!.toLowerCase(),
      );
      if (!found) {
        console.error(
          `${red("✗")} Package manager not found: ${bold(cliArgsFull.pm!)}\n` +
            `Available: ${pms.map((pm) => pm.name).join(", ")}`,
        );
        process.exit(1);
      }
      selectedPm = found;
      console.log(`${green("✓")} Package manager: ${bold(selectedPm.name)}`);
    } else {
      // Preserve previous PM if it still exists in the current variant
      const prevPm = prev?.pm
        ? pms.find((pm) => pm.name === prev!.pm.name)
        : undefined;
      selectedPm = await select<PackageManager>({
        message: "Package manager:",
        default: prevPm,
        choices: pms.map((pm) => ({ name: pm.name, value: pm })),
      });
    }

    // ── Step 5: Additional parameters ───────────────────────────────────────

    const additionalParamValues = new Map<string, string>();
    const extraParams = selectedVariant.additionalParameters ?? [];

    for (const param of extraParams) {
      const cliValue = param.wizardParameter
        ? cliArgsFull.dynamicFlags.get(param.wizardParameter.default)
        : undefined;

      // CLI flag: always auto-accept (in both first run and edit mode)
      if (cliValue !== undefined) {
        additionalParamValues.set(param.parameterKey, cliValue);
        console.log(`${green("✓")} ${param.description}: ${bold(cliValue)}`);
        continue;
      }

      const prevValue = prev?.additionalParams.get(param.parameterKey);

      if (!isEdit && param.optional) {
        // First run, optional param: ask whether to configure
        const wantToSet = await confirm({
          message: `Configure ${bold(param.description)}?`,
          default: false,
        });
        if (!wantToSet) continue;
      }

      const value = await collectParam(param, prevValue);
      if (value !== null) {
        additionalParamValues.set(param.parameterKey, value);
      }
    }

    // ── Step 6: Target directory (skipped in dry-run) ───────────────────────

    const dryRun = cliArgsFull.dryRun;
    let targetDir: string = "";

    if (dryRun) {
      console.log(`${gray("✓ Directory: (dry run — skipped)")}`);
    } else if (cliArgsFull.dir && !isEdit) {
      targetDir = cliArgsFull.dir;
      console.log(`${green("✓")} Directory: ${bold(targetDir)}`);
    } else {
      const configData = await requireConfig();
      const dirResult = await directorySearch({
        message: "Target directory:",
        scanRoots: configData.scanRoots,
        pageSize: 10,
      });
      targetDir = dirResult.path;

      if (dirResult.isNew) {
        const isUnderRoot = configData.scanRoots.some((r) =>
          targetDir.startsWith(r.path),
        );
        if (!isUnderRoot) {
          const addRoot = await confirm({
            message: `Add ${bold(targetDir)} as a new scan root?`,
            default: false,
          });
          if (addRoot) {
            const label = await input({
              message: "Label for this scan root:",
              default: basename(targetDir),
            });
            configData.scanRoots.push({ path: targetDir, label, maxDepth: 3 });
            await saveConfig(configData);
            console.log(`${green("✓")} Scan root added: ${bold(targetDir)}`);
          }
        }
      }
    }

    const projectPath = dryRun
      ? `<target-dir>/${appName}`
      : join(targetDir, appName);

    // ── Step 7: Summary ─────────────────────────────────────────────────────

    console.log(`\n${bold(dryRun ? "Dry run summary:" : "Summary:")}`);
    console.log(`  ${gray("Project:")}  ${bold(appName)}`);
    console.log(`  ${gray("Template:")} ${bold(selectedTemplate.name)}`);
    if (selectedTemplate.variants.length > 1) {
      console.log(`  ${gray("Variant:")}  ${bold(selectedVariant.name)}`);
    }
    console.log(`  ${gray("Package:")}  ${bold(selectedPm.name)}`);
    for (const [key, val] of additionalParamValues) {
      console.log(`  ${gray(key + ":")}  ${bold(val)}`);
    }
    if (!dryRun) {
      console.log(`  ${gray("Location:")} ${bold(projectPath)}`);
    }

    // ── Dry run: show command and exit ──────────────────────────────────────

    if (dryRun) {
      const dryContext: Record<string, unknown> = {
        PROJECT_NAME: appName,
        PACKAGE_MANAGER: {
          name: selectedPm.name,
          command: selectedPm.command,
          commandParam: selectedPm.commandParam,
        },
      };
      for (const [key, val] of additionalParamValues) {
        dryContext[key] = val;
      }

      const previewCmd = interpolate(selectedVariant.command, dryContext);
      const validation = validatePlaceholders(selectedVariant.command, dryContext);

      console.log(`\n  ${gray("Command:")} ${cyan(previewCmd)}`);

      if (!validation.valid) {
        console.log(
          `\n${yellow("!")} Unresolved placeholders: ${validation.missing.map((p) => bold(`{${p}}`)).join(", ")}`,
        );
      }

      if ((selectedVariant.postCreateCommands ?? []).length > 0) {
        console.log(`\n  ${gray("Post-create:")}`);
        for (const postCmd of selectedVariant.postCreateCommands!) {
          console.log(`    ${cyan(interpolate(postCmd, dryContext))}`);
        }
      }

      console.log(`\n${gray("Dry run complete — no project was created.")}\n`);
      return;
    }

    // ── Action prompt ───────────────────────────────────────────────────────

    const action = await select<"create" | "edit" | "cancel">({
      message: "Ready to create?",
      choices: [
        { name: "Create", value: "create" },
        { name: "Edit", value: "edit" },
        { name: "Cancel", value: "cancel" },
      ],
    });

    if (action === "cancel") {
      console.log(`\n${yellow("!")} Cancelled.\n`);
      return;
    }

    if (action === "edit") {
      // Save current values and loop back to top
      prev = {
        appName,
        template: selectedTemplate,
        variant: selectedVariant,
        pm: selectedPm,
        additionalParams: additionalParamValues,
        targetDir,
      };
      continue;
    }

    // action === "create" — fall through to creation

    // ── Step 8: Create target directory if needed ───────────────────────────

    const targetExists = await pathExists(targetDir);
    if (!targetExists) {
      const doCreate = await confirm({
        message: `Directory ${bold(targetDir)} does not exist. Create it?`,
        default: true,
      });
      if (!doCreate) {
        console.log(`\n${yellow("!")} Aborted.\n`);
        return;
      }
      await mkdir(targetDir, { recursive: true });
    }

    // ── Step 9: Build interpolation context ────────────────────────────────

    const context: Record<string, unknown> = {
      PROJECT_NAME: appName,
      PACKAGE_MANAGER: {
        name: selectedPm.name,
        command: selectedPm.command,
        commandParam: selectedPm.commandParam,
      },
    };
    for (const [key, val] of additionalParamValues) {
      context[key] = val;
    }

    const verbose = cliArgsFull.verbose;

    // ── Step 10: Validate and run main command ──────────────────────────────

    const interpolatedCmd = interpolate(selectedVariant.command, context);
    const validation = validatePlaceholders(selectedVariant.command, context);

    if (!validation.valid) {
      console.error(
        `${red("✗")} Missing values for placeholders: ${validation.missing.join(", ")}`,
      );
      process.exit(1);
    }

    console.log();
    const result = await executeCommand(interpolatedCmd, {
      cwd: targetDir,
      verbose,
      label: `Creating ${appName}`,
    });

    if (!result.success) {
      printCommandError(result);
      console.error(
        `\n${red("✗")} Project creation failed (exit ${result.exitCode}).\n`,
      );
      process.exit(1);
    }

    // ── Step 11: Post-create commands ───────────────────────────────────────

    const optionalParamKeys = new Set(
      (selectedVariant.additionalParameters ?? [])
        .filter((p) => p.optional)
        .map((p) => p.parameterKey),
    );

    for (const postCmd of selectedVariant.postCreateCommands ?? []) {
      const postValidation = validatePlaceholders(postCmd, context);
      if (!postValidation.valid) {
        const allMissingAreOptional = postValidation.missing.every((key) =>
          optionalParamKeys.has(key),
        );
        if (allMissingAreOptional) {
          console.log(
            `${yellow("!")} Skipping post-create command (optional params not set): ${gray(postCmd.slice(0, 60))}`,
          );
          continue;
        }
      }

      const interpolatedPost = interpolate(postCmd, context);
      const postResult = await executeCommand(interpolatedPost, {
        cwd: projectPath,
        verbose,
        label: interpolatedPost.slice(0, 40),
      });

      if (!postResult.success) {
        printCommandError(postResult);
        const doContinue = await confirm({
          message: `Post-create command failed. Continue anyway?`,
          default: false,
        });
        if (!doContinue) {
          process.exit(1);
        }
      }
    }

    // ── Step 12: cd to project ──────────────────────────────────────────────

    shellOutput.cd(projectPath);
    await shellOutput.flush();

    const history = await loadHistory();
    const updatedHistory = recordVisit(history, projectPath);
    await saveHistory(updatedHistory);

    // ── Step 13: Success ────────────────────────────────────────────────────

    clearScreen();
    printHeader();
    console.log(
      `${green("✓")} ${bold(appName)} created successfully!\n\n` +
        `  ${gray("Location:")} ${cyan(projectPath)}\n` +
        `  ${gray("Navigated to project directory")}\n` +
        `  ${gray("Happy coding! 🤖")}\n`,
    );

    break; // Exit the wizard loop
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findTemplate(
  templates: Template[],
  query: string,
): Template | undefined {
  const q = query.toLowerCase();
  return (
    templates.find((t) => t.id === query) ??
    templates.find((t) => t.id.toLowerCase() === q) ??
    templates.find((t) => t.name.toLowerCase() === q) ??
    templates.find((t) => t.name.toLowerCase().includes(q))
  );
}

async function collectParam(
  param: AdditionalParameter,
  defaultValue?: string,
): Promise<string | null> {
  switch (param.type) {
    case "select": {
      if (!param.options || param.options.length === 0) return null;
      return await select<string>({
        message: param.description + ":",
        default: defaultValue,
        choices: param.options.map((o) => ({ name: o, value: o })),
      });
    }

    case "multi-select": {
      if (!param.options || param.options.length === 0) return null;
      const divider = param.multiSelectDivider ?? " ";
      const prevSelected = defaultValue ? defaultValue.split(divider) : [];
      const selected = await checkbox<string>({
        message: param.description + ":",
        choices: param.options.map((o) => ({
          name: o,
          value: o,
          checked: prevSelected.includes(o),
        })),
      });
      return selected.join(divider) || null;
    }

    case "input": {
      const value = await input({
        message: param.description + ":",
        default: defaultValue,
        validate: (v) => {
          if (!param.optional && !v.trim()) return "This field is required";
          if (param.allowedInputValues !== undefined) {
            const allowed = String(param.allowedInputValues);
            if (!v.includes(allowed)) return `Must contain: ${allowed}`;
          }
          return true;
        },
      });
      return value.trim() || null;
    }
  }
}
