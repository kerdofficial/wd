import { $ } from "bun";

export function posixShellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

export function buildPosixCmd(cwd: string, command?: string): string {
  return command
    ? `cd ${posixShellQuote(cwd)} && ${command}`
    : `cd ${posixShellQuote(cwd)}`;
}

export function appleScriptQuote(s: string): string {
  const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export async function runOsascript(script: string): Promise<void> {
  try {
    await $`osascript -e ${script}`.quiet();
  } catch {
    // best effort
  }
}

export async function commandExists(cmd: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", cmd], {
      stdout: "ignore",
      stderr: "ignore",
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}
