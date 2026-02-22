/**
 * Template loading: gist fetch + custom local templates + merge.
 * Custom template IDs must not collide with gist template IDs.
 */
import { readdir } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { paths } from "../config/paths";
import { TemplateSchema, type Template, type TemplateCache } from "../config/schema";
import {
  loadTemplateCache,
  saveTemplateCache,
  isTemplateCacheStale,
} from "./template-cache";

// ─── Template source fetch ────────────────────────────────────────────────────

/**
 * Fetch templates from a URL.
 * Supports:
 *   - file:///absolute/path/to/templates.json  (local file, used for built-ins)
 *   - https://...  (remote gist or raw JSON URL)
 */
async function fetchGistTemplates(gistUrl: string): Promise<Template[]> {
  if (!gistUrl) return [];
  try {
    let raw: unknown;

    if (gistUrl.startsWith("file://")) {
      // Local file — strip "file://" prefix and read directly
      const filePath = gistUrl.slice("file://".length);
      const file = Bun.file(filePath);
      if (!(await file.exists())) return [];
      raw = await file.json();
    } else {
      const resp = await fetch(gistUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      raw = await resp.json();
    }

    // Accept either a JSON array or { templates: [...] }
    const data = Array.isArray(raw)
      ? raw
      : ((raw as { templates?: unknown[] }).templates ?? []);

    return data
      .map((t: unknown) => {
        try {
          return TemplateSchema.parse(t);
        } catch {
          return null;
        }
      })
      .filter((t): t is Template => t !== null);
  } catch {
    return [];
  }
}

// ─── Custom template loading ──────────────────────────────────────────────────

async function loadCustomTemplates(): Promise<Template[]> {
  try {
    await mkdir(paths.templatesDir, { recursive: true });
    const files = await readdir(paths.templatesDir);
    const templates: Template[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const f = Bun.file(`${paths.templatesDir}/${file}`);
        const raw = await f.json();
        const parsed = TemplateSchema.parse(raw);
        templates.push(parsed);
      } catch {
        // skip invalid files
      }
    }
    return templates;
  } catch {
    return [];
  }
}

// ─── ID collision check ───────────────────────────────────────────────────────

export interface CollisionError {
  type: "collision";
  id: string;
  gistName: string;
  customName: string;
}

function checkCollisions(
  gistTemplates: Template[],
  customTemplates: Template[]
): CollisionError[] {
  const errors: CollisionError[] = [];
  const gistById = new Map(gistTemplates.map((t) => [t.id, t]));
  for (const custom of customTemplates) {
    const gist = gistById.get(custom.id);
    if (gist) {
      errors.push({
        type: "collision",
        id: custom.id,
        gistName: gist.name,
        customName: custom.name,
      });
    }
  }
  return errors;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface LoadTemplatesResult {
  templates: Template[];
  collisions: CollisionError[];
  fromCache: boolean;
  cacheStale: boolean;
}

export async function loadTemplates(opts: {
  gistUrl?: string;
  forceRefresh?: boolean;
}): Promise<LoadTemplatesResult> {
  const gistUrl = opts.gistUrl ?? "";

  // Load custom templates
  const customTemplates = await loadCustomTemplates();

  // Try cache first
  const cached = await loadTemplateCache();
  const needsFetch =
    opts.forceRefresh ||
    !cached ||
    cached.gistUrl !== gistUrl ||
    isTemplateCacheStale(cached);

  let gistTemplates: Template[] = [];
  let fromCache = false;
  let cacheStale = false;

  if (!needsFetch && cached) {
    gistTemplates = cached.templates;
    fromCache = true;
    cacheStale = false;
  } else if (gistUrl) {
    // Attempt fetch
    gistTemplates = await fetchGistTemplates(gistUrl);

    if (gistTemplates.length > 0) {
      const newCache: TemplateCache = {
        version: 1,
        lastFetch: new Date().toISOString(),
        gistUrl,
        templates: gistTemplates,
      };
      await saveTemplateCache(newCache);
    } else if (cached && cached.gistUrl === gistUrl) {
      // Offline fallback: use stale cache
      gistTemplates = cached.templates;
      fromCache = true;
      cacheStale = true;
    }
  }

  // Check for ID collisions
  const collisions = checkCollisions(gistTemplates, customTemplates);

  // Merge: custom templates appended after gist templates
  const allTemplates = [...gistTemplates, ...customTemplates];

  return {
    templates: allTemplates,
    collisions,
    fromCache,
    cacheStale,
  };
}

/**
 * Background refresh for template cache (fire-and-forget).
 * Called after `wd scan` finishes.
 */
export async function refreshTemplateCacheBackground(
  gistUrl: string
): Promise<void> {
  if (!gistUrl) return;
  try {
    const templates = await fetchGistTemplates(gistUrl);
    if (templates.length > 0) {
      const cache: TemplateCache = {
        version: 1,
        lastFetch: new Date().toISOString(),
        gistUrl,
        templates,
      };
      await saveTemplateCache(cache);
    }
  } catch {
    // Silently ignore background refresh failures
  }
}
