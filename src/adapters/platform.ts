import type { ShellAdapter } from "./shell/adapter";
import type { TerminalAdapter } from "./terminal/adapter";
import type { ClipboardAdapter } from "./clipboard/adapter";
import { ZshShellAdapter } from "./shell/zsh";
import { BashShellAdapter } from "./shell/bash";
import { FishShellAdapter } from "./shell/fish";
import { PowerShellShellAdapter } from "./shell/pwsh";
import { NushellShellAdapter } from "./shell/nushell";
import { TmuxAdapter, ZellijAdapter } from "./terminal/multiplexer";
import {
  WezTermAdapter,
  KittyAdapter,
  GnomeTerminalAdapter,
  KonsoleAdapter,
} from "./terminal/linux";
import {
  MacOSITerm2Adapter,
  MacOSTerminalAppAdapter,
  MacOSGhosttyAdapter,
  MacOSWarpAdapter,
} from "./terminal/macos";
import { MacOSClipboardAdapter } from "./clipboard/macos";
import { LinuxClipboardAdapter } from "./clipboard/linux";

export type { ShellAdapter } from "./shell/adapter";
export type { ShellOp } from "./shell/adapter";
export type { TerminalAdapter } from "./terminal/adapter";
export type { TerminalCapabilities, TabOpenOptions } from "./terminal/adapter";
export type { ClipboardAdapter } from "./clipboard/adapter";

export interface PlatformContext {
  readonly shell: ShellAdapter;
  readonly terminal: TerminalAdapter | null;
  readonly clipboard: ClipboardAdapter | null;
}

const shellAdapters: ShellAdapter[] = [
  new ZshShellAdapter(),
  new BashShellAdapter(),
  new FishShellAdapter(),
  new PowerShellShellAdapter(),
  new NushellShellAdapter(),
];

const terminalAdapters: TerminalAdapter[] = [
  new TmuxAdapter(),
  new ZellijAdapter(),
  new WezTermAdapter(),
  new KittyAdapter(),
  new MacOSITerm2Adapter(),
  new MacOSTerminalAppAdapter(),
  new MacOSGhosttyAdapter(),
  new MacOSWarpAdapter(),
  new KonsoleAdapter(),
  new GnomeTerminalAdapter(),
];

export function resolveShell(shellId?: string): ShellAdapter {
  if (shellId) {
    const found = shellAdapters.find((a) => a.id === shellId);
    if (found) return found;
  }

  const loginShell = process.env.SHELL;
  if (loginShell) {
    const shellName = loginShell.split("/").at(-1);
    const found = shellAdapters.find((a) => a.id === shellName);
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
  if (process.platform === "darwin") return new MacOSClipboardAdapter();
  if (process.platform === "linux") return new LinuxClipboardAdapter();
  return null;
}

export function initPlatform(): PlatformContext {
  return {
    shell: resolveShell(process.env.WD_SHELL),
    terminal: resolveTerminal(process.env),
    clipboard: resolveClipboard(),
  };
}
