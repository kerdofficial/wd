import { describe, expect, test, mock } from "bun:test";
import { openWorkspaceTabs } from "../ops";
import type { TerminalAdapter, TabOpenOptions } from "../adapter";

function createMockAdapter(
  tabDelay = 0,
): TerminalAdapter & { calls: TabOpenOptions[] } {
  const calls: TabOpenOptions[] = [];
  return {
    id: "mock",
    capabilities: { nativeCwd: true, nativeCommand: true, tabDelay },
    matches: () => true,
    openTab: async (opts: TabOpenOptions) => {
      calls.push(opts);
    },
    calls,
  };
}

describe("openWorkspaceTabs", () => {
  test("skips first primary tab", async () => {
    const adapter = createMockAdapter();
    await openWorkspaceTabs(
      [
        {
          path: "/primary",
          isPrimary: true,
          tabs: [{ command: "bun dev" }, { command: "bun test" }],
        },
      ],
      adapter,
    );
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]!.cwd).toBe("/primary");
    expect(adapter.calls[0]!.command).toBe("bun test");
  });

  test("opens all tabs for non-primary projects", async () => {
    const adapter = createMockAdapter();
    await openWorkspaceTabs(
      [
        {
          path: "/secondary",
          isPrimary: false,
          tabs: [{ command: "npm run watch" }, { command: "npm test" }],
        },
      ],
      adapter,
    );
    expect(adapter.calls).toHaveLength(2);
    expect(adapter.calls[0]!.command).toBe("npm run watch");
    expect(adapter.calls[1]!.command).toBe("npm test");
  });

  test("passes cwd and command to openTab", async () => {
    const adapter = createMockAdapter();
    await openWorkspaceTabs(
      [
        {
          path: "/project",
          isPrimary: false,
          tabs: [{ command: "bun dev" }],
        },
      ],
      adapter,
    );
    expect(adapter.calls[0]).toEqual({ cwd: "/project", command: "bun dev" });
  });

  test("handles tabs without commands", async () => {
    const adapter = createMockAdapter();
    await openWorkspaceTabs(
      [
        {
          path: "/project",
          isPrimary: false,
          tabs: [{}],
        },
      ],
      adapter,
    );
    expect(adapter.calls[0]).toEqual({ cwd: "/project", command: undefined });
  });

  test("handles projects without tabs", async () => {
    const adapter = createMockAdapter();
    await openWorkspaceTabs(
      [{ path: "/project", isPrimary: false }],
      adapter,
    );
    expect(adapter.calls).toHaveLength(0);
  });

  test("handles empty projects array", async () => {
    const adapter = createMockAdapter();
    await openWorkspaceTabs([], adapter);
    expect(adapter.calls).toHaveLength(0);
  });

  test("primary with no tabs still marks first primary as seen", async () => {
    const adapter = createMockAdapter();
    await openWorkspaceTabs(
      [
        { path: "/primary", isPrimary: true, tabs: [] },
        {
          path: "/primary2",
          isPrimary: true,
          tabs: [{ command: "cmd" }],
        },
      ],
      adapter,
    );
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]!.cwd).toBe("/primary2");
    expect(adapter.calls[0]!.command).toBe("cmd");
  });

  test("error in openTab does not crash the loop", async () => {
    let callCount = 0;
    const adapter: TerminalAdapter = {
      id: "failing",
      capabilities: { nativeCwd: true, nativeCommand: true, tabDelay: 0 },
      matches: () => true,
      openTab: async () => {
        callCount++;
        if (callCount === 1) throw new Error("tab failed");
      },
    };
    await openWorkspaceTabs(
      [
        {
          path: "/project",
          isPrimary: false,
          tabs: [{ command: "fail" }, { command: "succeed" }],
        },
      ],
      adapter,
    );
    expect(callCount).toBe(2);
  });

  test("multiple projects with mixed primary", async () => {
    const adapter = createMockAdapter();
    await openWorkspaceTabs(
      [
        {
          path: "/primary",
          isPrimary: true,
          tabs: [{ command: "first" }, { command: "second" }],
        },
        {
          path: "/secondary",
          isPrimary: false,
          tabs: [{ command: "third" }],
        },
      ],
      adapter,
    );
    expect(adapter.calls).toHaveLength(2);
    expect(adapter.calls[0]!.command).toBe("second");
    expect(adapter.calls[1]!.command).toBe("third");
  });
});
