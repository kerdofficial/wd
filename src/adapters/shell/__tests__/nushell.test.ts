import { describe, expect, test } from "bun:test";
import { NushellShellAdapter } from "../nushell";

const adapter = new NushellShellAdapter();

describe("NushellShellAdapter", () => {
  describe("renderOps", () => {
    test("cd op uses wd-cd: prefix", () => {
      const result = adapter.renderOps([{ op: "cd", path: "/my/path" }]);
      expect(result).toBe("wd-cd:/my/path");
      expect(result).not.toContain("cd ");
    });

    test("cd op with raw path (no quoting)", () => {
      expect(adapter.renderOps([{ op: "cd", path: "/my/path" }])).toBe(
        "wd-cd:/my/path",
      );
    });

    test("cd op with single quotes in path (no escaping needed)", () => {
      expect(adapter.renderOps([{ op: "cd", path: "/it's/here" }])).toBe(
        "wd-cd:/it's/here",
      );
    });

    test("cd op with spaces in path", () => {
      expect(
        adapter.renderOps([{ op: "cd", path: "/my project/dir" }]),
      ).toBe("wd-cd:/my project/dir");
    });

    test("run op uses wd-run: prefix", () => {
      expect(
        adapter.renderOps([{ op: "run", command: "bun dev" }]),
      ).toBe("wd-run:bun dev");
    });

    test("multiple ops joined with newline", () => {
      expect(
        adapter.renderOps([
          { op: "cd", path: "/project" },
          { op: "run", command: "bun dev" },
        ]),
      ).toBe("wd-cd:/project\nwd-run:bun dev");
    });

    test("empty ops returns empty string", () => {
      expect(adapter.renderOps([])).toBe("");
    });

    test("renderOps output differs from zsh", () => {
      const { ZshShellAdapter } = require("../zsh");
      const zshAdapter = new ZshShellAdapter();
      const ops = [{ op: "cd" as const, path: "/some/path" }];
      expect(adapter.renderOps(ops)).not.toBe(zshAdapter.renderOps(ops));
    });

    test("renderOps uses structured protocol unlike shell-syntax adapters", () => {
      const ops = [{ op: "cd" as const, path: "/some/path" }];
      const result = adapter.renderOps(ops);
      expect(result).toContain("wd-cd:");
      expect(result).not.toContain("cd '");
      expect(result).not.toContain("Set-Location");
    });
  });

  describe("generateWrapper", () => {
    const wrapper = adapter.generateWrapper("wd-bin");

    test("contains def --env wd", () => {
      expect(wrapper).toContain("def --env wd");
    });

    test("does NOT contain def wd without --env", () => {
      expect(wrapper).not.toMatch(/def wd[^-]/);
    });

    test("contains $env.WD_SHELL (modern nushell syntax)", () => {
      expect(wrapper).toContain('$env.WD_SHELL = "nu"');
    });

    test("contains binary name with ^ prefix", () => {
      expect(wrapper).toContain("^wd-bin");
    });

    test("contains $env.LAST_EXIT_CODE", () => {
      expect(wrapper).toContain("$env.LAST_EXIT_CODE");
    });

    test("contains wd-cd: protocol parser", () => {
      expect(wrapper).toContain('"wd-cd:"');
    });

    test("contains wd-run: protocol parser", () => {
      expect(wrapper).toContain('"wd-run:"');
    });

    test("uses cd $path (variable, not quoted literal)", () => {
      expect(wrapper).toContain("cd $path");
    });

    test("contains rm --force (nushell flag syntax)", () => {
      expect(wrapper).toContain("rm --force");
    });

    test("contains ...$args for parameter spreading", () => {
      expect(wrapper).toContain("...$args");
    });

    test("contains wd-complete function", () => {
      expect(wrapper).toContain("def wd-complete");
    });

    test("contains @wd-complete completer attachment", () => {
      expect(wrapper).toContain("@wd-complete");
    });

    test("completion returns records with value and description", () => {
      expect(wrapper).toContain("value:");
      expect(wrapper).toContain("description:");
    });

    test("completion includes all subcommands", () => {
      expect(wrapper).toContain('"setup"');
      expect(wrapper).toContain('"scan"');
      expect(wrapper).toContain('"new"');
      expect(wrapper).toContain('"open"');
      expect(wrapper).toContain('"recent"');
      expect(wrapper).toContain('"ws"');
      expect(wrapper).toContain('"config"');
    });

    test("completion includes ws subcommands with duplicate", () => {
      expect(wrapper).toContain('"duplicate"');
      expect(wrapper).toContain("Duplicate a workspace");
    });

    test("completion uses glob for workspace listing", () => {
      expect(wrapper).toContain("glob ~/.config/wd/workspaces/*.json");
    });

    test("completion uses path parse for basename extraction", () => {
      expect(wrapper).toContain("path parse");
      expect(wrapper).toContain("get stem");
    });

    test("uses custom binary name", () => {
      const custom = adapter.generateWrapper("my-custom-bin");
      expect(custom).toContain("^my-custom-bin");
      expect(custom).not.toContain("^wd-bin");
    });
  });

  describe("setup helpers", () => {
    test("integrationFileName returns wd.nu", () => {
      expect(adapter.integrationFileName()).toBe("wd.nu");
    });

    test("profilePath returns ~/.config/nushell/config.nu", () => {
      expect(adapter.profilePath()).toBe("~/.config/nushell/config.nu");
    });

    test("sourceCommand formats correctly", () => {
      expect(adapter.sourceCommand("/path/to/wd.nu")).toBe(
        "source /path/to/wd.nu",
      );
    });
  });

  test("id is nu", () => {
    expect(adapter.id).toBe("nu");
  });
});
