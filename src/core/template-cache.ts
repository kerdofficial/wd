/**
 * Template cache I/O + 24h TTL management.
 */
import { paths } from "../config/paths";
import { TemplateCacheSchema, type TemplateCache } from "../config/schema";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Load / save ─────────────────────────────────────────────────────────────

export async function loadTemplateCache(): Promise<TemplateCache | null> {
  const file = Bun.file(paths.templateCache);
  if (!(await file.exists())) return null;
  try {
    const raw = await file.json();
    return TemplateCacheSchema.parse(raw);
  } catch {
    return null;
  }
}

export async function saveTemplateCache(cache: TemplateCache): Promise<void> {
  await Bun.write(paths.templateCache, JSON.stringify(cache, null, 2));
}

// ─── Staleness ───────────────────────────────────────────────────────────────

export function isTemplateCacheStale(
  cache: TemplateCache,
  maxAgeMs = CACHE_TTL_MS
): boolean {
  const lastFetch = new Date(cache.lastFetch).getTime();
  return Date.now() - lastFetch > maxAgeMs;
}
