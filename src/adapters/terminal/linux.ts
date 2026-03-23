import type {
  TerminalAdapter,
  TabOpenOptions,
  TerminalCapabilities,
} from "./adapter";
import { buildPosixCmd, commandExists } from "./helpers";

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

export class GnomeTerminalAdapter implements TerminalAdapter {
  readonly id = "gnome-terminal";
  readonly capabilities: TerminalCapabilities = {
    nativeCwd: true,
    nativeCommand: false,
    tabDelay: 200,
  };

  private terminalBinary: string | null = null;

  matches(env: NodeJS.ProcessEnv): boolean {
    if (
      (env.GNOME_TERMINAL_SERVICE &&
        env.GNOME_TERMINAL_SERVICE.length > 0) ||
      (env.GNOME_TERMINAL_SCREEN && env.GNOME_TERMINAL_SCREEN.length > 0)
    ) {
      return true;
    }

    return !!(
      env.VTE_VERSION &&
      env.VTE_VERSION.length > 0 &&
      env.XDG_CURRENT_DESKTOP &&
      env.XDG_CURRENT_DESKTOP.toLowerCase().includes("gnome")
    );
  }

  async openTab(opts: TabOpenOptions): Promise<void> {
    if (this.terminalBinary === null) {
      if (await commandExists("ptyxis")) {
        this.terminalBinary = "ptyxis";
      } else if (await commandExists("gnome-terminal")) {
        this.terminalBinary = "gnome-terminal";
      } else {
        return;
      }
    }

    if (this.terminalBinary === "ptyxis") {
      await this.openTabViaPtyxis(opts);
    } else {
      await this.openTabViaGnomeTerminal(opts);
    }
  }

  private async openTabViaPtyxis(opts: TabOpenOptions): Promise<void> {
    const args = ["ptyxis", "--tab", "-d", opts.cwd];
    if (opts.command) {
      args.push("--", "sh", "-c", `${opts.command}; exec $SHELL`);
    }
    const proc = Bun.spawn(args, { stdout: "ignore", stderr: "ignore" });
    await proc.exited;
  }

  private async openTabViaGnomeTerminal(opts: TabOpenOptions): Promise<void> {
    const args = [
      "gnome-terminal",
      "--tab",
      `--working-directory=${opts.cwd}`,
    ];
    if (opts.command) {
      args.push("--", "sh", "-c", `${opts.command}; exec $SHELL`);
    }
    const proc = Bun.spawn(args, { stdout: "ignore", stderr: "ignore" });
    await proc.exited;
  }
}

export class KonsoleAdapter implements TerminalAdapter {
  readonly id = "konsole";
  readonly capabilities: TerminalCapabilities = {
    nativeCwd: false,
    nativeCommand: false,
    tabDelay: 200,
  };

  private hasQdbus: boolean | null = null;

  matches(env: NodeJS.ProcessEnv): boolean {
    return !!(
      env.KONSOLE_DBUS_SERVICE && env.KONSOLE_DBUS_SERVICE.length > 0
    );
  }

  async openTab(opts: TabOpenOptions): Promise<void> {
    if (this.hasQdbus === null) {
      this.hasQdbus = await commandExists("qdbus");
    }

    if (this.hasQdbus) {
      await this.openTabViaDbus(opts);
    } else {
      await this.openTabViaCli(opts);
    }
  }

  private async openTabViaDbus(opts: TabOpenOptions): Promise<void> {
    const service = process.env.KONSOLE_DBUS_SERVICE!;
    const window = process.env.KONSOLE_DBUS_WINDOW ?? "/Windows/1";

    const newSession = Bun.spawn(
      ["qdbus", service, window, "newSession", "", opts.cwd],
      { stdout: "pipe", stderr: "ignore" },
    );
    const output = await new Response(newSession.stdout).text();
    await newSession.exited;

    const sessionId = output.trim();
    if (!sessionId || !opts.command) return;

    const runCmd = Bun.spawn(
      ["qdbus", service, `/Sessions/${sessionId}`, "runCommand", opts.command],
      { stdout: "ignore", stderr: "ignore" },
    );
    await runCmd.exited;
  }

  private async openTabViaCli(opts: TabOpenOptions): Promise<void> {
    const args = ["konsole", "--new-tab", "--workdir", opts.cwd];
    if (opts.command) {
      args.push("-e", "sh", "-c", `${opts.command}; exec $SHELL`);
    }
    const proc = Bun.spawn(args, { stdout: "ignore", stderr: "ignore" });
    await proc.exited;
  }
}
