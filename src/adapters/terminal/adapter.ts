export interface TerminalAdapter {
  readonly id: string;
  matches(env: NodeJS.ProcessEnv): boolean;
  openTab(opts: { cwd: string; command?: string }): Promise<void>;
}
