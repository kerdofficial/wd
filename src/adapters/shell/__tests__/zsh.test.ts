import { describe, expect, test } from "bun:test";
import { ZshShellAdapter } from "../zsh";

const adapter = new ZshShellAdapter();

describe("ZshShellAdapter", () => {
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

    test("cd op with spaces in path", () => {
      expect(
        adapter.renderOps([{ op: "cd", path: "/my project/dir" }]),
      ).toBe("cd '/my project/dir'");
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

    test("multiple single quotes in path", () => {
      expect(
        adapter.renderOps([{ op: "cd", path: "/it's/bob's/file" }]),
      ).toBe("cd '/it'\\''s/bob'\\''s/file'");
    });
  });

  describe("generateWrapper", () => {
    const wrapper = adapter.generateWrapper("wd-bin");

    test("contains function definition", () => {
      expect(wrapper).toContain("function wd()");
    });

    test("contains WD_SHELL=zsh", () => {
      expect(wrapper).toContain("WD_SHELL=zsh");
    });

    test("contains binary name", () => {
      expect(wrapper).toContain("wd-bin");
    });

    test("contains compdef completion", () => {
      expect(wrapper).toContain("compdef _wd_complete wd");
    });

    test("completion includes duplicate subcommand", () => {
      expect(wrapper).toContain("duplicate");
    });

    test("contains mktemp for temp file", () => {
      expect(wrapper).toContain("mktemp /tmp/wd-cmd");
    });

    test("contains eval for shell execution", () => {
      expect(wrapper).toContain('eval "$cmd"');
    });

    test("contains cleanup rm", () => {
      expect(wrapper).toContain('rm -f "$tmpfile"');
    });

    test("uses custom binary name", () => {
      const custom = adapter.generateWrapper("my-custom-bin");
      expect(custom).toContain("my-custom-bin");
      expect(custom).not.toContain("wd-bin");
    });
  });

  describe("setup helpers", () => {
    test("integrationFileName returns wd.zsh", () => {
      expect(adapter.integrationFileName()).toBe("wd.zsh");
    });

    test("profilePath returns ~/.zshrc", () => {
      expect(adapter.profilePath()).toBe("~/.zshrc");
    });

    test("sourceCommand formats correctly", () => {
      expect(adapter.sourceCommand("/path/to/wd.zsh")).toBe(
        "source /path/to/wd.zsh",
      );
    });
  });

  test("id is zsh", () => {
    expect(adapter.id).toBe("zsh");
  });
});
