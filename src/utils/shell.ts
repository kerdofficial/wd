import type { ShellAdapter, ShellOp } from "../adapters/shell/adapter";

export class ShellOutput {
  private ops: ShellOp[] = [];

  constructor(
    private readonly filePath: string | undefined,
    private readonly shell: ShellAdapter,
  ) {}

  cd(dirPath: string): void {
    this.ops.push({ op: "cd", path: dirPath });
  }

  run(cmd: string): void {
    this.ops.push({ op: "run", command: cmd });
  }

  async flush(): Promise<void> {
    if (this.filePath && this.ops.length > 0) {
      await Bun.write(this.filePath, this.shell.renderOps(this.ops));
    }
  }

  hasCommands(): boolean {
    return this.ops.length > 0;
  }
}
