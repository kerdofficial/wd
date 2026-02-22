import { z } from "zod";

// ─── Scan root ───────────────────────────────────────────────────────────────

export const ScanRootSchema = z.object({
  path: z.string(),
  label: z.string().optional(),
  maxDepth: z.number().default(3),
  category: z.string().optional(),
});

export type ScanRoot = z.infer<typeof ScanRootSchema>;

// ─── Custom project types ─────────────────────────────────────────────────────

export const CustomTypeColorSchema = z.enum([
  "cyan",
  "green",
  "yellow",
  "blue",
  "magenta",
  "red",
  "gray",
  "white",
]);

export const CustomTypeSchema = z.object({
  name: z.string(), // Display name, e.g. "Django"
  markers: z.array(z.string()).default([]), // Files that must exist, e.g. ["manage.py"]
  patterns: z.array(z.string()).default([]), // Regex strings, e.g. ["^Gemfile$"]
  color: CustomTypeColorSchema.default("cyan"),
});

export type CustomType = z.infer<typeof CustomTypeSchema>;
export type CustomTypeColor = z.infer<typeof CustomTypeColorSchema>;

// ─── Main config ─────────────────────────────────────────────────────────────

export const ConfigSchema = z.object({
  version: z.literal(1),
  /**
   * Migration version: tracks which silent config migrations have been applied.
   * Default 0 means no migrations have run yet.
   */
  configVersion: z.number().default(0),
  scanRoots: z.array(ScanRootSchema).default([]),
  customTypes: z.array(CustomTypeSchema).default([]),
  preferences: z
    .object({
      showProjectType: z.boolean().default(true),
      showCategory: z.boolean().default(true),
      maxRecent: z.number().default(20),
      scanIgnore: z
        .array(z.string())
        .default([
          "node_modules",
          ".git",
          "dist",
          "build",
          ".next",
          ".angular",
          "target",
          ".dart_tool",
          "Pods",
          ".build",
          "DerivedData",
          ".cache",
        ]),
    })
    .default({}),
  projectConstructor: z
    .object({
      templates: z
        .object({
          /**
           * URL for fetching built-in templates.
           * Supports https:// (gist/raw JSON) and file:// (local path).
           */
          gistUrl: z.string().default(""),
        })
        .default({}),
    })
    .default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

// ─── Project entry (cache) ───────────────────────────────────────────────────

// Open string type: built-in IDs + any custom type name
export const ProjectTypeSchema = z.string();
export type ProjectType = string;

// The built-in type IDs (for display lookup)
export const BUILTIN_PROJECT_TYPES = [
  "nextjs",
  "nestjs",
  "angular",
  "flutter",
  "tauri",
  "swift",
  "rust",
  "react",
  "vue",
  "node",
  "python",
  "bun",
  "unknown",
] as const;
export type BuiltinProjectType = (typeof BUILTIN_PROJECT_TYPES)[number];

export const DockerInfoSchema = z.object({
  composeFiles: z.array(z.string()),
});

export const ProjectEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: ProjectTypeSchema,
  category: z.string().optional(),
  label: z.string().optional(),
  docker: DockerInfoSchema.optional(),
  hasGit: z.boolean(),
  parentDir: z.string(),
});

export type ProjectEntry = z.infer<typeof ProjectEntrySchema>;

export const CacheSchema = z.object({
  version: z.literal(1),
  lastScan: z.string(),
  projects: z.array(ProjectEntrySchema),
});

export type Cache = z.infer<typeof CacheSchema>;

// ─── History / frecency ──────────────────────────────────────────────────────

export const HistoryEntrySchema = z.object({
  path: z.string(),
  visits: z.array(z.number()),
});

export const HistorySchema = z.object({
  version: z.literal(1),
  entries: z.array(HistoryEntrySchema),
});

export type History = z.infer<typeof HistorySchema>;
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

// ─── Templates ───────────────────────────────────────────────────────────────

export const PackageManagerSchema = z.object({
  name: z.string(),
  command: z.string(), // e.g. "bunx --bun", "pnpm dlx"
  commandParam: z.string(), // e.g. "bun", "npm"
});

export const WizardParameterSchema = z.object({
  default: z.string(), // long flag name: "base-color"
  shorthand: z.string(), // short flag: "bc"
});

export const AdditionalParameterSchema = z.object({
  id: z.string(),
  wizardParameter: WizardParameterSchema.optional(),
  optional: z.boolean(),
  description: z.string(),
  type: z.enum(["select", "multi-select", "input"]),
  multiSelectDivider: z.string().optional(),
  allowedInputValues: z.union([z.string(), z.number(), z.boolean()]).optional(),
  options: z.array(z.string()).optional(),
  parameterKey: z.string(), // interpolation key: "BASE_COLOR"
});

export const VariantSchema = z.object({
  type: z.string(), // "default" always present
  name: z.string(),
  command: z.string(), // shell command with placeholders
  supportedPackageManagers: z.array(PackageManagerSchema).min(1),
  additionalParameters: z.array(AdditionalParameterSchema).optional(),
  postCreateCommands: z.array(z.string()).optional(),
});

export const TemplateSchema = z.object({
  id: z.string(),
  hidden: z.boolean().default(false),
  name: z.string(),
  description: z.string().optional(),
  variants: z.array(VariantSchema).min(1),
});

export const TemplateCacheSchema = z.object({
  version: z.literal(1),
  lastFetch: z.string(),
  gistUrl: z.string(),
  templates: z.array(TemplateSchema),
});

export type PackageManager = z.infer<typeof PackageManagerSchema>;
export type WizardParameter = z.infer<typeof WizardParameterSchema>;
export type AdditionalParameter = z.infer<typeof AdditionalParameterSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type Template = z.infer<typeof TemplateSchema>;
export type TemplateCache = z.infer<typeof TemplateCacheSchema>;

// ─── Workspace ───────────────────────────────────────────────────────────────

export const WorkspaceTabSchema = z.object({
  command: z.string().optional(),
});

export const WorkspaceProjectSchema = z.object({
  path: z.string(),
  isPrimary: z.boolean().default(false),
  tabs: z.array(WorkspaceTabSchema).optional(),
});

export const WorkspaceDockerSchema = z.object({
  containers: z.array(z.string()).default([]),
  compose: z
    .object({
      path: z.string(),
      file: z.string(),
    })
    .optional(),
});

export const WorkspaceSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  name: z.string(),
  description: z.string().optional(),
  projects: z.array(WorkspaceProjectSchema).min(1),
  docker: WorkspaceDockerSchema.optional(),
});

export type WorkspaceTab = z.infer<typeof WorkspaceTabSchema>;
export type WorkspaceProject = z.infer<typeof WorkspaceProjectSchema>;
export type WorkspaceDocker = z.infer<typeof WorkspaceDockerSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
