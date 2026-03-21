import { describe, expect, test } from "bun:test";
import { PowerShellShellAdapter } from "../pwsh";

const adapter = new PowerShellShellAdapter();

describe("PowerShellShellAdapter", () => {
  describe("renderOps", () => {
    test("cd op uses Set-Location", () => {
      const result = adapter.renderOps([{ op: "cd", path: "/my/path" }]);
      expect(result).toContain("Set-Location");
      expect(result).not.toBe("cd '/my/path'");
    });

    test("cd op with simple path", () => {
      expect(adapter.renderOps([{ op: "cd", path: "/my/path" }])).toBe(
        "Set-Location '/my/path'",
      );
    });

    test("cd op escapes single quotes with doubling", () => {
      expect(adapter.renderOps([{ op: "cd", path: "/it's/here" }])).toBe(
        "Set-Location '/it''s/here'",
      );
    });

    test("cd op with multiple single quotes", () => {
      expect(
        adapter.renderOps([{ op: "cd", path: "/it's/bob's/file" }]),
      ).toBe("Set-Location '/it''s/bob''s/file'");
    });

    test("cd op with spaces in path", () => {
      expect(
        adapter.renderOps([{ op: "cd", path: "/my project/dir" }]),
      ).toBe("Set-Location '/my project/dir'");
    });

    test("run op passes command unchanged", () => {
      expect(
        adapter.renderOps([{ op: "run", command: "Write-Host 'hello'" }]),
      ).toBe("Write-Host 'hello'");
    });

    test("multiple ops joined with newline", () => {
      expect(
        adapter.renderOps([
          { op: "cd", path: "/project" },
          { op: "run", command: "bun dev" },
        ]),
      ).toBe("Set-Location '/project'\nbun dev");
    });

    test("empty ops returns empty string", () => {
      expect(adapter.renderOps([])).toBe("");
    });

    test("renderOps output DIFFERS from zsh for paths with quotes", () => {
      const { ZshShellAdapter } = require("../zsh");
      const zshAdapter = new ZshShellAdapter();
      const ops = [{ op: "cd" as const, path: "/it's/here" }];
      expect(adapter.renderOps(ops)).not.toBe(zshAdapter.renderOps(ops));
    });

    test("renderOps output DIFFERS from zsh for simple paths (Set-Location vs cd)", () => {
      const { ZshShellAdapter } = require("../zsh");
      const zshAdapter = new ZshShellAdapter();
      const ops = [{ op: "cd" as const, path: "/simple/path" }];
      expect(adapter.renderOps(ops)).not.toBe(zshAdapter.renderOps(ops));
    });
  });

  describe("generateWrapper", () => {
    const wrapper = adapter.generateWrapper("wd-bin");

    test("contains PowerShell function syntax", () => {
      expect(wrapper).toContain("function wd {");
    });

    test("contains $env:WD_SHELL = 'pwsh'", () => {
      expect(wrapper).toContain("$env:WD_SHELL = 'pwsh'");
    });

    test("contains env var cleanup", () => {
      expect(wrapper).toContain("$env:WD_SHELL = $null");
    });

    test("contains New-TemporaryFile", () => {
      expect(wrapper).toContain("New-TemporaryFile");
    });

    test("contains call operator with binary name", () => {
      expect(wrapper).toContain("& wd-bin");
    });

    test("contains Invoke-Expression for temp file execution", () => {
      expect(wrapper).toContain("Invoke-Expression");
    });

    test("contains $LASTEXITCODE", () => {
      expect(wrapper).toContain("$LASTEXITCODE");
    });

    test("contains Remove-Item cleanup", () => {
      expect(wrapper).toContain("Remove-Item");
    });

    test("contains Register-ArgumentCompleter", () => {
      expect(wrapper).toContain("Register-ArgumentCompleter");
    });

    test("contains CompletionResult type", () => {
      expect(wrapper).toContain("CompletionResult");
    });

    test("completion includes all subcommands", () => {
      expect(wrapper).toContain("'setup'");
      expect(wrapper).toContain("'scan'");
      expect(wrapper).toContain("'new'");
      expect(wrapper).toContain("'open'");
      expect(wrapper).toContain("'recent'");
      expect(wrapper).toContain("'ws'");
      expect(wrapper).toContain("'config'");
    });

    test("completion includes subcommand descriptions", () => {
      expect(wrapper).toContain("Configure base directories");
      expect(wrapper).toContain("Open a workspace");
      expect(wrapper).toContain("Manage workspaces");
    });

    test("completion includes ws subcommands with duplicate", () => {
      expect(wrapper).toContain("'duplicate'");
      expect(wrapper).toContain("Duplicate a workspace");
    });

    test("completion uses Get-ChildItem for workspace listing", () => {
      expect(wrapper).toContain("Get-ChildItem");
    });

    test("uses custom binary name", () => {
      const custom = adapter.generateWrapper("my-custom-bin");
      expect(custom).toContain("& my-custom-bin");
      expect(custom).not.toContain("& wd-bin");
    });

    test("mentions $PROFILE in header comment", () => {
      expect(wrapper).toContain("$PROFILE");
    });
  });

  describe("setup helpers", () => {
    test("integrationFileName returns wd.ps1", () => {
      expect(adapter.integrationFileName()).toBe("wd.ps1");
    });

    test("profilePath returns PowerShell profile path", () => {
      expect(adapter.profilePath()).toBe(
        "~/.config/powershell/Microsoft.PowerShell_profile.ps1",
      );
    });

    test("sourceCommand uses dot-sourcing", () => {
      expect(adapter.sourceCommand("/path/to/wd.ps1")).toBe(
        ". /path/to/wd.ps1",
      );
    });
  });

  test("id is pwsh", () => {
    expect(adapter.id).toBe("pwsh");
  });
});
