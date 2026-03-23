import { describe, expect, test } from "bun:test";
import {
  posixShellQuote,
  buildPosixCmd,
  appleScriptQuote,
  commandExists,
} from "../helpers";

describe("posixShellQuote", () => {
  test("wraps in single quotes", () => {
    expect(posixShellQuote("/my/path")).toBe("'/my/path'");
  });

  test("escapes single quotes", () => {
    expect(posixShellQuote("it's")).toBe("'it'\\''s'");
  });

  test("handles spaces", () => {
    expect(posixShellQuote("/my project/dir")).toBe("'/my project/dir'");
  });

  test("handles empty string", () => {
    expect(posixShellQuote("")).toBe("''");
  });

  test("handles multiple single quotes", () => {
    expect(posixShellQuote("it's a 'test'")).toBe("'it'\\''s a '\\''test'\\'''");
  });
});

describe("buildPosixCmd", () => {
  test("cd only when no command", () => {
    expect(buildPosixCmd("/my/path")).toBe("cd '/my/path'");
  });

  test("cd && command when command provided", () => {
    expect(buildPosixCmd("/my/path", "bun dev")).toBe(
      "cd '/my/path' && bun dev",
    );
  });

  test("escapes path with single quotes", () => {
    expect(buildPosixCmd("/it's/here", "npm start")).toBe(
      "cd '/it'\\''s/here' && npm start",
    );
  });

  test("handles spaces in path", () => {
    expect(buildPosixCmd("/my project")).toBe("cd '/my project'");
  });
});

describe("appleScriptQuote", () => {
  test("wraps in double quotes", () => {
    expect(appleScriptQuote("hello")).toBe('"hello"');
  });

  test("escapes double quotes", () => {
    expect(appleScriptQuote('say "hi"')).toBe('"say \\"hi\\""');
  });

  test("escapes backslashes", () => {
    expect(appleScriptQuote("path\\to")).toBe('"path\\\\to"');
  });

  test("escapes both", () => {
    expect(appleScriptQuote('a\\b"c')).toBe('"a\\\\b\\"c"');
  });
});

describe("commandExists", () => {
  test("returns true for ls", async () => {
    expect(await commandExists("ls")).toBe(true);
  });

  test("returns false for nonexistent command", async () => {
    expect(await commandExists("wd-nonexistent-binary-xyz")).toBe(false);
  });
});
