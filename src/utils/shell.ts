/**
 * Shell output protocol.
 *
 * The binary writes shell commands to a temp file.
 * The wd() zsh function reads and evals those commands
 * so they run in the parent shell (enabling `cd`).
 */
export class ShellOutput {
  private commands: string[] = [];

  constructor(private readonly filePath: string | undefined) {}

  cd(dirPath: string): void {
    this.commands.push(`cd ${this.quote(dirPath)}`);
  }

  /** Append an arbitrary shell command to be eval'd in the parent shell. */
  run(cmd: string): void {
    this.commands.push(cmd);
  }

  private quote(s: string): string {
    // Single-quote with internal single-quote escaping
    return `'${s.replace(/'/g, "'\\''")}'`;
  }

  async flush(): Promise<void> {
    if (this.filePath) {
      await Bun.write(this.filePath, this.commands.join("\n"));
    }
  }

  hasCommands(): boolean {
    return this.commands.length > 0;
  }
}
