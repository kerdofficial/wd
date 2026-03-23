import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ShellOutput } from "../shell";
import { ZshShellAdapter } from "../../adapters/shell/zsh";

const adapter = new ZshShellAdapter();

describe("ShellOutput with ZshShellAdapter", () => {
  test("flush writes cd command to file", async () => {
    const tmpPath = join(tmpdir(), `test-shell-cd-${Date.now()}`);
    const output = new ShellOutput(tmpPath, adapter);
    output.cd("/some/path");
    await output.flush();
    const content = await Bun.file(tmpPath).text();
    expect(content).toBe("cd '/some/path'");
  });

  test("flush writes cd + run to file", async () => {
    const tmpPath = join(tmpdir(), `test-shell-cdrun-${Date.now()}`);
    const output = new ShellOutput(tmpPath, adapter);
    output.cd("/project");
    output.run("bun dev");
    await output.flush();
    const content = await Bun.file(tmpPath).text();
    expect(content).toBe("cd '/project'\nbun dev");
  });

  test("flush does not write when no ops", async () => {
    const tmpPath = join(tmpdir(), `test-shell-empty-${Date.now()}`);
    const output = new ShellOutput(tmpPath, adapter);
    await output.flush();
    expect(await Bun.file(tmpPath).exists()).toBe(false);
  });

  test("flush does nothing without filePath", async () => {
    const output = new ShellOutput(undefined, adapter);
    output.cd("/path");
    await output.flush();
  });

  test("hasCommands returns false initially", () => {
    const output = new ShellOutput(undefined, adapter);
    expect(output.hasCommands()).toBe(false);
  });

  test("hasCommands returns true after cd", () => {
    const output = new ShellOutput(undefined, adapter);
    output.cd("/path");
    expect(output.hasCommands()).toBe(true);
  });

  test("hasCommands returns true after run", () => {
    const output = new ShellOutput(undefined, adapter);
    output.run("echo hello");
    expect(output.hasCommands()).toBe(true);
  });
});
