import type {
  TerminalAdapter,
  TabOpenOptions,
  TerminalCapabilities,
} from "./adapter";

export class TmuxAdapter implements TerminalAdapter {
  readonly id = "tmux";
  readonly capabilities: TerminalCapabilities = {
    nativeCwd: true,
    nativeCommand: true,
    tabDelay: 0,
  };

  matches(env: NodeJS.ProcessEnv): boolean {
    return !!(env.TMUX && env.TMUX.length > 0);
  }

  async openTab(opts: TabOpenOptions): Promise<void> {
    const newWindow = Bun.spawn(["tmux", "new-window", "-c", opts.cwd], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await newWindow.exited;

    if (opts.command) {
      const sendKeys = Bun.spawn(
        ["tmux", "send-keys", opts.command, "Enter"],
        { stdout: "ignore", stderr: "ignore" },
      );
      await sendKeys.exited;
    }
  }
}

export class ZellijAdapter implements TerminalAdapter {
  readonly id = "zellij";
  readonly capabilities: TerminalCapabilities = {
    nativeCwd: true,
    nativeCommand: false,
    tabDelay: 0,
  };

  matches(env: NodeJS.ProcessEnv): boolean {
    return !!(env.ZELLIJ && env.ZELLIJ.length > 0);
  }

  async openTab(opts: TabOpenOptions): Promise<void> {
    const newTab = Bun.spawn(
      ["zellij", "action", "new-tab", "--cwd", opts.cwd],
      { stdout: "ignore", stderr: "ignore" },
    );
    await newTab.exited;

    if (opts.command) {
      const writeChars = Bun.spawn(
        ["zellij", "action", "write-chars", opts.command],
        { stdout: "ignore", stderr: "ignore" },
      );
      await writeChars.exited;

      const sendEnter = Bun.spawn(["zellij", "action", "write", "10"], {
        stdout: "ignore",
        stderr: "ignore",
      });
      await sendEnter.exited;
    }
  }
}
