import { describe, expect, test } from "bun:test";
import { BashShellAdapter } from "../bash";

const adapter = new BashShellAdapter();

describe("BashShellAdapter", () => {
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
  });

  describe("generateWrapper", () => {
    const wrapper = adapter.generateWrapper("wd-bin");

    test("contains function definition", () => {
      expect(wrapper).toContain("function wd()");
    });

    test("contains WD_SHELL=bash", () => {
      expect(wrapper).toContain("WD_SHELL=bash");
    });

    test("contains binary name", () => {
      expect(wrapper).toContain("wd-bin");
    });

    test("contains bash completion registration", () => {
      expect(wrapper).toContain("complete -F _wd_complete wd");
    });

    test("completion includes all subcommands", () => {
      expect(wrapper).toContain("setup scan new open recent ws config");
    });

    test("completion includes ws subcommands", () => {
      expect(wrapper).toContain("new list edit delete duplicate");
    });

    test("completion uses COMPREPLY and compgen", () => {
      expect(wrapper).toContain("COMPREPLY=");
      expect(wrapper).toContain("compgen -W");
    });

    test("completion uses COMP_WORDS and COMP_CWORD", () => {
      expect(wrapper).toContain("COMP_WORDS");
      expect(wrapper).toContain("COMP_CWORD");
    });

    test("contains mktemp for temp file", () => {
      expect(wrapper).toContain("mktemp /tmp/wd-cmd");
    });

    test("contains eval for shell execution", () => {
      expect(wrapper).toContain('eval "$cmd"');
    });

    test("uses custom binary name", () => {
      const custom = adapter.generateWrapper("my-custom-bin");
      expect(custom).toContain("my-custom-bin");
      expect(custom).not.toContain("wd-bin");
    });

    test("mentions bash_profile in header comment", () => {
      expect(wrapper).toContain("bash_profile");
    });
  });

  describe("setup helpers", () => {
    test("integrationFileName returns wd.bash", () => {
      expect(adapter.integrationFileName()).toBe("wd.bash");
    });

    test("profilePath returns ~/.bashrc", () => {
      expect(adapter.profilePath()).toBe("~/.bashrc");
    });

    test("sourceCommand formats correctly", () => {
      expect(adapter.sourceCommand("/path/to/wd.bash")).toBe(
        "source /path/to/wd.bash",
      );
    });
  });

  test("id is bash", () => {
    expect(adapter.id).toBe("bash");
  });

  test("renderOps produces identical output to zsh for same ops", () => {
    const { ZshShellAdapter } = require("../zsh");
    const zshAdapter = new ZshShellAdapter();
    const ops = [
      { op: "cd" as const, path: "/some/path" },
      { op: "run" as const, command: "npm start" },
    ];
    expect(adapter.renderOps(ops)).toBe(zshAdapter.renderOps(ops));
  });
});
