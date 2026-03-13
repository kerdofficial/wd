import { describe, expect, test } from "bun:test";
import {
  getRootExtraArgs,
  getWorkspaceTailArgs,
  getWorkspaceSubcommands,
  stripGlobalArgs,
} from "../cli-routing";

describe("cli routing helpers", () => {
  test("stripGlobalArgs removes --shell-out=value", () => {
    expect(stripGlobalArgs(["--shell-out=/tmp/wd-cmd", "foo"])).toEqual(["foo"]);
  });

  test("stripGlobalArgs removes --shell-out <path>", () => {
    expect(stripGlobalArgs(["--shell-out", "/tmp/wd-cmd", "foo"])).toEqual(["foo"]);
  });

  test("getRootExtraArgs keeps real stray args", () => {
    expect(
      getRootExtraArgs(["wd-bin", "--shell-out=/tmp/wd", "foo", "--template", "nextjs"]),
    ).toEqual(["foo", "--template", "nextjs"]);
  });

  test("getRootExtraArgs returns empty when only shell-out is present", () => {
    expect(
      getRootExtraArgs(["bun", "src/index.ts", "--shell-out", "/tmp/wd"]),
    ).toEqual([]);
  });

  test("getWorkspaceTailArgs returns empty for plain ws", () => {
    expect(getWorkspaceTailArgs(["wd-bin", "ws"])).toEqual([]);
  });

  test("getWorkspaceTailArgs returns unknown ws tail", () => {
    expect(
      getWorkspaceTailArgs(["wd-bin", "--shell-out=/tmp/wd", "ws", "bogus"]),
    ).toEqual(["bogus"]);
  });

  test("workspace subcommand list stays explicit", () => {
    expect(getWorkspaceSubcommands()).toEqual([
      "new",
      "list",
      "edit",
      "duplicate",
      "delete",
    ]);
  });
});
