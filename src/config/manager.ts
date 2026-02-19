import { mkdir } from "node:fs/promises";
import { paths } from "./paths";
import {
  type Cache,
  CacheSchema,
  type Config,
  ConfigSchema,
  type History,
  HistorySchema,
  type Workspace,
  WorkspaceSchema,
} from "./schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function readJson<T>(
  filePath: string,
  parser: (raw: unknown) => T
): Promise<T | null> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;
  try {
    const raw = await file.json();
    return parser(raw);
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await Bun.write(filePath, JSON.stringify(data, null, 2));
}

// ─── Config ──────────────────────────────────────────────────────────────────

export async function loadConfig(): Promise<Config | null> {
  return readJson(paths.config, (raw) => ConfigSchema.parse(raw));
}

export async function requireConfig(): Promise<Config> {
  const config = await loadConfig();
  if (!config) {
    console.error(
      'wd is not configured yet. Run "wd setup" to get started.'
    );
    process.exit(1);
  }
  return config;
}

export async function saveConfig(config: Config): Promise<void> {
  await ensureDir(paths.configDir);
  await writeJson(paths.config, config);
}

// ─── Cache ───────────────────────────────────────────────────────────────────

export async function loadCache(): Promise<Cache | null> {
  return readJson(paths.cache, (raw) => CacheSchema.parse(raw));
}

export async function saveCache(cache: Cache): Promise<void> {
  await ensureDir(paths.configDir);
  await writeJson(paths.cache, cache);
}

export function isCacheStale(cache: Cache, maxAgeMs = 24 * 60 * 60 * 1000): boolean {
  const lastScan = new Date(cache.lastScan).getTime();
  return Date.now() - lastScan > maxAgeMs;
}

// ─── History ─────────────────────────────────────────────────────────────────

export async function loadHistory(): Promise<History> {
  const h = await readJson(paths.history, (raw) => HistorySchema.parse(raw));
  return h ?? { version: 1, entries: [] };
}

export async function saveHistory(history: History): Promise<void> {
  await ensureDir(paths.configDir);
  await writeJson(paths.history, history);
}

// ─── Workspaces ──────────────────────────────────────────────────────────────

export async function loadWorkspace(name: string): Promise<Workspace | null> {
  return readJson(paths.workspace(name), (raw) => WorkspaceSchema.parse(raw));
}

export async function saveWorkspace(workspace: Workspace): Promise<void> {
  await ensureDir(paths.workspacesDir);
  await writeJson(paths.workspace(workspace.name), workspace);
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const dir = Bun.file(paths.workspacesDir);
  // Use readdir via node:fs
  const { readdir } = await import("node:fs/promises");
  let files: string[];
  try {
    files = await readdir(paths.workspacesDir);
  } catch {
    return [];
  }

  const workspaces: Workspace[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const name = file.replace(/\.json$/, "");
    const ws = await loadWorkspace(name);
    if (ws) workspaces.push(ws);
  }
  return workspaces.sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteWorkspace(name: string): Promise<boolean> {
  const { unlink } = await import("node:fs/promises");
  try {
    await unlink(paths.workspace(name));
    return true;
  } catch {
    return false;
  }
}

// ─── First run setup ─────────────────────────────────────────────────────────

export async function initConfigDir(): Promise<void> {
  await ensureDir(paths.configDir);
  await ensureDir(paths.workspacesDir);
}
