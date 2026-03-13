/**
 * Interpolation engine for template commands.
 * Supports {PLACEHOLDER.nested.path} syntax.
 */

// ─── Path resolution ──────────────────────────────────────────────────────────

function resolvePath(obj: unknown, parts: string[]): unknown {
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ─── Core interpolate ─────────────────────────────────────────────────────────

export function interpolate(
  template: string,
  context: Record<string, unknown>
): string {
  return template.replace(/\{([^}]+)\}/g, (match, path: string) => {
    const parts = path.split(".");
    const value = resolvePath(context, parts);
    if (value === undefined || value === null) return match; // leave unresolved
    return String(value);
  });
}

// ─── Extract placeholders ─────────────────────────────────────────────────────

export function extractPlaceholders(template: string): string[] {
  const matches = template.match(/\{([^}]+)\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1, -1)))];
}

// ─── Validate placeholders ────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  missing: string[];
}

export function validatePlaceholders(
  template: string,
  context: Record<string, unknown>
): ValidationResult {
  const placeholders = extractPlaceholders(template);
  const missing: string[] = [];

  for (const placeholder of placeholders) {
    const parts = placeholder.split(".");
    const value = resolvePath(context, parts);
    if (value === undefined || value === null) {
      missing.push(placeholder);
    }
  }

  return { valid: missing.length === 0, missing };
}
