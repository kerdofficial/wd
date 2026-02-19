import type { CustomType, ProjectEntry, ProjectType } from "../config/schema";

// ─── ANSI colors ─────────────────────────────────────────────────────────────

export const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
};

export function dim(s: string): string {
  return `${c.dim}${s}${c.reset}`;
}
export function bold(s: string): string {
  return `${c.bold}${s}${c.reset}`;
}
export function cyan(s: string): string {
  return `${c.cyan}${s}${c.reset}`;
}
export function green(s: string): string {
  return `${c.green}${s}${c.reset}`;
}
export function yellow(s: string): string {
  return `${c.yellow}${s}${c.reset}`;
}
export function blue(s: string): string {
  return `${c.blue}${s}${c.reset}`;
}
export function magenta(s: string): string {
  return `${c.magenta}${s}${c.reset}`;
}
export function red(s: string): string {
  return `${c.red}${s}${c.reset}`;
}
export function gray(s: string): string {
  return `${c.gray}${s}${c.reset}`;
}

// ─── Project type display ─────────────────────────────────────────────────────

const BUILTIN_COLORS: Record<string, (s: string) => string> = {
  nextjs: cyan,
  nestjs: red,
  angular: red,
  flutter: blue,
  tauri: yellow,
  swift: magenta,
  rust: yellow,
  react: cyan,
  vue: green,
  node: green,
  python: yellow,
  bun: yellow,
  unknown: gray,
};

const BUILTIN_LABELS: Record<string, string> = {
  nextjs: "Next.js",
  nestjs: "NestJS",
  angular: "Angular",
  flutter: "Flutter",
  tauri: "Tauri",
  swift: "Swift",
  rust: "Rust",
  react: "React",
  vue: "Vue",
  node: "Node",
  python: "Python",
  bun: "Bun",
  unknown: "?",
};

const COLOR_FN_MAP: Record<string, (s: string) => string> = {
  cyan,
  green,
  yellow,
  blue,
  magenta,
  red,
  gray,
  white: (s) => s,
};

// Registry for custom types — populated at runtime via registerCustomTypes()
const customTypeRegistry = new Map<string, CustomType>();

export function registerCustomTypes(types: CustomType[]): void {
  customTypeRegistry.clear();
  for (const t of types) {
    customTypeRegistry.set(t.name, t);
  }
}

function getTypeColor(type: ProjectType): (s: string) => string {
  if (BUILTIN_COLORS[type]) return BUILTIN_COLORS[type]!;
  const custom = customTypeRegistry.get(type);
  if (custom) return COLOR_FN_MAP[custom.color] ?? cyan;
  return gray; // Unknown custom type
}

function getTypeLabel(type: ProjectType): string {
  if (BUILTIN_LABELS[type]) return BUILTIN_LABELS[type]!;
  return type; // Use the type name directly for custom types
}

export function typeBadge(type: ProjectType): string {
  const label = getTypeLabel(type);
  const color = getTypeColor(type);
  return color(`[${label}]`);
}

export function typeLabel(type: ProjectType): string {
  return getTypeLabel(type);
}

// ─── Project display ─────────────────────────────────────────────────────────

/** Format a project for display in the selector (plain, no ANSI - inquirer handles coloring) */
export function formatProjectName(project: ProjectEntry): string {
  const parts: string[] = [project.name];
  if (project.parentDir && project.parentDir !== project.name) {
    parts.push(`  ${typeLabel(project.type)}`);
    if (project.label) {
      parts.push(`  ${project.label}/${project.parentDir}`);
    }
  } else if (project.label) {
    parts.push(`  ${typeLabel(project.type)}`);
    parts.push(`  ${project.label}`);
  }
  return parts.join("");
}

/** Format project for display in terminal output (with ANSI) */
export function formatProjectLine(project: ProjectEntry): string {
  const name = bold(project.name);
  const badge = typeBadge(project.type);
  const location = project.label
    ? gray(`${project.label}/${project.parentDir}`)
    : gray(project.parentDir);
  return `  ${name}  ${badge}  ${location}`;
}

// ─── Header / clear ──────────────────────────────────────────────────────────

const ASCII_LOGO = `
db   d8b   db d8888b. 
88   I8I   88 88  \`8D 
88   I8I   88 88   88 
Y8   I8I   88 88   88 
\`8b d8'8b d8' 88  .8D 
 \`8b8' \`8d8'  Y8888D' 
`;

export function printHeader(): void {
  console.log(cyan(ASCII_LOGO));
  console.log(gray("   Workspace Director\n"));
}

export function clearScreen(): void {
  console.clear();
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Spinner {
  private frame = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private text: string;

  constructor(text: string) {
    this.text = text;
  }

  start(): void {
    process.stdout.write("\x1b[?25l"); // Hide cursor
    this.timer = setInterval(() => {
      const frame = SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length] ?? "⠋";
      process.stdout.write(`\r${cyan(frame)} ${this.text}`);
      this.frame++;
    }, 80);
  }

  update(text: string): void {
    this.text = text;
  }

  stop(finalText?: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    process.stdout.write("\r\x1b[K"); // Clear line
    process.stdout.write("\x1b[?25h"); // Show cursor
    if (finalText) {
      console.log(finalText);
    }
  }
}
