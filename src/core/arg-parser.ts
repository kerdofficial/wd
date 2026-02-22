/**
 * Custom dynamic flag parser for `wd new`.
 * Commander.js handles base flags; this parser handles dynamic template-specific flags.
 *
 * Fixed flags: --template, --variant, --pm, --dir, --verbose, --raw
 * Dynamic flags: --base-color zinc → dynamicFlags.set("base-color", "zinc")
 * Shorthand: -bc zinc → resolved via template additionalParameters
 */
import type { Template } from "../config/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedArgs {
  /** Optional positional app name (first non-flag argument) */
  appName?: string;
  /** Template ID or name */
  template?: string;
  /** Variant type */
  variant?: string;
  /** Package manager name */
  pm?: string;
  /** Target directory */
  dir?: string;
  /** Verbose output mode */
  verbose: boolean;
  /** Force template cache refresh */
  raw: boolean;
  /** Dry run: show what would be created without executing or prompting for dir */
  dryRun: boolean;
  /** Dynamic flags from template additionalParameters */
  dynamicFlags: Map<string, string>;
  /** Unknown flags (warned but ignored) */
  unknownFlags: string[];
}

// ─── Fixed flag aliases ────────────────────────────────────────────────────────

const FIXED_ALIASES: Record<string, string> = {
  "-t": "--template",
  "-v": "--variant",
  "--package-manager": "--pm",
};

// ─── Fixed flag names ─────────────────────────────────────────────────────────

const FIXED_FLAGS = new Set([
  "--template",
  "--variant",
  "--pm",
  "--dir",
  "--verbose",
  "--raw",
  "--dry-run",
  // Internal Commander flags — ignore silently
  "--shell-out",
]);

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse process.argv starting after "new" subcommand.
 * @param argv  Raw argv slice (e.g. process.argv.slice(3) after "wd-bin new ...")
 * @param templates  Loaded templates for shorthand resolution (may be empty initially)
 */
export function parseNewArgs(
  argv: string[],
  templates: Template[] = []
): ParsedArgs {
  const result: ParsedArgs = {
    appName: undefined,
    template: undefined,
    variant: undefined,
    pm: undefined,
    dir: undefined,
    verbose: false,
    raw: false,
    dryRun: false,
    dynamicFlags: new Map(),
    unknownFlags: [],
  };

  // Build shorthand lookup: "bc" → "base-color"
  const shorthands = buildShorthandMap(templates);

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;
    const resolvedArg = FIXED_ALIASES[arg] ?? arg;

    // Boolean fixed flags
    if (resolvedArg === "--verbose") {
      result.verbose = true;
      i++;
      continue;
    }
    if (resolvedArg === "--raw") {
      result.raw = true;
      i++;
      continue;
    }
    if (resolvedArg === "--dry-run") {
      result.dryRun = true;
      i++;
      continue;
    }

    // Value fixed flags
    if (resolvedArg === "--template" || resolvedArg === "--variant" || resolvedArg === "--pm" || resolvedArg === "--dir") {
      const value = argv[i + 1];
      if (value && !value.startsWith("-")) {
        if (resolvedArg === "--template") result.template = value;
        else if (resolvedArg === "--variant") result.variant = value;
        else if (resolvedArg === "--pm") result.pm = value;
        else if (resolvedArg === "--dir") result.dir = value;
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    // --shell-out (internal Commander flag with = syntax or space)
    if (arg === "--shell-out" || arg.startsWith("--shell-out=")) {
      if (!arg.includes("=")) i++;
      i++;
      continue;
    }

    // Long dynamic flag: --base-color zinc
    if (arg.startsWith("--") && !FIXED_FLAGS.has(arg)) {
      const flagName = arg.slice(2);
      const value = argv[i + 1];
      if (value !== undefined && !value.startsWith("-")) {
        result.dynamicFlags.set(flagName, value);
        i += 2;
      } else {
        result.unknownFlags.push(arg);
        i++;
      }
      continue;
    }

    // Short flag: -bc zinc
    if (arg.startsWith("-") && !arg.startsWith("--")) {
      const shortCode = arg.slice(1);
      const longName = shorthands.get(shortCode);
      if (longName) {
        const value = argv[i + 1];
        if (value !== undefined && !value.startsWith("-")) {
          result.dynamicFlags.set(longName, value);
          i += 2;
        } else {
          i++;
        }
      } else {
        result.unknownFlags.push(arg);
        i++;
      }
      continue;
    }

    // Positional argument (app name)
    if (!arg.startsWith("-") && result.appName === undefined) {
      result.appName = arg;
      i++;
      continue;
    }

    // Unknown
    result.unknownFlags.push(arg);
    i++;
  }

  return result;
}

// ─── Shorthand map builder ────────────────────────────────────────────────────

function buildShorthandMap(templates: Template[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const template of templates) {
    for (const variant of template.variants) {
      for (const param of variant.additionalParameters ?? []) {
        if (param.wizardParameter) {
          map.set(param.wizardParameter.shorthand, param.wizardParameter.default);
        }
      }
    }
  }
  return map;
}

/**
 * Extract the argv slice relevant to the `new` subcommand.
 * Finds "new" in argv and returns everything after it.
 */
export function extractNewArgv(argv: string[]): string[] {
  const idx = argv.indexOf("new");
  if (idx === -1) return [];
  return argv.slice(idx + 1);
}
