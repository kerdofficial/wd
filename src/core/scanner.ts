import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import type { CustomType, ProjectEntry, ScanRoot } from "../config/schema";
import { detectDockerCompose, detectProjectType, isProjectDirectory } from "./detector";
import { pathExists } from "../utils/fs";

const DEFAULT_IGNORE = new Set([
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
]);

/**
 * Simple semaphore to bound concurrent readdir calls.
 */
class Semaphore {
  private queue: (() => void)[] = [];
  private count: number;

  constructor(max: number) {
    this.count = max;
  }

  acquire(): Promise<void> {
    if (this.count > 0) {
      this.count--;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.count++;
    }
  }
}

export interface ScanOptions {
  ignore?: string[];
  customTypes?: CustomType[];
  onProgress?: (found: number) => void;
}

export async function scanProjects(
  roots: ScanRoot[],
  options: ScanOptions = {}
): Promise<ProjectEntry[]> {
  const customTypes = options.customTypes ?? [];
  const ignoreSet = new Set([
    ...DEFAULT_IGNORE,
    ...(options.ignore ?? []),
  ]);

  const projects: ProjectEntry[] = [];
  const sem = new Semaphore(20);
  let found = 0;

  async function walk(
    dir: string,
    depth: number,
    maxDepth: number,
    root: ScanRoot
  ): Promise<void> {
    if (depth > maxDepth) return;

    await sem.acquire();
    let entries: { name: string; isDirectory(): boolean }[];
    try {
      const raw = await readdir(dir, { withFileTypes: true });
      entries = raw as unknown as { name: string; isDirectory(): boolean }[];
    } catch {
      return;
    } finally {
      sem.release();
    }

    const fileNames = entries.map((e) => e.name);

    if (depth > 0 && isProjectDirectory(fileNames, customTypes)) {
      const type = detectProjectType(fileNames, customTypes);
      const composeFiles = detectDockerCompose(fileNames);
      projects.push({
        name: basename(dir),
        path: dir,
        type,
        category: root.category,
        label: root.label,
        docker: composeFiles ? { composeFiles } : undefined,
        hasGit: fileNames.includes(".git"),
        parentDir: basename(join(dir, "..")),
      });
      found++;
      options.onProgress?.(found);
      return; // Don't recurse into project directories
    }

    const subdirs = entries.filter(
      (e) => e.isDirectory() && !ignoreSet.has(e.name) && !e.name.startsWith(".")
    );

    await Promise.all(
      subdirs.map((sub) =>
        walk(join(dir, sub.name), depth + 1, maxDepth, root)
      )
    );
  }

  await Promise.all(
    roots.map(async (root) => {
      if (!(await pathExists(root.path))) {
        console.warn(
          `  Warning: ${root.label ?? root.path} is not accessible (drive may not be mounted)`
        );
        return;
      }
      await walk(root.path, 0, root.maxDepth, root);
    })
  );

  return projects;
}
