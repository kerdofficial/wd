import { $ } from "bun";

export type TerminalApp = "ghostty" | "iterm2" | "terminal" | "warp" | "unknown";

/**
 * Detect the current terminal emulator from $TERM_PROGRAM.
 */
export function detectTerminal(): TerminalApp {
  const t = (process.env.TERM_PROGRAM ?? "").toLowerCase();
  if (t === "ghostty") return "ghostty";
  if (t === "iterm.app") return "iterm2";
  if (t === "apple_terminal") return "terminal";
  if (t === "warpterminal") return "warp";
  return "unknown";
}

/**
 * Open a new terminal tab in the given directory, optionally running a command.
 * Uses terminal-specific AppleScript (iTerm2, Terminal.app) or keystroke
 * simulation (Ghostty, Warp) via osascript.
 */
export async function openTab(dir: string, command?: string): Promise<void> {
  const term = detectTerminal();
  const fullCmd = command ? `cd ${shellQuote(dir)} && ${command}` : `cd ${shellQuote(dir)}`;

  const script = buildScript(term, dir, fullCmd);
  try {
    await $`osascript -e ${script}`.quiet();
  } catch {
    // Best effort — don't crash the workspace open flow
  }
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function buildScript(term: TerminalApp, dir: string, fullCmd: string): string {
  switch (term) {
    case "iterm2":
      return `
tell application "iTerm2"
  activate
  tell current window
    set newTab to (create tab with default profile)
    tell current session of newTab
      write text ${appleScriptQuote(fullCmd)}
    end tell
  end tell
end tell`;

    case "terminal":
      return `
tell application "Terminal"
  activate
  tell application "System Events" to keystroke "t" using command down
  delay 0.3
  do script ${appleScriptQuote(fullCmd)} in front window
end tell`;

    case "ghostty":
    case "warp":
    case "unknown":
    default:
      // Keystroke simulation: Cmd+T opens new tab, then type the command
      return `
tell application "${getAppName(term)}" to activate
tell application "System Events"
  keystroke "t" using command down
  delay 0.5
  keystroke ${appleScriptQuote(fullCmd)}
  keystroke return
end tell`;
  }
}

function getAppName(term: TerminalApp): string {
  switch (term) {
    case "ghostty": return "Ghostty";
    case "warp": return "Warp";
    default: return "Terminal";
  }
}

function appleScriptQuote(s: string): string {
  // Escape backslashes and double quotes for AppleScript string literals
  const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Open all tabs defined in a workspace.
 * The first tab of the primary project is the current shell (handled via ShellOutput cd).
 * All other tabs are opened via osascript.
 */
export async function openWorkspaceTabs(
  projects: Array<{ path: string; isPrimary: boolean; tabs?: Array<{ command?: string }> }>
): Promise<void> {
  let isFirstPrimaryTab = true;

  for (const project of projects) {
    const tabs = project.tabs ?? [];

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i]!;

      // Skip the first tab of the primary project — that's the current shell
      if (project.isPrimary && isFirstPrimaryTab) {
        isFirstPrimaryTab = false;
        continue;
      }

      // Add delay between tab openings so the terminal can process them
      await new Promise((resolve) => setTimeout(resolve, 300));
      await openTab(project.path, tab.command);
    }

    // If primary had no tabs defined, we already "used" the primary slot
    if (project.isPrimary && tabs.length === 0) {
      isFirstPrimaryTab = false;
    }
  }
}
