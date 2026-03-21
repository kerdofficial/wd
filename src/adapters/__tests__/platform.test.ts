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
