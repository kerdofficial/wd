import { $ } from "bun";
import type { TerminalAdapter } from "./adapter";

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function appleScriptQuote(s: string): string {
  const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

async function runOsascript(script: string): Promise<void> {
  try {
    await $`osascript -e ${script}`.quiet();
  } catch {
    // best effort
  }
}

function buildFullCmd(cwd: string, command?: string): string {
  return command
    ? `cd ${shellQuote(cwd)} && ${command}`
    : `cd ${shellQuote(cwd)}`;
}

export class MacOSITerm2Adapter implements TerminalAdapter {
  readonly id = "iterm2";

  matches(env: NodeJS.ProcessEnv): boolean {
    return (env.TERM_PROGRAM ?? "").toLowerCase() === "iterm.app";
  }

  async openTab(opts: { cwd: string; command?: string }): Promise<void> {
    const fullCmd = buildFullCmd(opts.cwd, opts.command);
    const script = `
tell application "iTerm2"
  activate
  tell current window
    set newTab to (create tab with default profile)
    tell current session of newTab
      write text ${appleScriptQuote(fullCmd)}
    end tell
  end tell
end tell`;
    await runOsascript(script);
  }
}

export class MacOSTerminalAppAdapter implements TerminalAdapter {
  readonly id = "terminal-app";

  matches(env: NodeJS.ProcessEnv): boolean {
    return (env.TERM_PROGRAM ?? "").toLowerCase() === "apple_terminal";
  }

  async openTab(opts: { cwd: string; command?: string }): Promise<void> {
    const fullCmd = buildFullCmd(opts.cwd, opts.command);
    const script = `
tell application "Terminal"
  activate
  tell application "System Events" to keystroke "t" using command down
  delay 0.3
  do script ${appleScriptQuote(fullCmd)} in front window
end tell`;
    await runOsascript(script);
  }
}

export class MacOSGhosttyAdapter implements TerminalAdapter {
  readonly id = "ghostty";

  matches(env: NodeJS.ProcessEnv): boolean {
    return (env.TERM_PROGRAM ?? "").toLowerCase() === "ghostty";
  }

  async openTab(opts: { cwd: string; command?: string }): Promise<void> {
    const fullCmd = buildFullCmd(opts.cwd, opts.command);
    const script = `
tell application "Ghostty" to activate
tell application "System Events"
  keystroke "t" using command down
  delay 0.5
  keystroke ${appleScriptQuote(fullCmd)}
  keystroke return
end tell`;
    await runOsascript(script);
  }
}

export class MacOSWarpAdapter implements TerminalAdapter {
  readonly id = "warp";

  matches(env: NodeJS.ProcessEnv): boolean {
    return (env.TERM_PROGRAM ?? "").toLowerCase() === "warpterminal";
  }

  async openTab(opts: { cwd: string; command?: string }): Promise<void> {
    const fullCmd = buildFullCmd(opts.cwd, opts.command);
    const script = `
tell application "Warp" to activate
tell application "System Events"
  keystroke "t" using command down
  delay 0.5
  keystroke ${appleScriptQuote(fullCmd)}
  keystroke return
end tell`;
    await runOsascript(script);
  }
}
