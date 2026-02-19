import { describe, expect, test } from "bun:test";
import {
  detectProjectType,
  isProjectDirectory,
  detectDockerCompose,
} from "../detector";
import type { CustomType } from "../../config/schema";

// ─── detectProjectType ──────────────────────────────────────────────────────

describe("detectProjectType", () => {
  test("detects Tauri by src-tauri directory", () => {
    expect(detectProjectType(["src-tauri", "package.json"])).toBe("tauri");
  });

  test("detects Flutter by pubspec.yaml", () => {
    expect(detectProjectType(["pubspec.yaml", "lib"])).toBe("flutter");
  });

  test("detects Swift by .xcodeproj", () => {
    expect(detectProjectType(["MyApp.xcodeproj", "Sources"])).toBe("swift");
  });

  test("detects Swift by .xcworkspace", () => {
    expect(detectProjectType(["MyApp.xcworkspace"])).toBe("swift");
  });

  test("detects Swift by Package.swift", () => {
    expect(detectProjectType(["Package.swift", "Sources"])).toBe("swift");
  });

  test("detects Rust by Cargo.toml", () => {
    expect(detectProjectType(["Cargo.toml", "src"])).toBe("rust");
  });

  test("detects Angular by angular.json", () => {
    expect(detectProjectType(["angular.json", "package.json"])).toBe("angular");
  });

  test("detects NestJS by nest-cli.json", () => {
    expect(detectProjectType(["nest-cli.json", "package.json"])).toBe("nestjs");
  });

  test("detects Next.js by next.config.ts", () => {
    expect(detectProjectType(["next.config.ts", "package.json"])).toBe("nextjs");
  });

  test("detects Next.js by next.config.js", () => {
    expect(detectProjectType(["next.config.js", "package.json"])).toBe("nextjs");
  });

  test("detects Next.js by next.config.mjs", () => {
    expect(detectProjectType(["next.config.mjs", "package.json"])).toBe("nextjs");
  });

  test("detects Bun by bunfig.toml", () => {
    expect(detectProjectType(["bunfig.toml", "package.json"])).toBe("bun");
  });

  test("detects Node by package.json", () => {
    expect(detectProjectType(["package.json"])).toBe("node");
  });

  test("detects Python by pyproject.toml", () => {
    expect(detectProjectType(["pyproject.toml"])).toBe("python");
  });

  test("detects Python by setup.py", () => {
    expect(detectProjectType(["setup.py"])).toBe("python");
  });

  test("detects Python by requirements.txt", () => {
    expect(detectProjectType(["requirements.txt"])).toBe("python");
  });

  test("returns unknown for unrecognized files", () => {
    expect(detectProjectType(["README.md", ".git"])).toBe("unknown");
  });

  test("returns unknown for empty file list", () => {
    expect(detectProjectType([])).toBe("unknown");
  });

  // Priority order tests
  test("Tauri takes priority over Node", () => {
    expect(detectProjectType(["src-tauri", "package.json"])).toBe("tauri");
  });

  test("Angular takes priority over Node", () => {
    expect(detectProjectType(["angular.json", "package.json"])).toBe("angular");
  });

  test("NestJS takes priority over Node", () => {
    expect(detectProjectType(["nest-cli.json", "package.json"])).toBe("nestjs");
  });

  test("Next.js takes priority over Node", () => {
    expect(detectProjectType(["next.config.ts", "package.json"])).toBe("nextjs");
  });

  // Custom types
  test("detects custom type by markers", () => {
    const custom: CustomType[] = [
      { name: "Django", markers: ["manage.py"], patterns: [], color: "yellow" },
    ];
    expect(detectProjectType(["manage.py"], custom)).toBe("Django");
  });

  test("detects custom type by patterns", () => {
    const custom: CustomType[] = [
      { name: "Elixir", markers: [], patterns: ["^mix\\.exs$"], color: "magenta" },
    ];
    expect(detectProjectType(["mix.exs"], custom)).toBe("Elixir");
  });

  test("built-in types have priority over custom types", () => {
    const custom: CustomType[] = [
      { name: "MyNode", markers: ["package.json"], patterns: [], color: "green" },
    ];
    // package.json matches built-in "node" first
    expect(detectProjectType(["package.json"], custom)).toBe("node");
  });

  test("custom type with markers and patterns requires both", () => {
    const custom: CustomType[] = [
      { name: "Laravel", markers: ["artisan"], patterns: ["^composer\\.json$"], color: "red" },
    ];
    // Only pattern match, missing marker
    expect(detectProjectType(["composer.json"], custom)).toBe("unknown");
    // Both present
    expect(detectProjectType(["artisan", "composer.json"], custom)).toBe("Laravel");
  });

  test("invalid regex in custom pattern does not crash", () => {
    const custom: CustomType[] = [
      { name: "Bad", markers: [], patterns: ["[invalid"], color: "gray" },
    ];
    expect(detectProjectType(["anything"], custom)).toBe("unknown");
  });
});

// ─── isProjectDirectory ─────────────────────────────────────────────────────

describe("isProjectDirectory", () => {
  test("true for package.json", () => {
    expect(isProjectDirectory(["package.json"])).toBe(true);
  });

  test("true for Cargo.toml", () => {
    expect(isProjectDirectory(["Cargo.toml"])).toBe(true);
  });

  test("true for pubspec.yaml", () => {
    expect(isProjectDirectory(["pubspec.yaml"])).toBe(true);
  });

  test("true for .git directory", () => {
    expect(isProjectDirectory([".git"])).toBe(true);
  });

  test("true for src-tauri directory", () => {
    expect(isProjectDirectory(["src-tauri"])).toBe(true);
  });

  test("true for .xcodeproj", () => {
    expect(isProjectDirectory(["MyApp.xcodeproj"])).toBe(true);
  });

  test("true for next.config.ts", () => {
    expect(isProjectDirectory(["next.config.ts"])).toBe(true);
  });

  test("true for pyproject.toml", () => {
    expect(isProjectDirectory(["pyproject.toml"])).toBe(true);
  });

  test("true for setup.py", () => {
    expect(isProjectDirectory(["setup.py"])).toBe(true);
  });

  test("true for requirements.txt", () => {
    expect(isProjectDirectory(["requirements.txt"])).toBe(true);
  });

  test("true for angular.json", () => {
    expect(isProjectDirectory(["angular.json"])).toBe(true);
  });

  test("true for nest-cli.json", () => {
    expect(isProjectDirectory(["nest-cli.json"])).toBe(true);
  });

  test("true for bunfig.toml", () => {
    expect(isProjectDirectory(["bunfig.toml"])).toBe(true);
  });

  test("false for random files only", () => {
    expect(isProjectDirectory(["README.md", "notes.txt"])).toBe(false);
  });

  test("false for empty directory", () => {
    expect(isProjectDirectory([])).toBe(false);
  });

  test("true for custom type markers", () => {
    const custom: CustomType[] = [
      { name: "Django", markers: ["manage.py"], patterns: [], color: "yellow" },
    ];
    expect(isProjectDirectory(["manage.py"], custom)).toBe(true);
  });

  test("true for custom type patterns", () => {
    const custom: CustomType[] = [
      { name: "Elixir", markers: [], patterns: ["^mix\\.exs$"], color: "magenta" },
    ];
    expect(isProjectDirectory(["mix.exs"], custom)).toBe(true);
  });
});

// ─── detectDockerCompose ────────────────────────────────────────────────────

describe("detectDockerCompose", () => {
  test("detects docker-compose.yml", () => {
    const result = detectDockerCompose(["docker-compose.yml", "package.json"]);
    expect(result).toContain("docker-compose.yml");
  });

  test("detects docker-compose.yaml", () => {
    const result = detectDockerCompose(["docker-compose.yaml"]);
    expect(result).toContain("docker-compose.yaml");
  });

  test("detects compose.yml", () => {
    const result = detectDockerCompose(["compose.yml"]);
    expect(result).toContain("compose.yml");
  });

  test("detects docker-compose.local.yml", () => {
    const result = detectDockerCompose(["docker-compose.local.yml"]);
    expect(result).toContain("docker-compose.local.yml");
  });

  test("detects multiple compose files", () => {
    const result = detectDockerCompose([
      "docker-compose.yml",
      "docker-compose.test.yml",
    ]);
    expect(result).toHaveLength(2);
  });

  test("returns undefined when no compose files", () => {
    expect(detectDockerCompose(["package.json", "README.md"])).toBeUndefined();
  });

  test("returns undefined for empty file list", () => {
    expect(detectDockerCompose([])).toBeUndefined();
  });
});
