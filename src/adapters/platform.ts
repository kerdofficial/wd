import type { ShellAdapter } from "./shell/adapter";
import type { TerminalAdapter } from "./terminal/adapter";
import type { ClipboardAdapter } from "./clipboard/adapter";
import { ZshShellAdapter } from "./shell/zsh";
import { FishShellAdapter } from "./shell/fish";
import {
  MacOSITerm2Adapter,
  MacOSTerminalAppAdapter,
  MacOSGhosttyAdapter,
  MacOSWarpAdapter,
} from "./terminal/macos";
import { MacOSClipboardAdapter } from "./clipboard/macos";

export type { ShellAdapter } from "./shell/adapter";
export type { ShellOp } from "./shell/adapter";
export type { TerminalAdapter } from "./terminal/adapter";
export type { ClipboardAdapter } from "./clipboard/adapter";

export interface PlatformContext {
  readonly shell: ShellAdapter;
  readonly terminal: TerminalAdapter | null;
  readonly clipboard: ClipboardAdapter | null;
}

const shellAdapters: ShellAdapter[] = [
  new ZshShellAdapter(),
  new FishShellAdapter(),
];

const terminalAdapters: TerminalAdapter[] = [
  new MacOSITerm2Adapter(),
  new MacOSTerminalAppAdapter(),
  new MacOSGhosttyAdapter(),
  new MacOSWarpAdapter(),
];

export function resolveShell(shellId?: string): ShellAdapter {
  if (shellId) {
    const found = shellAdapters.find((a) => a.id === shellId);
    if (found) return found;
  }
  return shellAdapters[0]!;
}

export function resolveTerminal(
  env: NodeJS.ProcessEnv,
): TerminalAdapter | null {
  return terminalAdapters.find((a) => a.matches(env)) ?? null;
}

export function resolveClipboard(): ClipboardAdapter | null {
  return new MacOSClipboardAdapter();
}

export function initPlatform(): PlatformContext {
  return {
    shell: resolveShell(process.env.WD_SHELL),
    terminal: resolveTerminal(process.env),
    clipboard: resolveClipboard(),
  };
}
