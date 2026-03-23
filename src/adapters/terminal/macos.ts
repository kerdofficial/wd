import type { TerminalAdapter, TabOpenOptions, TerminalCapabilities } from "./adapter";
import { buildPosixCmd, appleScriptQuote, runOsascript } from "./helpers";

export class MacOSITerm2Adapter implements TerminalAdapter {
  readonly id = "iterm2";
  readonly capabilities: TerminalCapabilities = {
    nativeCwd: false,
    nativeCommand: false,
    tabDelay: 100,
  };

  matches(env: NodeJS.ProcessEnv): boolean {
    return (env.TERM_PROGRAM ?? "").toLowerCase() === "iterm.app";
  }

  async openTab(opts: TabOpenOptions): Promise<void> {
    const fullCmd = buildPosixCmd(opts.cwd, opts.command);
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
  readonly capabilities: TerminalCapabilities = {
    nativeCwd: false,
    nativeCommand: false,
    tabDelay: 500,
  };

  matches(env: NodeJS.ProcessEnv): boolean {
    return (env.TERM_PROGRAM ?? "").toLowerCase() === "apple_terminal";
  }

  async openTab(opts: TabOpenOptions): Promise<void> {
    const fullCmd = buildPosixCmd(opts.cwd, opts.command);
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
  readonly capabilities: TerminalCapabilities = {
    nativeCwd: false,
    nativeCommand: false,
    tabDelay: 500,
  };

  matches(env: NodeJS.ProcessEnv): boolean {
    return (env.TERM_PROGRAM ?? "").toLowerCase() === "ghostty";
  }

  async openTab(opts: TabOpenOptions): Promise<void> {
    const fullCmd = buildPosixCmd(opts.cwd, opts.command);
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
  readonly capabilities: TerminalCapabilities = {
    nativeCwd: false,
    nativeCommand: false,
    tabDelay: 500,
  };

  matches(env: NodeJS.ProcessEnv): boolean {
    return (env.TERM_PROGRAM ?? "").toLowerCase() === "warpterminal";
  }

  async openTab(opts: TabOpenOptions): Promise<void> {
    const fullCmd = buildPosixCmd(opts.cwd, opts.command);
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
