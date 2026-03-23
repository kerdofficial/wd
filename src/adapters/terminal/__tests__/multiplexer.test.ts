import { describe, expect, test } from "bun:test";
import { TmuxAdapter, ZellijAdapter } from "../multiplexer";

describe("TmuxAdapter", () => {
  const adapter = new TmuxAdapter();

  test("id is tmux", () => {
    expect(adapter.id).toBe("tmux");
  });

  describe("matches", () => {
    test("matches when TMUX is set", () => {
      expect(
        adapter.matches({ TMUX: "/tmp/tmux-501/default,12345,0" }),
      ).toBe(true);
    });

    test("does not match empty TMUX", () => {
      expect(adapter.matches({ TMUX: "" })).toBe(false);
    });

    test("does not match missing TMUX", () => {
      expect(adapter.matches({})).toBe(false);
    });

    test("does not match when only TERM_PROGRAM is set", () => {
      expect(adapter.matches({ TERM_PROGRAM: "iTerm.app" })).toBe(false);
    });
  });

  describe("capabilities", () => {
    test("has native cwd", () => {
      expect(adapter.capabilities.nativeCwd).toBe(true);
    });

    test("has native command", () => {
      expect(adapter.capabilities.nativeCommand).toBe(true);
    });

    test("tabDelay is 0", () => {
      expect(adapter.capabilities.tabDelay).toBe(0);
    });
  });
});

describe("ZellijAdapter", () => {
  const adapter = new ZellijAdapter();

  test("id is zellij", () => {
    expect(adapter.id).toBe("zellij");
  });

  describe("matches", () => {
    test("matches when ZELLIJ is set", () => {
      expect(adapter.matches({ ZELLIJ: "my-session" })).toBe(true);
    });

    test("does not match empty ZELLIJ", () => {
      expect(adapter.matches({ ZELLIJ: "" })).toBe(false);
    });

    test("does not match missing ZELLIJ", () => {
      expect(adapter.matches({})).toBe(false);
    });

    test("does not match when only TMUX is set", () => {
      expect(
        adapter.matches({ TMUX: "/tmp/tmux-501/default,12345,0" }),
      ).toBe(false);
    });
  });

  describe("capabilities", () => {
    test("has native cwd", () => {
      expect(adapter.capabilities.nativeCwd).toBe(true);
    });

    test("does not have native command", () => {
      expect(adapter.capabilities.nativeCommand).toBe(false);
    });

    test("tabDelay is 0", () => {
      expect(adapter.capabilities.tabDelay).toBe(0);
    });
  });
});
