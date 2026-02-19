import type { CustomType } from "../config/schema";

interface DetectorRule {
  type: string;
  markers: string[];
  patterns?: RegExp[];
}

// Built-in rules — order matters: most specific first
const BUILTIN_RULES: DetectorRule[] = [
  // Tauri: has src-tauri subdirectory
  { type: "tauri", markers: ["src-tauri"] },
  // Flutter: pubspec.yaml is definitive
  { type: "flutter", markers: ["pubspec.yaml"] },
  // Swift: Package.swift or *.xcodeproj / *.xcworkspace
  {
    type: "swift",
    markers: [],
    patterns: [/\.xcodeproj$/, /\.xcworkspace$/, /^Package\.swift$/],
  },
  // Rust: Cargo.toml
  { type: "rust", markers: ["Cargo.toml"] },
  // Angular: angular.json is definitive
  { type: "angular", markers: ["angular.json"] },
  // NestJS: nest-cli.json is definitive
  { type: "nestjs", markers: ["nest-cli.json"] },
  // Next.js: next.config.* (ts, js, mjs)
  {
    type: "nextjs",
    markers: [],
    patterns: [/^next\.config\.(ts|js|mjs)$/],
  },
  // Bun: bunfig.toml
  { type: "bun", markers: ["bunfig.toml"] },
  // Generic Node: package.json
  { type: "node", markers: ["package.json"] },
  // Python
  {
    type: "python",
    markers: [],
    patterns: [/^(pyproject\.toml|setup\.py|requirements\.txt)$/],
  },
];

function matchRule(rule: DetectorRule, files: string[], fileSet: Set<string>): boolean {
  const markersPresent = rule.markers.every((m) => fileSet.has(m));
  if (!markersPresent) return false;

  if (!rule.patterns || rule.patterns.length === 0) {
    return rule.markers.length > 0;
  }

  return rule.patterns.some((p) => files.some((f) => p.test(f)));
}

function buildCustomRules(customTypes: CustomType[]): DetectorRule[] {
  return customTypes.map((ct) => ({
    type: ct.name,
    markers: ct.markers,
    patterns: ct.patterns.map((p) => {
      try {
        return new RegExp(p);
      } catch {
        return /(?!)/; // Never matches on invalid regex
      }
    }),
  }));
}

export function detectProjectType(files: string[], customTypes: CustomType[] = []): string {
  const fileSet = new Set(files);

  // Check built-in rules first (highest priority)
  for (const rule of BUILTIN_RULES) {
    if (matchRule(rule, files, fileSet)) return rule.type;
  }

  // Then check custom rules (lowest priority)
  const customRules = buildCustomRules(customTypes);
  for (const rule of customRules) {
    if (matchRule(rule, files, fileSet)) return rule.type;
  }

  return "unknown";
}

const BUILTIN_PROJECT_MARKERS = new Set([
  "package.json",
  "pubspec.yaml",
  "Cargo.toml",
  "Package.swift",
  "angular.json",
  "nest-cli.json",
  "pyproject.toml",
  "setup.py",
  "requirements.txt",
  "bunfig.toml",
]);

const BUILTIN_PATTERN_MARKERS = [
  /\.xcodeproj$/,
  /\.xcworkspace$/,
  /^next\.config\.(ts|js|mjs)$/,
];

export function isProjectDirectory(files: string[], customTypes: CustomType[] = []): boolean {
  // Built-in markers
  for (const f of files) {
    if (BUILTIN_PROJECT_MARKERS.has(f)) return true;
    if (BUILTIN_PATTERN_MARKERS.some((p) => p.test(f))) return true;
  }

  // Special cases
  if (files.includes(".git")) return true;
  if (files.includes("src-tauri")) return true;

  // Custom type markers
  const fileSet = new Set(files);
  for (const ct of customTypes) {
    if (ct.markers.length > 0 && ct.markers.every((m) => fileSet.has(m))) return true;
    if (ct.patterns.length > 0) {
      const regexes = ct.patterns.flatMap((p) => {
        try { return [new RegExp(p)]; } catch { return []; }
      });
      if (regexes.some((r) => files.some((f) => r.test(f)))) return true;
    }
  }

  return false;
}

const COMPOSE_PATTERNS = [
  /^docker-compose\.ya?ml$/,
  /^docker-compose\..+\.ya?ml$/,
  /^compose\.ya?ml$/,
];

export function detectDockerCompose(files: string[]): string[] | undefined {
  const matches = files.filter((f) => COMPOSE_PATTERNS.some((p) => p.test(f)));
  return matches.length > 0 ? matches : undefined;
}
