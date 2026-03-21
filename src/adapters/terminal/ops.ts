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

      await new Promise((resolve) => setTimeout(resolve, 300));
      await terminal.openTab({ cwd: project.path, command: tab.command });
    }

    if (project.isPrimary && tabs.length === 0) {
      isFirstPrimaryTab = false;
    }
  }
}
