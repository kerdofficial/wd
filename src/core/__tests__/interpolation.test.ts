import { describe, expect, test } from "bun:test";
import {
  interpolate,
  extractPlaceholders,
  validatePlaceholders,
} from "../interpolation";

// ─── interpolate ─────────────────────────────────────────────────────────────

describe("interpolate", () => {
  test("replaces simple placeholders", () => {
    expect(interpolate("Hello {NAME}", { NAME: "world" })).toBe("Hello world");
  });

  test("replaces nested placeholders with dot notation", () => {
    const ctx = { PACKAGE_MANAGER: { command: "bunx --bun", commandParam: "bun" } };
    expect(interpolate("{PACKAGE_MANAGER.command} create", ctx)).toBe(
      "bunx --bun create"
    );
  });

  test("leaves unresolved placeholders intact", () => {
    expect(interpolate("Hello {MISSING}", {})).toBe("Hello {MISSING}");
  });

  test("replaces multiple placeholders in one string", () => {
    const ctx = {
      PROJECT_NAME: "my-app",
      PACKAGE_MANAGER: { command: "bunx --bun" },
    };
    expect(
      interpolate("{PACKAGE_MANAGER.command} create-next-app {PROJECT_NAME}", ctx)
    ).toBe("bunx --bun create-next-app my-app");
  });

  test("handles numeric values", () => {
    expect(interpolate("port={PORT}", { PORT: 3000 })).toBe("port=3000");
  });

  test("handles boolean values", () => {
    expect(interpolate("flag={ENABLED}", { ENABLED: true })).toBe("flag=true");
  });

  test("returns unchanged string if no placeholders", () => {
    expect(interpolate("no placeholders here", {})).toBe("no placeholders here");
  });

  test("deeply nested path resolution", () => {
    const ctx = { A: { B: { C: "deep" } } };
    expect(interpolate("{A.B.C}", ctx)).toBe("deep");
  });

  test("partially resolved: missing nested key left intact", () => {
    const ctx = { A: { B: "found" } };
    expect(interpolate("{A.B} {A.C}", ctx)).toBe("found {A.C}");
  });
});

// ─── extractPlaceholders ─────────────────────────────────────────────────────

describe("extractPlaceholders", () => {
  test("returns empty array for no placeholders", () => {
    expect(extractPlaceholders("no placeholders")).toEqual([]);
  });

  test("extracts simple placeholders", () => {
    expect(extractPlaceholders("Hello {NAME}")).toEqual(["NAME"]);
  });

  test("extracts nested placeholders", () => {
    expect(extractPlaceholders("{PACKAGE_MANAGER.command}")).toEqual([
      "PACKAGE_MANAGER.command",
    ]);
  });

  test("deduplicates repeated placeholders", () => {
    const placeholders = extractPlaceholders("{NAME} and {NAME} again");
    expect(placeholders).toEqual(["NAME"]);
  });

  test("extracts multiple different placeholders", () => {
    const placeholders = extractPlaceholders(
      "{PACKAGE_MANAGER.command} create {PROJECT_NAME} --pm {PACKAGE_MANAGER.commandParam}"
    );
    expect(placeholders).toContain("PACKAGE_MANAGER.command");
    expect(placeholders).toContain("PROJECT_NAME");
    expect(placeholders).toContain("PACKAGE_MANAGER.commandParam");
  });
});

// ─── validatePlaceholders ────────────────────────────────────────────────────

describe("validatePlaceholders", () => {
  test("valid when all placeholders resolved", () => {
    const result = validatePlaceholders("{NAME}", { NAME: "world" });
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  test("invalid when placeholder missing", () => {
    const result = validatePlaceholders("{MISSING}", {});
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("MISSING");
  });

  test("valid when no placeholders in template", () => {
    const result = validatePlaceholders("no placeholders", {});
    expect(result.valid).toBe(true);
  });

  test("lists all missing placeholders", () => {
    const result = validatePlaceholders("{A} {B} {C}", { B: "found" });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("A");
    expect(result.missing).toContain("C");
    expect(result.missing).not.toContain("B");
  });

  test("nested missing reported correctly", () => {
    const result = validatePlaceholders(
      "{PACKAGE_MANAGER.command}",
      { PACKAGE_MANAGER: {} }
    );
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("PACKAGE_MANAGER.command");
  });
});
