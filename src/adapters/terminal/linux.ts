import type {
  TerminalAdapter,
  TabOpenOptions,
  TerminalCapabilities,
} from "./adapter";

export class WezTermAdapter implements TerminalAdapter {
  readonly id = "wezterm";
  readonly capabilities: TerminalCapabilities = {
    nativeCwd: true,
    nativeCommand: false,
    tabDelay: 50,
  };

  matches(env: NodeJS.ProcessEnv): boolean {
    return (env.TERM_PROGRAM ?? "").toLowerCase() === "wezterm";
  }

  async openTab(opts: TabOpenOptions): Promise<void> {
    const spawn = Bun.spawn(["wezterm", "cli", "spawn", "--cwd", opts.cwd], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const output = await new Response(spawn.stdout).text();
    await spawn.exited;
    const paneId = output.trim();

    if (opts.command && paneId) {
      const sendText = Bun.spawn(
        [
          "wezterm",
          "cli",
          "send-text",
          "--pane-id",
          paneId,
          "--no-paste",
          `${opts.command}\n`,
        ],
        { stdout: "ignore", stderr: "ignore" },
      );
      await sendText.exited;
    }
  }
}

export class KittyAdapter implements TerminalAdapter {
  readonly id = "kitty";
  readonly capabilities: TerminalCapabilities = {
    nativeCwd: true,
    nativeCommand: false,
    tabDelay: 50,
  };

  matches(env: NodeJS.ProcessEnv): boolean {
    return (
      (env.TERM_PROGRAM ?? "").toLowerCase() === "kitty" ||
      !!(env.KITTY_WINDOW_ID && env.KITTY_WINDOW_ID.length > 0)
    );
  }

  async openTab(opts: TabOpenOptions): Promise<void> {
    const launch = Bun.spawn(
      ["kitten", "@", "launch", "--type=tab", "--cwd", opts.cwd],
      { stdout: "pipe", stderr: "ignore" },
    );
    const output = await new Response(launch.stdout).text();
    await launch.exited;

    if (opts.command) {
      const windowId = output.trim();
      const args = ["kitten", "@", "send-text"];
      if (windowId) {
        args.push("--match", `id:${windowId}`);
      }
      args.push("--", `${opts.command}\r`);

      const sendText = Bun.spawn(args, {
        stdout: "ignore",
        stderr: "ignore",
      });
      await sendText.exited;
    }
  }
}
