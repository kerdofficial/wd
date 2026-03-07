import { describe, expect, test } from "bun:test";
import { parseNewArgs, extractNewArgv } from "../arg-parser";
import type { Template } from "../../config/schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeTemplate = (
  id: string,
  shorthand: string,
  longFlag: string,
  paramKey: string
): Template => ({
  id,
  name: id,
  hidden: false,
  variants: [
    {
      type: "default",
      name: "Default",
      command: `create {PROJECT_NAME}`,
      supportedPackageManagers: [
        { name: "bun", command: "bunx --bun", commandParam: "bun" },
      ],
      additionalParameters: [
        {
          id: "param1",
          wizardParameter: { default: longFlag, shorthand },
          optional: false,
          description: "Test param",
          type: "select",
          options: ["option1", "option2"],
          parameterKey: paramKey,
        },
      ],
    },
  ],
});

// ─── Defaults ─────────────────────────────────────────────────────────────────

describe("parseNewArgs — defaults", () => {
  test("empty argv returns all defaults", () => {
    const result = parseNewArgs([]);
    expect(result.appName).toBeUndefined();
    expect(result.template).toBeUndefined();
    expect(result.variant).toBeUndefined();
    expect(result.pm).toBeUndefined();
    expect(result.dir).toBeUndefined();
    expect(result.verbose).toBe(false);
    expect(result.raw).toBe(false);
    expect(result.dryRun).toBe(false);
    expect(result.dynamicFlags.size).toBe(0);
    expect(result.unknownFlags).toHaveLength(0);
  });
});

// ─── Fixed flags ──────────────────────────────────────────────────────────────

describe("parseNewArgs — fixed flags", () => {
  test("--template", () => {
    expect(parseNewArgs(["--template", "nextjs"]).template).toBe("nextjs");
  });

  test("--variant", () => {
    expect(parseNewArgs(["--variant", "shadcn"]).variant).toBe("shadcn");
  });

  test("--pm", () => {
    expect(parseNewArgs(["--pm", "bun"]).pm).toBe("bun");
  });

  test("--dir", () => {
    expect(parseNewArgs(["--dir", "/home/user/projects"]).dir).toBe("/home/user/projects");
  });

  test("--verbose", () => {
    expect(parseNewArgs(["--verbose"]).verbose).toBe(true);
  });

  test("--raw", () => {
    expect(parseNewArgs(["--raw"]).raw).toBe(true);
  });

  test("--dry-run", () => {
    expect(parseNewArgs(["--dry-run"]).dryRun).toBe(true);
  });

  test("-t alias for --template", () => {
    expect(parseNewArgs(["-t", "nextjs"]).template).toBe("nextjs");
  });

  test("-v alias for --variant", () => {
    expect(parseNewArgs(["-v", "shadcn"]).variant).toBe("shadcn");
  });

  test("--package-manager alias for --pm", () => {
    expect(parseNewArgs(["--package-manager", "bun"]).pm).toBe("bun");
  });

  test("positional app name", () => {
    expect(parseNewArgs(["my-app"]).appName).toBe("my-app");
  });
});

// ─── Combined flags ───────────────────────────────────────────────────────────

describe("parseNewArgs — combined flags", () => {
  test("all fixed flags together", () => {
    const result = parseNewArgs([
      "my-app",
      "--template", "nextjs",
      "--variant", "shadcn",
      "--pm", "bun",
      "--dir", "/projects",
      "--verbose",
      "--raw",
      "--dry-run",
    ]);
    expect(result.appName).toBe("my-app");
    expect(result.template).toBe("nextjs");
    expect(result.variant).toBe("shadcn");
    expect(result.pm).toBe("bun");
    expect(result.dir).toBe("/projects");
    expect(result.verbose).toBe(true);
    expect(result.raw).toBe(true);
    expect(result.dryRun).toBe(true);
  });

  test("fixed + dynamic flags together", () => {
    const templates = [makeTemplate("next", "bc", "base-color", "BASE_COLOR")];
    const result = parseNewArgs([
      "my-app",
      "--template", "nextjs",
      "--pm", "bun",
      "--base-color", "zinc",
      "--verbose",
    ], templates);
    expect(result.appName).toBe("my-app");
    expect(result.template).toBe("nextjs");
    expect(result.pm).toBe("bun");
    expect(result.dynamicFlags.get("base-color")).toBe("zinc");
    expect(result.verbose).toBe(true);
  });

  test("multiple dynamic flags together", () => {
    const templates = [
      makeTemplate("next", "bc", "base-color", "BASE_COLOR"),
      makeTemplate("react", "rt", "router", "ROUTER_TYPE"),
      makeTemplate("tailwind", "tw", "tailwind", "TAILWIND"),
    ];
    const result = parseNewArgs([
      "--base-color", "zinc",
      "--router", "app",
      "--tailwind", "yes",
    ], templates);
    expect(result.dynamicFlags.get("base-color")).toBe("zinc");
    expect(result.dynamicFlags.get("router")).toBe("app");
    expect(result.dynamicFlags.get("tailwind")).toBe("yes");
  });

  test("dry-run with template flags", () => {
    const templates = [makeTemplate("next", "bc", "base-color", "BASE_COLOR")];
    const result = parseNewArgs([
      "my-app",
      "--template", "nextjs",
      "--variant", "shadcn",
      "--pm", "pnpm",
      "--base-color", "slate",
      "--dry-run",
    ], templates);
    expect(result.appName).toBe("my-app");
    expect(result.template).toBe("nextjs");
    expect(result.variant).toBe("shadcn");
    expect(result.pm).toBe("pnpm");
    expect(result.dryRun).toBe(true);
    expect(result.dynamicFlags.get("base-color")).toBe("slate");
  });

  test("flags in any order", () => {
    const result = parseNewArgs([
      "--verbose",
      "--pm", "bun",
      "my-app",
      "--template", "nextjs",
    ]);
    expect(result.appName).toBe("my-app");
    expect(result.template).toBe("nextjs");
    expect(result.pm).toBe("bun");
    expect(result.verbose).toBe(true);
  });

  test("boolean flags adjacent to value flags", () => {
    const result = parseNewArgs([
      "--dry-run",
      "--template", "nextjs",
      "--verbose",
      "--pm", "bun",
    ]);
    expect(result.dryRun).toBe(true);
    expect(result.template).toBe("nextjs");
    expect(result.verbose).toBe(true);
    expect(result.pm).toBe("bun");
  });
});

// ─── Shorthand flags ──────────────────────────────────────────────────────────

describe("parseNewArgs — shorthand flags", () => {
  test("shorthand resolved to long name via templates", () => {
    const templates = [makeTemplate("next", "bc", "base-color", "BASE_COLOR")];
    const result = parseNewArgs(["-bc", "zinc"], templates);
    expect(result.dynamicFlags.get("base-color")).toBe("zinc");
  });

  test("shorthand combined with fixed flags", () => {
    const templates = [makeTemplate("next", "bc", "base-color", "BASE_COLOR")];
    const result = parseNewArgs(
      ["my-app", "--template", "nextjs", "-bc", "stone"],
      templates
    );
    expect(result.appName).toBe("my-app");
    expect(result.template).toBe("nextjs");
    expect(result.dynamicFlags.get("base-color")).toBe("stone");
  });

  test("multiple shorthands from different templates", () => {
    const templates = [
      makeTemplate("next", "bc", "base-color", "BASE_COLOR"),
      makeTemplate("react", "rt", "router-type", "ROUTER_TYPE"),
    ];
    const result = parseNewArgs(["-bc", "zinc", "-rt", "app"], templates);
    expect(result.dynamicFlags.get("base-color")).toBe("zinc");
    expect(result.dynamicFlags.get("router-type")).toBe("app");
  });
});

// ─── Invalid / edge cases ─────────────────────────────────────────────────────

describe("parseNewArgs — invalid and edge cases", () => {
  test("unknown shorthand goes to unknownFlags", () => {
    const result = parseNewArgs(["-x", "value"]);
    expect(result.unknownFlags).toContain("-x");
    expect(result.dynamicFlags.has("x")).toBe(false);
  });

  test("value-flag without value is skipped", () => {
    const result = parseNewArgs(["--template"]);
    expect(result.template).toBeUndefined();
    // No crash
  });

  test("value-flag followed by another flag (not its value)", () => {
    const result = parseNewArgs(["--template", "--pm", "bun"]);
    // --template has no value (next token starts with -)
    expect(result.template).toBeUndefined();
    expect(result.pm).toBe("bun");
  });

  test("unknown long flag with value goes to unknownFlags", () => {
    const result = parseNewArgs(["--unknown-thing", "val"]);
    expect(result.dynamicFlags.get("unknown-thing")).toBeUndefined();
    expect(result.unknownFlags).toContain("--unknown-thing");
    expect(result.appName).toBeUndefined();
  });

  test("unknown long flag without value → unknownFlags", () => {
    const result = parseNewArgs(["--unknown-flag"]);
    expect(result.unknownFlags).toContain("--unknown-flag");
  });

  test("unknown long flag followed by another flag → unknownFlags", () => {
    const result = parseNewArgs(["--bad-flag", "--template", "nextjs"]);
    expect(result.unknownFlags).toContain("--bad-flag");
    expect(result.template).toBe("nextjs");
  });

  test("unknown shorthand with value is ignored without becoming app name", () => {
    const result = parseNewArgs(["-x", "value", "--template", "nextjs"]);
    expect(result.unknownFlags).toContain("-x");
    expect(result.appName).toBeUndefined();
    expect(result.template).toBe("nextjs");
  });

  test("--shell-out with space silently ignored", () => {
    const result = parseNewArgs(["--shell-out", "/tmp/wd-cmd.xxx"]);
    expect(result.unknownFlags).not.toContain("--shell-out");
    expect(result.dynamicFlags.has("shell-out")).toBe(false);
  });

  test("--shell-out with = syntax silently ignored", () => {
    const result = parseNewArgs(["--shell-out=/tmp/wd-cmd.xxx"]);
    expect(result.unknownFlags).not.toContain("--shell-out=/tmp/wd-cmd.xxx");
  });

  test("only one positional app name captured (second ignored as unknown)", () => {
    const result = parseNewArgs(["my-app", "extra-arg"]);
    expect(result.appName).toBe("my-app");
    expect(result.unknownFlags).toContain("extra-arg");
  });

  test("empty string value is treated as a flag without value", () => {
    // Flags starting with "-" are not consumed as values
    const result = parseNewArgs(["--template", "--variant", "shadcn"]);
    expect(result.template).toBeUndefined();
    expect(result.variant).toBe("shadcn");
  });
});

// ─── extractNewArgv ───────────────────────────────────────────────────────────

describe("extractNewArgv", () => {
  test("extracts args after 'new'", () => {
    const argv = ["wd-bin", "new", "my-app", "--template", "next"];
    expect(extractNewArgv(argv)).toEqual(["my-app", "--template", "next"]);
  });

  test("returns empty array if 'new' not found", () => {
    expect(extractNewArgv(["wd-bin", "scan"])).toEqual([]);
  });

  test("returns empty array if 'new' is last token", () => {
    expect(extractNewArgv(["wd-bin", "new"])).toEqual([]);
  });

  test("handles 'new' with only flags after it", () => {
    const argv = ["wd-bin", "new", "--template", "nextjs", "--dry-run"];
    expect(extractNewArgv(argv)).toEqual(["--template", "nextjs", "--dry-run"]);
  });

  test("uses first occurrence of 'new' as anchor", () => {
    const argv = ["wd-bin", "new", "my-new-app"];
    expect(extractNewArgv(argv)).toEqual(["my-new-app"]);
  });
});
