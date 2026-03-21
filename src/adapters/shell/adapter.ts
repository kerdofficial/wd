export type ShellOp =
  | { op: "cd"; path: string }
  | { op: "run"; command: string };

export interface ShellAdapter {
  readonly id: string;
  renderOps(ops: ShellOp[]): string;
  generateWrapper(binaryName: string): string;
  integrationFileName(): string;
  profilePath(): string;
  sourceCommand(scriptPath: string): string;
}
