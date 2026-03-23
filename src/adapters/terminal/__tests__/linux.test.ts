import { describe, expect, test } from "bun:test";
import {
  WezTermAdapter,
  KittyAdapter,
  GnomeTerminalAdapter,
  KonsoleAdapter,
} from "../linux";

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

describe("GnomeTerminalAdapter", () => {
  const adapter = new GnomeTerminalAdapter();

  test("id is gnome-terminal", () => {
    expect(adapter.id).toBe("gnome-terminal");
  });

  describe("matches", () => {
    test("matches via GNOME_TERMINAL_SERVICE", () => {
      expect(
        adapter.matches({ GNOME_TERMINAL_SERVICE: ":1.123" }),
      ).toBe(true);
    });

    test("matches via GNOME_TERMINAL_SCREEN", () => {
      expect(
        adapter.matches({
          GNOME_TERMINAL_SCREEN: "/org/gnome/Terminal/screen/abc123",
        }),
      ).toBe(true);
    });

    test("matches when both are set", () => {
      expect(
        adapter.matches({
          GNOME_TERMINAL_SERVICE: ":1.123",
          GNOME_TERMINAL_SCREEN: "/org/gnome/Terminal/screen/abc123",
        }),
      ).toBe(true);
    });

    test("matches via VTE_VERSION + GNOME desktop", () => {
      expect(
        adapter.matches({
          VTE_VERSION: "8003",
          XDG_CURRENT_DESKTOP: "ubuntu:GNOME",
        }),
      ).toBe(true);
    });

    test("matches VTE_VERSION with plain GNOME desktop", () => {
      expect(
        adapter.matches({
          VTE_VERSION: "7400",
          XDG_CURRENT_DESKTOP: "GNOME",
        }),
      ).toBe(true);
    });

    test("does not match VTE_VERSION without GNOME desktop", () => {
      expect(
        adapter.matches({
          VTE_VERSION: "8003",
          XDG_CURRENT_DESKTOP: "KDE",
        }),
      ).toBe(false);
    });

    test("does not match VTE_VERSION alone", () => {
      expect(adapter.matches({ VTE_VERSION: "8003" })).toBe(false);
    });

    test("does not match empty GNOME_TERMINAL_SERVICE", () => {
      expect(adapter.matches({ GNOME_TERMINAL_SERVICE: "" })).toBe(false);
    });

    test("does not match missing env vars", () => {
      expect(adapter.matches({})).toBe(false);
    });

    test("does not match Konsole", () => {
      expect(
        adapter.matches({ KONSOLE_DBUS_SERVICE: "org.kde.konsole-1234" }),
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

    test("tabDelay is 200", () => {
      expect(adapter.capabilities.tabDelay).toBe(200);
    });
  });
});

describe("KonsoleAdapter", () => {
  const adapter = new KonsoleAdapter();

  test("id is konsole", () => {
    expect(adapter.id).toBe("konsole");
  });

  describe("matches", () => {
    test("matches via KONSOLE_DBUS_SERVICE", () => {
      expect(
        adapter.matches({ KONSOLE_DBUS_SERVICE: "org.kde.konsole-1234" }),
      ).toBe(true);
    });

    test("does not match empty KONSOLE_DBUS_SERVICE", () => {
      expect(adapter.matches({ KONSOLE_DBUS_SERVICE: "" })).toBe(false);
    });

    test("does not match missing env vars", () => {
      expect(adapter.matches({})).toBe(false);
    });

    test("does not match GNOME Terminal", () => {
      expect(
        adapter.matches({ GNOME_TERMINAL_SERVICE: ":1.123" }),
      ).toBe(false);
    });
  });

  describe("capabilities", () => {
    test("does not have native cwd (D-Bus uses cd command)", () => {
      expect(adapter.capabilities.nativeCwd).toBe(false);
    });

    test("does not have native command", () => {
      expect(adapter.capabilities.nativeCommand).toBe(false);
    });

    test("tabDelay is 200", () => {
      expect(adapter.capabilities.tabDelay).toBe(200);
    });
  });
});
