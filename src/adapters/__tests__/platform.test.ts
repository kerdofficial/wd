import { describe, expect, test } from "bun:test";
import { resolveShell, resolveTerminal, resolveClipboard } from "../platform";

describe("Platform resolution", () => {
  describe("resolveShell", () => {
    test("resolves zsh adapter for 'zsh'", () => {
      expect(resolveShell("zsh").id).toBe("zsh");
    });

    test("falls back to zsh for undefined", () => {
      expect(resolveShell(undefined).id).toBe("zsh");
    });

    test("falls back to zsh for unknown shell", () => {
      expect(resolveShell("unknown-shell").id).toBe("zsh");
    });

    test("falls back to zsh for empty string", () => {
      expect(resolveShell("").id).toBe("zsh");
    });

    test("resolves bash adapter for 'bash'", () => {
      expect(resolveShell("bash").id).toBe("bash");
    });

    test("resolves fish adapter for 'fish'", () => {
      expect(resolveShell("fish").id).toBe("fish");
    });

    test("resolves pwsh adapter for 'pwsh'", () => {
      expect(resolveShell("pwsh").id).toBe("pwsh");
    });

    test("resolves nushell adapter for 'nu'", () => {
      expect(resolveShell("nu").id).toBe("nu");
    });
  });

  describe("resolveTerminal", () => {
    test("resolves iTerm2 for iTerm.app", () => {
      expect(resolveTerminal({ TERM_PROGRAM: "iTerm.app" })?.id).toBe(
        "iterm2",
      );
    });

    test("resolves Terminal.app for Apple_Terminal", () => {
      expect(resolveTerminal({ TERM_PROGRAM: "Apple_Terminal" })?.id).toBe(
        "terminal-app",
      );
    });

    test("resolves Ghostty", () => {
      expect(resolveTerminal({ TERM_PROGRAM: "ghostty" })?.id).toBe(
        "ghostty",
      );
    });

    test("resolves Warp", () => {
      expect(resolveTerminal({ TERM_PROGRAM: "WarpTerminal" })?.id).toBe(
        "warp",
      );
    });

    test("resolves tmux when TMUX is set", () => {
      expect(
        resolveTerminal({ TMUX: "/tmp/tmux-501/default,12345,0" })?.id,
      ).toBe("tmux");
    });

    test("resolves Zellij when ZELLIJ is set", () => {
      expect(resolveTerminal({ ZELLIJ: "my-session" })?.id).toBe("zellij");
    });

    test("tmux takes priority over iTerm2", () => {
      expect(
        resolveTerminal({
          TMUX: "/tmp/tmux-501/default,12345,0",
          TERM_PROGRAM: "iTerm.app",
        })?.id,
      ).toBe("tmux");
    });

    test("zellij takes priority over iTerm2", () => {
      expect(
        resolveTerminal({
          ZELLIJ: "session",
          TERM_PROGRAM: "iTerm.app",
        })?.id,
      ).toBe("zellij");
    });

    test("tmux takes priority over zellij", () => {
      expect(
        resolveTerminal({
          TMUX: "/tmp/tmux-501/default,12345,0",
          ZELLIJ: "session",
        })?.id,
      ).toBe("tmux");
    });

    test("resolves WezTerm", () => {
      expect(resolveTerminal({ TERM_PROGRAM: "WezTerm" })?.id).toBe(
        "wezterm",
      );
    });

    test("resolves kitty via TERM_PROGRAM", () => {
      expect(resolveTerminal({ TERM_PROGRAM: "kitty" })?.id).toBe("kitty");
    });

    test("resolves kitty via KITTY_WINDOW_ID", () => {
      expect(resolveTerminal({ KITTY_WINDOW_ID: "1" })?.id).toBe("kitty");
    });

    test("WezTerm takes priority over macOS adapters", () => {
      expect(resolveTerminal({ TERM_PROGRAM: "WezTerm" })?.id).toBe(
        "wezterm",
      );
    });

    test("tmux takes priority over WezTerm", () => {
      expect(
        resolveTerminal({
          TMUX: "/tmp/tmux-501/default,12345,0",
          TERM_PROGRAM: "WezTerm",
        })?.id,
      ).toBe("tmux");
    });

    test("returns null for unknown terminal", () => {
      expect(resolveTerminal({ TERM_PROGRAM: "SomeWeirdTerminal" })).toBeNull();
    });

    test("returns null for missing TERM_PROGRAM", () => {
      expect(resolveTerminal({})).toBeNull();
    });
  });

  describe("resolveClipboard", () => {
    test("returns a clipboard adapter", () => {
      expect(resolveClipboard()).not.toBeNull();
    });
  });
});
