/**
 * Silent config migration system.
 *
 * Versioned migrations are applied sequentially on demand (e.g. before `wd new`).
 * Config tracks `configVersion` — the highest migration version applied.
 * Users who skipped multiple versions get all pending migrations applied in order.
 *
 * Adding a new migration:
 *   1. Add a new entry to MIGRATIONS with the next version number
 *   2. Implement the `up()` function (mutate config + write any new files)
 *   3. Bump LATEST_MIGRATION_VERSION
 *
 * Migrations must be:
 *   - Idempotent (safe to re-run if already applied)
 *   - Backwards-compatible (don't break existing user data)
 *   - Silent (no user-visible output unless there's an error)
 */
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import { loadConfig, saveConfig } from "./manager";
import type { Config } from "./schema";

// ─── Migration interface ──────────────────────────────────────────────────────

interface Migration {
  version: number;
  description: string;
  up: (config: Config) => Promise<Config>;
}

// ─── Built-in templates data (embedded for binary distribution) ───────────────
// This is the canonical template list. When new frameworks are added, add a new
// migration that calls writeBuiltinTemplates() with the updated BUILTIN_TEMPLATES.

const BUILTIN_TEMPLATES_V1 = [
  {
    id: "nextjs",
    name: "Next.js",
    description: "React framework with SSR, App Router and file-based routing",
    hidden: false,
    variants: [
      {
        type: "default",
        name: "Default",
        command: "{PACKAGE_MANAGER.command} create-next-app@latest {PROJECT_NAME} --yes",
        supportedPackageManagers: [
          { name: "bun",  command: "bunx --bun", commandParam: "bun" },
          { name: "pnpm", command: "pnpm dlx",   commandParam: "pnpm" },
          { name: "yarn", command: "yarn dlx",   commandParam: "yarn" },
        ],
      },
      {
        type: "shadcn",
        name: "shadcn/ui",
        command: "echo {PROJECT_NAME} | {PACKAGE_MANAGER.command} shadcn@latest init --template next --base-color {BASE_COLOR}",
        supportedPackageManagers: [
          { name: "bun",  command: "bunx --bun", commandParam: "bun" },
          { name: "pnpm", command: "pnpm dlx",   commandParam: "pnpm" },
          { name: "yarn", command: "yarn dlx",   commandParam: "yarn" },
        ],
        additionalParameters: [
          {
            id: "base-color",
            optional: false,
            description: "shadcn/ui base color",
            type: "select",
            options: ["neutral", "gray", "zinc", "stone", "slate"],
            parameterKey: "BASE_COLOR",
            wizardParameter: { default: "base-color", shorthand: "bc" },
          },
        ],
      },
    ],
  },
  {
    id: "react-vite",
    name: "React + Vite",
    description: "React with Vite bundler and TypeScript",
    hidden: false,
    variants: [
      {
        type: "default",
        name: "Default",
        command: "{PACKAGE_MANAGER.command} create-vite@latest {PROJECT_NAME} -- --template react-ts",
        supportedPackageManagers: [
          { name: "bun",  command: "bunx --bun", commandParam: "bun" },
          { name: "pnpm", command: "pnpm dlx",   commandParam: "pnpm" },
          { name: "yarn", command: "yarn dlx",   commandParam: "yarn" },
        ],
      },
      {
        type: "shadcn",
        name: "shadcn/ui",
        command: "echo {PROJECT_NAME} | {PACKAGE_MANAGER.command} shadcn@latest init --template vite --base-color {BASE_COLOR}",
        supportedPackageManagers: [
          { name: "bun",  command: "bunx --bun", commandParam: "bun" },
          { name: "pnpm", command: "pnpm dlx",   commandParam: "pnpm" },
          { name: "yarn", command: "yarn dlx",   commandParam: "yarn" },
        ],
        additionalParameters: [
          {
            id: "base-color",
            optional: false,
            description: "shadcn/ui base color",
            type: "select",
            options: ["neutral", "gray", "zinc", "stone", "slate"],
            parameterKey: "BASE_COLOR",
            wizardParameter: { default: "base-color", shorthand: "bc" },
          },
        ],
      },
    ],
  },
  {
    id: "tanstack-start",
    name: "TanStack Start",
    description: "Full-stack React framework by TanStack",
    hidden: false,
    variants: [
      {
        type: "default",
        name: "Default",
        command: "{PACKAGE_MANAGER.command} @tanstack/start@latest {PROJECT_NAME}",
        supportedPackageManagers: [
          { name: "bun",  command: "bunx --bun", commandParam: "bun" },
          { name: "pnpm", command: "pnpm dlx",   commandParam: "pnpm" },
          { name: "yarn", command: "yarn dlx",   commandParam: "yarn" },
        ],
      },
      {
        type: "shadcn",
        name: "shadcn/ui",
        command: "echo {PROJECT_NAME} | {PACKAGE_MANAGER.command} shadcn@latest init --template start --base-color {BASE_COLOR}",
        supportedPackageManagers: [
          { name: "bun",  command: "bunx --bun", commandParam: "bun" },
          { name: "pnpm", command: "pnpm dlx",   commandParam: "pnpm" },
          { name: "yarn", command: "yarn dlx",   commandParam: "yarn" },
        ],
        additionalParameters: [
          {
            id: "base-color",
            optional: false,
            description: "shadcn/ui base color",
            type: "select",
            options: ["neutral", "gray", "zinc", "stone", "slate"],
            parameterKey: "BASE_COLOR",
            wizardParameter: { default: "base-color", shorthand: "bc" },
          },
        ],
      },
    ],
  },
  {
    id: "tanstack-router",
    name: "TanStack Router",
    description: "Type-safe router for React applications",
    hidden: false,
    variants: [
      {
        type: "default",
        name: "Default",
        command: "{PACKAGE_MANAGER.command} create-tsrouter-app@latest {PROJECT_NAME}",
        supportedPackageManagers: [
          { name: "bun",  command: "bunx --bun", commandParam: "bun" },
          { name: "pnpm", command: "pnpm dlx",   commandParam: "pnpm" },
          { name: "yarn", command: "yarn dlx",   commandParam: "yarn" },
        ],
      },
      {
        type: "shadcn",
        name: "shadcn/ui + Tailwind",
        command: "{PACKAGE_MANAGER.command} create-tsrouter-app@latest {PROJECT_NAME} --template file-router --tailwind --add-ons shadcn",
        supportedPackageManagers: [
          { name: "bun",  command: "bunx --bun", commandParam: "bun" },
          { name: "pnpm", command: "pnpm dlx",   commandParam: "pnpm" },
          { name: "yarn", command: "yarn dlx",   commandParam: "yarn" },
        ],
      },
    ],
  },
  {
    id: "astro",
    name: "Astro",
    description: "Content-focused web framework with island architecture",
    hidden: false,
    variants: [
      {
        type: "default",
        name: "Default",
        command: "{PACKAGE_MANAGER.command} create-astro@latest {PROJECT_NAME}",
        supportedPackageManagers: [
          { name: "bun",  command: "bunx --bun", commandParam: "bun" },
          { name: "pnpm", command: "pnpm dlx",   commandParam: "pnpm" },
          { name: "yarn", command: "yarn dlx",   commandParam: "yarn" },
        ],
      },
      {
        type: "tailwind-react",
        name: "Tailwind + React",
        command: "{PACKAGE_MANAGER.command} create-astro@latest {PROJECT_NAME} -- --template with-tailwindcss --install --add react --git",
        supportedPackageManagers: [
          { name: "bun",  command: "bunx --bun", commandParam: "bun" },
          { name: "pnpm", command: "pnpm dlx",   commandParam: "pnpm" },
          { name: "yarn", command: "yarn dlx",   commandParam: "yarn" },
        ],
      },
    ],
  },
  {
    id: "sveltekit",
    name: "SvelteKit",
    description: "Full-stack framework built on Svelte",
    hidden: false,
    variants: [
      {
        type: "default",
        name: "Default",
        command: "{PACKAGE_MANAGER.command} sv@latest create {PROJECT_NAME}",
        supportedPackageManagers: [
          { name: "bun",  command: "bunx --bun", commandParam: "bun" },
          { name: "pnpm", command: "pnpm dlx",   commandParam: "pnpm" },
          { name: "yarn", command: "yarn dlx",   commandParam: "yarn" },
        ],
      },
    ],
  },
  {
    id: "remix",
    name: "Remix",
    description: "Full-stack web framework focused on web standards",
    hidden: false,
    variants: [
      {
        type: "default",
        name: "Default",
        command: "{PACKAGE_MANAGER.command} create-remix@latest {PROJECT_NAME}",
        supportedPackageManagers: [
          { name: "bun",  command: "bunx --bun", commandParam: "bun" },
          { name: "pnpm", command: "pnpm dlx",   commandParam: "pnpm" },
          { name: "yarn", command: "yarn dlx",   commandParam: "yarn" },
        ],
      },
    ],
  },
  {
    id: "hono",
    name: "Hono",
    description: "Fast, lightweight web framework for the Edge",
    hidden: false,
    variants: [
      {
        type: "default",
        name: "Default",
        command: "{PACKAGE_MANAGER.command} create-hono@latest {PROJECT_NAME}",
        supportedPackageManagers: [
          { name: "bun",  command: "bunx --bun", commandParam: "bun" },
          { name: "pnpm", command: "pnpm dlx",   commandParam: "pnpm" },
          { name: "yarn", command: "yarn dlx",   commandParam: "yarn" },
        ],
      },
    ],
  },
  {
    id: "elysia",
    name: "Elysia",
    description: "Ergonomic TypeScript framework for Bun (Bun only)",
    hidden: false,
    variants: [
      {
        type: "default",
        name: "Default",
        command: "{PACKAGE_MANAGER.command} elysia@latest {PROJECT_NAME}",
        supportedPackageManagers: [
          { name: "bun", command: "bun create", commandParam: "bun" },
        ],
      },
    ],
  },
  {
    id: "expo",
    name: "Expo",
    description: "React Native framework for iOS and Android",
    hidden: false,
    variants: [
      {
        type: "default",
        name: "Default",
        command: "{PACKAGE_MANAGER.command} create-expo-app@latest {PROJECT_NAME}",
        supportedPackageManagers: [
          { name: "bun",  command: "bunx --bun", commandParam: "bun" },
          { name: "pnpm", command: "pnpm dlx",   commandParam: "pnpm" },
          { name: "yarn", command: "yarn dlx",   commandParam: "yarn" },
        ],
      },
    ],
  },
  {
    id: "tauri",
    name: "Tauri",
    description: "Build desktop apps with web frontend and Rust backend",
    hidden: false,
    variants: [
      {
        type: "default",
        name: "Default",
        command: "{PACKAGE_MANAGER.command} create-tauri-app@latest {PROJECT_NAME}",
        supportedPackageManagers: [
          { name: "bun",  command: "bunx --bun", commandParam: "bun" },
          { name: "pnpm", command: "pnpm dlx",   commandParam: "pnpm" },
          { name: "yarn", command: "yarn dlx",   commandParam: "yarn" },
        ],
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function builtinTemplatesPath(): string {
  return join(homedir(), ".config", "wd", "templates-builtin.json");
}

async function writeBuiltinTemplates(templates: unknown[]): Promise<string> {
  const filePath = builtinTemplatesPath();
  await mkdir(join(homedir(), ".config", "wd"), { recursive: true });
  await Bun.write(filePath, JSON.stringify(templates, null, 2));
  return filePath;
}

// ─── Migration definitions ────────────────────────────────────────────────────
// To add migration N+1:
//   1. Add { version: N+1, description: "...", up: async (config) => { ... } }
//   2. Update LATEST_MIGRATION_VERSION

export const LATEST_MIGRATION_VERSION = 1;

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "Add projectConstructor config with built-in templates",
    async up(config: Config): Promise<Config> {
      // Write built-in templates to ~/.config/wd/templates-builtin.json
      const filePath = await writeBuiltinTemplates(BUILTIN_TEMPLATES_V1);

      // Set gistUrl in config to the local file:// path
      return {
        ...config,
        projectConstructor: {
          ...config.projectConstructor,
          templates: {
            ...config.projectConstructor.templates,
            // Only set if not already pointing to a real URL (don't overwrite user's custom gist)
            gistUrl:
              config.projectConstructor.templates.gistUrl &&
              !config.projectConstructor.templates.gistUrl.startsWith("file://")
                ? config.projectConstructor.templates.gistUrl
                : `file://${filePath}`,
          },
        },
      };
    },
  },

  // ── Template for future migrations ─────────────────────────────────────────
  // {
  //   version: 2,
  //   description: "Update built-in templates with new frameworks",
  //   async up(config: Config): Promise<Config> {
  //     await writeBuiltinTemplates(BUILTIN_TEMPLATES_V2);
  //     return config; // gistUrl already set from migration 1
  //   },
  // },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Apply all pending migrations silently.
 * - Loads current config (if it exists)
 * - Runs migrations with version > config.configVersion
 * - Saves the updated config
 * - Returns the (potentially updated) config
 *
 * Returns null if no config exists (user hasn't run setup yet).
 */
export async function runPendingMigrations(): Promise<Config | null> {
  const config = await loadConfig();
  if (!config) return null;

  const currentVersion = config.configVersion ?? 0;
  if (currentVersion >= LATEST_MIGRATION_VERSION) return config;

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);
  if (pending.length === 0) return config;

  let updated = config;
  for (const migration of pending) {
    try {
      updated = await migration.up(updated);
      updated = { ...updated, configVersion: migration.version };
    } catch {
      // Silently skip failed migrations — don't crash the user's workflow
      break;
    }
  }

  await saveConfig(updated);
  return updated;
}
