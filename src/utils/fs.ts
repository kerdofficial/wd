import { access } from "node:fs/promises";

export async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(p: string): Promise<boolean> {
  const { stat } = await import("node:fs/promises");
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}
