import { describe, expect, test } from "bun:test";
import { WezTermAdapter, KittyAdapter } from "../linux";

describe("WezTermAdapter", () => {
  const adapter = new WezTermAdapter();

  test("id is wezterm", () => {
    expect(adapter.id).toBe("wezterm");
  });

  describe("matches", () => {
    test("matches WezTerm", () => {
      expect(adapter.matches({ TERM_PROGRAM: "WezTerm" })).toBe(true);
    });

    test("matches case-insensitively", () => {
      expect(adapter.matches({ TERM_PROGRAM: "wezterm" })).toBe(true);
    });

    test("does not match kitty", () => {
      expect(adapter.matches({ TERM_PROGRAM: "kitty" })).toBe(false);
    });

    test("does not match iTerm.app", () => {
      expect(adapter.matches({ TERM_PROGRAM: "iTerm.app" })).toBe(false);
    });

    test("does not match missing TERM_PROGRAM", () => {
      expect(adapter.matches({})).toBe(false);
    });

    test("does not match empty TERM_PROGRAM", () => {
      expect(adapter.matches({ TERM_PROGRAM: "" })).toBe(false);
    });
  });

  describe("capabilities", () => {
    test("has native cwd", () => {
      expect(adapter.capabilities.nativeCwd).toBe(true);
    });

    test("does not have native command (uses send-text)", () => {
      expect(adapter.capabilities.nativeCommand).toBe(false);
    });

    test("tabDelay is 50", () => {
      expect(adapter.capabilities.tabDelay).toBe(50);
    });
  });
});

describe("KittyAdapter", () => {
  const adapter = new KittyAdapter();

  test("id is kitty", () => {
    expect(adapter.id).toBe("kitty");
  });

  describe("matches", () => {
    test("matches kitty via TERM_PROGRAM", () => {
      expect(adapter.matches({ TERM_PROGRAM: "kitty" })).toBe(true);
    });

    test("matches case-insensitively", () => {
      expect(adapter.matches({ TERM_PROGRAM: "Kitty" })).toBe(true);
    });

    test("matches via KITTY_WINDOW_ID", () => {
      expect(adapter.matches({ KITTY_WINDOW_ID: "1" })).toBe(true);
    });

    test("matches when both are set", () => {
      expect(
        adapter.matches({ TERM_PROGRAM: "kitty", KITTY_WINDOW_ID: "1" }),
      ).toBe(true);
    });

    test("does not match WezTerm", () => {
      expect(adapter.matches({ TERM_PROGRAM: "WezTerm" })).toBe(false);
    });

    test("does not match empty KITTY_WINDOW_ID", () => {
      expect(adapter.matches({ KITTY_WINDOW_ID: "" })).toBe(false);
    });

    test("does not match missing env vars", () => {
      expect(adapter.matches({})).toBe(false);
    });
  });

  describe("capabilities", () => {
    test("has native cwd", () => {
      expect(adapter.capabilities.nativeCwd).toBe(true);
    });

    test("does not have native command (uses send-text)", () => {
      expect(adapter.capabilities.nativeCommand).toBe(false);
    });

    test("tabDelay is 50", () => {
      expect(adapter.capabilities.tabDelay).toBe(50);
    });
  });
});
