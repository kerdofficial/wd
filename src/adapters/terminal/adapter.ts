export interface TabOpenOptions {
  cwd: string;
  command?: string;
}

export interface TerminalCapabilities {
  readonly nativeCwd: boolean;
  readonly nativeCommand: boolean;
  readonly tabDelay: number;
}

export interface TerminalAdapter {
  readonly id: string;
  readonly capabilities: TerminalCapabilities;
  matches(env: NodeJS.ProcessEnv): boolean;
  openTab(opts: TabOpenOptions): Promise<void>;
}
