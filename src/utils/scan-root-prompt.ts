import { input, number } from "@inquirer/prompts";
import type { ScanRoot } from "../config/schema";
import { pathExists, isDirectory } from "./fs";

export async function addScanRoot(existing: ScanRoot[]): Promise<ScanRoot | null> {
  console.log();
  const rawPath = await input({
    message: "Directory path to scan:",
    validate: async (val) => {
      if (!val.trim()) return "Path cannot be empty";
      if (!(await pathExists(val.trim()))) return `Path does not exist: ${val}`;
      if (!(await isDirectory(val.trim()))) return `Not a directory: ${val}`;
      if (existing.some((r) => r.path === val.trim())) return "Already added";
      return true;
    },
  });

  const dirPath = rawPath.trim();
  const defaultLabel = dirPath.split("/").at(-1) ?? "Projects";

  const label = await input({
    message: "Label for this root:",
    default: defaultLabel,
  });

  const category = await input({
    message: "Category (for grouping):",
    default: label.toLowerCase(),
  });

  const maxDepth = await number({
    message: "Max scan depth (how deep to look for projects):",
    default: 3,
    min: 1,
    max: 6,
  });

  return {
    path: dirPath,
    label,
    category,
    maxDepth: maxDepth ?? 3,
  };
}
