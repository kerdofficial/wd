import { describe, expect, test } from "bun:test";
import { FishShellAdapter } from "../fish";

const adapter = new FishShellAdapter();

describe("FishShellAdapter", () => {
  describe("renderOps", () => {
    test("cd op with simple path", () => {
      expect(adapter.renderOps([{ op: "cd", path: "/my/path" }])).toBe(
        "cd '/my/path'",
      );
    });

    test("cd op escapes single quotes", () => {
      expect(adapter.renderOps([{ op: "cd", path: "/it's/here" }])).toBe(
        "cd '/it'\\''s/here'",
      );
    });

    test("run op passes command unchanged", () => {
      expect(
        adapter.renderOps([{ op: "run", command: "echo hello && ls" }]),
      ).toBe("echo hello && ls");
    });

    test("multiple ops joined with newline", () => {
      expect(
        adapter.renderOps([
          { op: "cd", path: "/project" },
          { op: "run", command: "bun dev" },
        ]),
      ).toBe("cd '/project'\nbun dev");
    });

    test("empty ops returns empty string", () => {
      expect(adapter.renderOps([])).toBe("");
    });
  });

  describe("generateWrapper", () => {
    const wrapper = adapter.generateWrapper("wd-bin");

    test("contains fish function syntax (no parens)", () => {
      expect(wrapper).toContain("function wd\n");
    });

    test("does NOT contain POSIX function syntax", () => {
      expect(wrapper).not.toContain("function wd()");
    });

    test("contains 'end' for function closing", () => {
      expect(wrapper).toContain("\nend\n");
    });

    test("contains WD_SHELL=fish", () => {
      expect(wrapper).toContain("WD_SHELL=fish");
    });

    test("uses env command for WD_SHELL", () => {
      expect(wrapper).toContain("env WD_SHELL=fish");
    });

    test("contains binary name", () => {
      expect(wrapper).toContain("wd-bin");
    });

    test("uses source instead of eval for temp file", () => {
      expect(wrapper).toContain("source $tmpfile");
      expect(wrapper).not.toContain("eval");
    });

    test("uses set -l for local variables", () => {
      expect(wrapper).toContain("set -l tmpfile");
      expect(wrapper).toContain("set -l exit_code");
    });

    test("uses $status for exit code", () => {
      expect(wrapper).toContain("$status");
    });

    test("uses $argv for arguments", () => {
      expect(wrapper).toContain("$argv");
    });

    test("uses test for conditionals (not [[)", () => {
      expect(wrapper).toContain("test $exit_code");
      expect(wrapper).not.toContain("[[");
    });

    test("contains fish completion registration", () => {
      expect(wrapper).toContain("complete -c wd");
    });

    test("completions include descriptions", () => {
      expect(wrapper).toContain("-d 'Configure base directories'");
      expect(wrapper).toContain("-d 'Open a workspace'");
      expect(wrapper).toContain("-d 'Manage workspaces'");
    });

    test("completions include all subcommands", () => {
      expect(wrapper).toContain("-a setup");
      expect(wrapper).toContain("-a scan");
      expect(wrapper).toContain("-a new");
      expect(wrapper).toContain("-a open");
      expect(wrapper).toContain("-a recent");
      expect(wrapper).toContain("-a ws");
      expect(wrapper).toContain("-a config");
    });

    test("completions include ws subcommands with duplicate", () => {
      expect(wrapper).toContain("-a duplicate -d 'Duplicate a workspace'");
    });

    test("completions use __fish_use_subcommand", () => {
      expect(wrapper).toContain("__fish_use_subcommand");
    });

    test("completions use __fish_seen_subcommand_from", () => {
      expect(wrapper).toContain("__fish_seen_subcommand_from");
    });

    test("uses custom binary name", () => {
      const custom = adapter.generateWrapper("my-custom-bin");
      expect(custom).toContain("my-custom-bin");
      expect(custom).not.toContain("wd-bin");
    });
  });

  describe("setup helpers", () => {
    test("integrationFileName returns wd.fish", () => {
      expect(adapter.integrationFileName()).toBe("wd.fish");
    });

    test("profilePath returns ~/.config/fish/config.fish", () => {
      expect(adapter.profilePath()).toBe("~/.config/fish/config.fish");
    });

    test("sourceCommand formats correctly", () => {
      expect(adapter.sourceCommand("/path/to/wd.fish")).toBe(
        "source /path/to/wd.fish",
      );
    });
  });

  test("id is fish", () => {
    expect(adapter.id).toBe("fish");
  });

  test("renderOps produces identical output to zsh/bash for same ops", () => {
    const { ZshShellAdapter } = require("../zsh");
    const zshAdapter = new ZshShellAdapter();
    const ops = [
      { op: "cd" as const, path: "/some/path" },
      { op: "run" as const, command: "npm start" },
    ];
    expect(adapter.renderOps(ops)).toBe(zshAdapter.renderOps(ops));
  });
});
