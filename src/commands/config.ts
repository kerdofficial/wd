import { select, input, confirm, number, editor } from "@inquirer/prompts";
import { actionSelect, ESCAPE_VALUE } from "../ui/action-select";
import { requireConfig, saveConfig } from "../config/manager";
import type { Config, CustomType, CustomTypeColor } from "../config/schema";
import { CustomTypeColorSchema, TemplateSchema } from "../config/schema";
import {
  bold,
  green,
  yellow,
  red,
  gray,
  cyan,
  blue,
  magenta,
  clearScreen,
  printHeader,
  Spinner,
} from "../ui/format";
import { gracefulRun } from "../utils/prompt-wrapper";
import { addScanRoot } from "../utils/scan-root-prompt";
import { TEMPLATES_SOURCE_URL } from "../core/templates";

// ─── Color helpers ────────────────────────────────────────────────────────────

const COLOR_FN_MAP: Record<CustomTypeColor, (s: string) => string> = {
  cyan,
  green,
  yellow,
  blue,
  magenta,
  red,
  gray,
  white: (s) => s,
};

function colorize(color: CustomTypeColor, s: string): string {
  return (COLOR_FN_MAP[color] ?? cyan)(s);
}

// ─── Escape check ─────────────────────────────────────────────────────────────

function isEscape(v: string): boolean {
  return v === ESCAPE_VALUE;
}

// ─── Template URL test ────────────────────────────────────────────────────────

interface TestResult {
  ok: boolean;
  count?: number;
  error?: string;
}

async function testTemplateUrl(url: string): Promise<TestResult> {
  try {
    let raw: unknown;

    if (url.startsWith("file://")) {
      const filePath = url.slice("file://".length);
      // Safety: must be an absolute path with no traversal segments
      if (!filePath.startsWith("/") || filePath.split("/").includes("..")) {
        return { ok: false, error: `Invalid file path: must be absolute with no '..' segments` };
      }
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        return { ok: false, error: `File not found: ${filePath}` };
      }
      raw = await file.json();
    } else {
      const resp = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) {
        return { ok: false, error: `HTTP ${resp.status} ${resp.statusText}` };
      }
      raw = await resp.json();
    }

    const data = Array.isArray(raw)
      ? raw
      : ((raw as { templates?: unknown[] }).templates ?? []);

    let validCount = 0;
    const errors: string[] = [];

    for (const entry of data) {
      const result = TemplateSchema.safeParse(entry);
      if (result.success) {
        validCount++;
      } else {
        const id = (entry as { id?: string }).id ?? "unknown";
        errors.push(
          `  ${gray("·")} ${id}: ${result.error.issues[0]?.message ?? "invalid"}`,
        );
      }
    }

    if (validCount === 0 && errors.length === 0) {
      return { ok: false, error: "No templates found (empty array)" };
    }

    if (validCount === 0) {
      return {
        ok: false,
        error: `No valid templates found.\n${errors.slice(0, 3).join("\n")}`,
      };
    }

    return { ok: true, count: validCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

// ─── Custom type prompt ───────────────────────────────────────────────────────

async function promptCustomType(
  existing: CustomType | null,
): Promise<CustomType | null> {
  const colorChoices = CustomTypeColorSchema.options.map((c) => ({
    name: colorize(c, c),
    value: c as CustomTypeColor,
  }));

  const name = await input({
    message: "Type name:",
    default: existing?.name ?? "",
    validate: (v) => (v.trim() ? true : "Name cannot be empty"),
  });

  const markersRaw = await input({
    message: "Marker files (comma-separated, e.g. manage.py, Gemfile):",
    default: existing?.markers.join(", ") ?? "",
  });

  const patternsRaw = await input({
    message: "Filename patterns (comma-separated regex, e.g. ^Gemfile$):",
    default: existing?.patterns.join(", ") ?? "",
    validate: (v) => {
      if (!v.trim()) return true;
      for (const p of v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)) {
        try {
          new RegExp(p);
        } catch {
          return `Invalid regex: ${p}`;
        }
      }
      return true;
    },
  });

  const markers = markersRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const patterns = patternsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (markers.length === 0 && patterns.length === 0) {
    console.log(`  ${yellow("!")} At least one marker or pattern is required.`);
    return null;
  }

  const color = await select<CustomTypeColor>({
    message: "Display color:",
    default: existing?.color ?? "cyan",
    loop: false,
    choices: colorChoices,
  });

  // Preview
  console.log();
  console.log(
    `  Preview: ${colorize(color, `[${name}]`)}  markers: ${markers.join(", ") || gray("(none)")}  patterns: ${patterns.join(", ") || gray("(none)")}`,
  );
  console.log();

  const save = await confirm({ message: "Save this type?", default: true });
  if (!save) return null;

  return { name, markers, patterns, color };
}

// ─── Section: Scan Roots ──────────────────────────────────────────────────────

async function configureScanRoots(config: Config): Promise<void> {
  let running = true;
  while (running) {
    clearScreen();
    console.log();
    if (config.scanRoots.length > 0) {
      console.log(bold("Scan roots:"));
      config.scanRoots.forEach((r, i) => {
        console.log(
          `  ${gray(String(i + 1) + ".")} ${r.label ?? r.path}  ${gray(r.path)}`,
        );
      });
    } else {
      console.log(gray("  No scan roots configured."));
    }
    console.log();

    const action = await actionSelect({
      message: "Scan roots:",
      choices: [
        { name: "Add scan root", value: "add" },
        ...(config.scanRoots.length > 0
          ? [{ name: "Remove scan root", value: "remove" }]
          : []),
        { name: "Back", value: "back" },
      ],
    });

    if (isEscape(action) || action === "back") {
      running = false;
    } else if (action === "add") {
      const root = await addScanRoot(config.scanRoots);
      if (root) {
        config.scanRoots.push(root);
        await saveConfig(config);
        console.log(`  ${green("✓")} Added: ${root.label} (${root.path})`);
      }
    } else if (action === "remove") {
      const choices = [
        ...config.scanRoots.map((r, i) => ({
          name: `${r.label ?? r.path}  ${gray(r.path)}`,
          value: String(i),
        })),
        { name: "Cancel", value: "cancel" },
      ];
      const result = await actionSelect({
        message: "Which root to remove?",
        choices,
      });
      if (!isEscape(result) && result !== "cancel") {
        const idx = parseInt(result);
        const removed = config.scanRoots.splice(idx, 1)[0];
        await saveConfig(config);
        console.log(
          `  ${yellow("✓")} Removed: ${removed?.label ?? removed?.path}`,
        );
      }
    }
  }
}

// ─── Section: Custom Types ────────────────────────────────────────────────────

async function configureCustomTypes(config: Config): Promise<void> {
  let running = true;
  while (running) {
    clearScreen();
    console.log();
    if (config.customTypes.length > 0) {
      console.log(bold("Custom types:"));
      config.customTypes.forEach((t, i) => {
        console.log(
          `  ${gray(String(i + 1) + ".")} ${colorize(t.color, t.name)}  ${gray(t.markers.join(", ") || "(no markers)")}`,
        );
      });
    } else {
      console.log(gray("  No custom types configured."));
    }
    console.log();

    const action = await actionSelect({
      message: "Custom types:",
      choices: [
        { name: "Add type", value: "add" },
        ...(config.customTypes.length > 0
          ? [
              { name: "Edit type", value: "edit" },
              { name: "Remove type", value: "remove" },
            ]
          : []),
        { name: "Back", value: "back" },
      ],
    });

    if (isEscape(action) || action === "back") {
      running = false;
    } else if (action === "add") {
      const newType = await promptCustomType(null);
      if (newType) {
        config.customTypes.push(newType);
        await saveConfig(config);
        console.log(
          `  ${green("✓")} Added: ${colorize(newType.color, newType.name)}`,
        );
      }
    } else if (action === "edit") {
      const choices = [
        ...config.customTypes.map((t, i) => ({
          name: `${colorize(t.color, t.name)}  ${gray(t.markers.join(", ") || "(no markers)")}`,
          value: String(i),
        })),
        { name: "Cancel", value: "cancel" },
      ];
      const result = await actionSelect({ message: "Which type to edit?", choices });
      if (!isEscape(result) && result !== "cancel") {
        const idx = parseInt(result);
        const updated = await promptCustomType(config.customTypes[idx]!);
        if (updated) {
          config.customTypes[idx] = updated;
          await saveConfig(config);
          console.log(
            `  ${green("✓")} Updated: ${colorize(updated.color, updated.name)}`,
          );
        }
      }
    } else if (action === "remove") {
      const choices = [
        ...config.customTypes.map((t, i) => ({
          name: `${colorize(t.color, t.name)}  ${gray(t.markers.join(", ") || "(no markers)")}`,
          value: String(i),
        })),
        { name: "Cancel", value: "cancel" },
      ];
      const result = await actionSelect({ message: "Which type to remove?", choices });
      if (!isEscape(result) && result !== "cancel") {
        const idx = parseInt(result);
        const removed = config.customTypes.splice(idx, 1)[0];
        await saveConfig(config);
        console.log(`  ${yellow("✓")} Removed: ${removed?.name}`);
      }
    }
  }
}

// ─── Section: boolean toggle (reusable) ──────────────────────────────────────

async function configureBoolToggle(opts: {
  label: string;
  description: string;
  current: boolean;
  onSave: (val: boolean) => Promise<void>;
}): Promise<void> {
  const { label, description, current, onSave } = opts;

  console.log();
  console.log(gray(description));
  console.log();

  const action = await actionSelect({
    message: label,
    choices: [
      {
        name: `Enable${current ? `  ${green("← current")}` : ""}`,
        value: "on",
      },
      {
        name: `Disable${!current ? `  ${red("← current")}` : ""}`,
        value: "off",
      },
      { name: "Back", value: "back" },
    ],
  });

  if (isEscape(action) || action === "back") return;

  const newValue = action === "on";
  if (newValue !== current) {
    await onSave(newValue);
    console.log(
      `  ${green("✓")} Set to ${newValue ? green("ON") : red("OFF")}`,
    );
  }
}

// ─── Section: showProjectType toggle ─────────────────────────────────────────

async function configureShowProjectType(config: Config): Promise<void> {
  await configureBoolToggle({
    label: "Show project type badge",
    description:
      "Display the [TypeName] badge next to projects in the selector.",
    current: config.preferences.showProjectType,
    onSave: async (val) => {
      config.preferences.showProjectType = val;
      await saveConfig(config);
    },
  });
}

// ─── Section: showCategory toggle ─────────────────────────────────────────────

async function configureShowCategory(config: Config): Promise<void> {
  await configureBoolToggle({
    label: "Show category",
    description:
      "Display the category/label column next to projects in the selector.",
    current: config.preferences.showCategory,
    onSave: async (val) => {
      config.preferences.showCategory = val;
      await saveConfig(config);
    },
  });
}

// ─── Section: maxRecent ───────────────────────────────────────────────────────

async function configureMaxRecent(config: Config): Promise<void> {
  const current = config.preferences.maxRecent;

  const action = await actionSelect({
    message: "Max recent projects",
    choices: [
      {
        name: `Edit  ${gray("(current: " + String(current) + ")")}`,
        value: "edit",
      },
      { name: "Back", value: "back" },
    ],
  });

  if (isEscape(action) || action === "back") return;

  console.log();
  console.log(
    gray("Number of recently visited projects to keep in frecency history."),
  );
  console.log();

  const newValue = await number({
    message: "Max recent (1-50):",
    default: current,
    min: 1,
    max: 50,
  });

  const resolved = newValue ?? current;
  if (resolved !== current) {
    config.preferences.maxRecent = resolved;
    await saveConfig(config);
    console.log(`  ${green("✓")} Set to ${cyan(String(resolved))}`);
  }
}

// ─── Section: scanIgnore ──────────────────────────────────────────────────────

async function applyScanIgnoreFromEditor(
  config: Config,
  current: string[],
): Promise<void> {
  const edited = await editor({
    message: "Edit ignore list (one entry per line):",
    default: current.join("\n"),
  });

  const newEntries = edited
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (newEntries.length === 0) {
    console.log(
      `  ${yellow("!")} Cannot save empty ignore list. Changes discarded.`,
    );
    return;
  }

  const added = newEntries.filter((e) => !current.includes(e));
  const removed = current.filter((e) => !newEntries.includes(e));

  if (added.length === 0 && removed.length === 0) {
    console.log(gray("  No changes."));
    return;
  }

  console.log();
  if (added.length > 0) {
    added.forEach((e) => console.log(`  ${green("+")} ${e}`));
  }
  if (removed.length > 0) {
    removed.forEach((e) => console.log(`  ${red("-")} ${e}`));
  }
  console.log();

  const apply = await confirm({ message: "Apply changes?", default: true });
  if (apply) {
    config.preferences.scanIgnore = newEntries;
    await saveConfig(config);
    console.log(`  ${green("✓")} Saved (${newEntries.length} entries)`);
  }
}

async function configureScanIgnore(config: Config): Promise<void> {
  let running = true;
  while (running) {
    clearScreen();
    const current = config.preferences.scanIgnore;

    console.log();
    console.log(bold("Scan ignore list"));
    console.log(gray("Directories and files to skip during project scanning."));
    console.log();

    if (current.length > 0) {
      current.forEach((e, i) =>
        console.log(`  ${gray(String(i + 1) + ".")} ${e}`),
      );
    } else {
      console.log(gray("  (empty)"));
    }
    console.log();

    const action = await actionSelect({
      message: "Scan ignore list:",
      choices: [
        { name: "Add entry", value: "add" },
        ...(current.length > 0
          ? [{ name: "Remove entry", value: "remove" }]
          : []),
        { name: "Back", value: "back" },
      ],
      shortcut: { key: "e", value: "editor", label: "open in editor" },
    });

    if (isEscape(action) || action === "back") {
      running = false;
    } else if (action === "add") {
      const entry = await input({
        message: "Entry name to ignore:",
        validate: (v) => {
          if (!v.trim()) return "Cannot be empty";
          if (current.includes(v.trim())) return "Already in list";
          return true;
        },
      });
      config.preferences.scanIgnore.push(entry.trim());
      await saveConfig(config);
      console.log(`  ${green("✓")} Added: ${entry.trim()}`);
    } else if (action === "remove") {
      const choices = [
        ...current.map((e, i) => ({ name: e, value: String(i) })),
        { name: "Cancel", value: "cancel" },
      ];
      const result = await actionSelect({ message: "Which entry to remove?", choices });
      if (!isEscape(result) && result !== "cancel") {
        const idx = parseInt(result);
        const removed = config.preferences.scanIgnore.splice(idx, 1)[0];
        await saveConfig(config);
        console.log(`  ${yellow("✓")} Removed: ${removed}`);
      }
    } else if (action === "editor") {
      await applyScanIgnoreFromEditor(config, [...config.preferences.scanIgnore]);
    }
  }
}

// ─── Section: Templates URL ───────────────────────────────────────────────────

async function runTemplatesTest(url: string): Promise<TestResult> {
  const spinner = new Spinner(`Testing ${gray(url)} ...`);
  spinner.start();
  const result = await testTemplateUrl(url);
  spinner.stop();

  if (result.ok) {
    console.log(
      `  ${green("✓")} Found ${bold(String(result.count))} valid templates`,
    );
  } else {
    console.log(`  ${red("✗")} ${result.error ?? "Unknown error"}`);
  }
  return result;
}

async function configureTemplatesUrl(config: Config): Promise<void> {
  let running = true;
  while (running) {
    clearScreen();
    const currentUrl = config.projectConstructor.templates.gistUrl;
    const isDefault = !currentUrl;

    console.log();
    console.log(bold("Templates URL"));
    console.log(
      gray(
        "URL for fetching built-in project templates. Supports https:// and file://.",
      ),
    );
    console.log(`Current: ${isDefault ? gray("(default)") : cyan(currentUrl)}`);
    if (isDefault) {
      console.log(gray(`Default: ${TEMPLATES_SOURCE_URL}`));
    }
    console.log();

    const action = await actionSelect({
      message: "Templates URL:",
      choices: [
        { name: "Set custom URL", value: "set" },
        ...(isDefault
          ? []
          : [
              { name: "Test current URL", value: "test" },
              { name: "Reset to default", value: "reset" },
            ]),
        { name: "Back", value: "back" },
      ],
    });

    if (isEscape(action) || action === "back") {
      running = false;
    } else if (action === "set") {
      const newUrl = await input({
        message: "Templates URL:",
        default: currentUrl || "",
        validate: (v) => {
          if (!v.trim()) return "URL cannot be empty";
          if (!v.startsWith("https://") && !v.startsWith("file://")) {
            return "URL must start with https:// or file://";
          }
          return true;
        },
      });

      console.log();
      const result = await runTemplatesTest(newUrl);
      console.log();

      const savePrompt = result.ok
        ? await confirm({ message: "Save this URL?", default: true })
        : await confirm({
            message: "Test failed. Save anyway?",
            default: false,
          });

      if (savePrompt) {
        config.projectConstructor.templates.gistUrl = newUrl;
        await saveConfig(config);
        console.log(`  ${green("✓")} Saved`);
      }
    } else if (action === "test") {
      console.log();
      await runTemplatesTest(currentUrl);
    } else if (action === "reset") {
      const doReset = await confirm({
        message: "Reset templates URL to default?",
        default: true,
      });
      if (doReset) {
        config.projectConstructor.templates.gistUrl = "";
        await saveConfig(config);
        console.log(`  ${green("✓")} Reset to default`);
      }
    }
  }
}

// ─── Main config command ──────────────────────────────────────────────────────

export async function config(): Promise<void> {
  await gracefulRun(_config);
}

async function _config(): Promise<void> {
  const cfg = await requireConfig();

  let running = true;
  while (running) {
    clearScreen();
    printHeader();

    const section = await actionSelect({
      message: "What would you like to configure?",
      choices: [
        { name: "Scan roots", value: "scanRoots" },
        { name: "Custom project types", value: "customTypes" },
        { name: "Show project type badge", value: "showProjectType" },
        { name: "Show category", value: "showCategory" },
        { name: "Max recent projects", value: "maxRecent" },
        { name: "Scan ignore list", value: "scanIgnore" },
        { name: "Templates URL", value: "templatesUrl" },
        { name: "Exit", value: "exit" },
      ],
    });

    if (isEscape(section) || section === "exit") {
      running = false;
    } else {
      switch (section) {
        case "scanRoots":
          await configureScanRoots(cfg);
          break;
        case "customTypes":
          await configureCustomTypes(cfg);
          break;
        case "showProjectType":
          await configureShowProjectType(cfg);
          break;
        case "showCategory":
          await configureShowCategory(cfg);
          break;
        case "maxRecent":
          await configureMaxRecent(cfg);
          break;
        case "scanIgnore":
          await configureScanIgnore(cfg);
          break;
        case "templatesUrl":
          await configureTemplatesUrl(cfg);
          break;
      }
    }
  }
}
