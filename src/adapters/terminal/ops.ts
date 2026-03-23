import type { TerminalAdapter } from "./adapter";

export async function openWorkspaceTabs(
  projects: Array<{
    path: string;
    isPrimary: boolean;
    tabs?: Array<{ command?: string }>;
  }>,
  terminal: TerminalAdapter,
): Promise<void> {
  let isFirstPrimaryTab = true;

  for (const project of projects) {
    const tabs = project.tabs ?? [];

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i]!;

      if (project.isPrimary && isFirstPrimaryTab) {
        isFirstPrimaryTab = false;
        continue;
      }

      if (terminal.capabilities.tabDelay > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, terminal.capabilities.tabDelay),
        );
      }

      try {
        await terminal.openTab({ cwd: project.path, command: tab.command });
      } catch {
        // best-effort
      }
    }

    if (project.isPrimary && tabs.length === 0) {
      isFirstPrimaryTab = false;
    }
  }
}
