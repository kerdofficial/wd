import { describe, expect, test } from "bun:test";
import {
  MacOSITerm2Adapter,
  MacOSTerminalAppAdapter,
  MacOSGhosttyAdapter,
  MacOSWarpAdapter,
} from "../macos";

describe("macOS terminal adapters", () => {
  describe("MacOSITerm2Adapter", () => {
    const adapter = new MacOSITerm2Adapter();

    test("id is iterm2", () => {
      expect(adapter.id).toBe("iterm2");
    });

    test("matches iTerm.app", () => {
      expect(adapter.matches({ TERM_PROGRAM: "iTerm.app" })).toBe(true);
    });

    test("matches case-insensitively", () => {
      expect(adapter.matches({ TERM_PROGRAM: "ITERM.APP" })).toBe(true);
    });

    test("does not match Apple_Terminal", () => {
      expect(adapter.matches({ TERM_PROGRAM: "Apple_Terminal" })).toBe(false);
    });

    test("does not match missing TERM_PROGRAM", () => {
      expect(adapter.matches({})).toBe(false);
    });
  });

  describe("MacOSTerminalAppAdapter", () => {
    const adapter = new MacOSTerminalAppAdapter();

    test("id is terminal-app", () => {
      expect(adapter.id).toBe("terminal-app");
    });

    test("matches Apple_Terminal", () => {
      expect(adapter.matches({ TERM_PROGRAM: "Apple_Terminal" })).toBe(true);
    });

    test("matches case-insensitively", () => {
      expect(adapter.matches({ TERM_PROGRAM: "apple_terminal" })).toBe(true);
    });

    test("does not match iTerm.app", () => {
      expect(adapter.matches({ TERM_PROGRAM: "iTerm.app" })).toBe(false);
    });
  });

  describe("MacOSGhosttyAdapter", () => {
    const adapter = new MacOSGhosttyAdapter();

    test("id is ghostty", () => {
      expect(adapter.id).toBe("ghostty");
    });

    test("matches ghostty", () => {
      expect(adapter.matches({ TERM_PROGRAM: "ghostty" })).toBe(true);
    });

    test("matches Ghostty (case-insensitive)", () => {
      expect(adapter.matches({ TERM_PROGRAM: "Ghostty" })).toBe(true);
    });

    test("does not match warp", () => {
      expect(adapter.matches({ TERM_PROGRAM: "WarpTerminal" })).toBe(false);
    });
  });

  describe("MacOSWarpAdapter", () => {
    const adapter = new MacOSWarpAdapter();

    test("id is warp", () => {
      expect(adapter.id).toBe("warp");
    });

    test("matches WarpTerminal", () => {
      expect(adapter.matches({ TERM_PROGRAM: "WarpTerminal" })).toBe(true);
    });

    test("matches case-insensitively", () => {
      expect(adapter.matches({ TERM_PROGRAM: "warpterminal" })).toBe(true);
    });

    test("does not match ghostty", () => {
      expect(adapter.matches({ TERM_PROGRAM: "ghostty" })).toBe(false);
    });

    test("does not match missing TERM_PROGRAM", () => {
      expect(adapter.matches({})).toBe(false);
    });
  });
});
