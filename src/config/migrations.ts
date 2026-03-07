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
import { loadConfig, saveConfig } from "./manager";
import type { Config } from "./schema";

// ─── Migration interface ──────────────────────────────────────────────────────

interface Migration {
  version: number;
  description: string;
  up: (config: Config) => Promise<Config>;
}

// ─── Migration definitions ────────────────────────────────────────────────────
// To add migration N+1:
//   1. Add { version: N+1, description: "...", up: async (config) => { ... } }
//   2. Update LATEST_MIGRATION_VERSION

export const LATEST_MIGRATION_VERSION = 1;

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "Add projectConstructor config",
    async up(config: Config): Promise<Config> {
      // Templates are now loaded from TEMPLATES_SOURCE_URL in src/core/templates.ts.
      // No local file writing needed — editing the source JSON is sufficient.
      return config;
    },
  },
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
