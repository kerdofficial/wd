import type { ClipboardAdapter } from "./adapter";

export class MacOSClipboardAdapter implements ClipboardAdapter {
  async copy(text: string): Promise<void> {
    const proc = Bun.spawn(["pbcopy"], { stdin: "pipe" });
    proc.stdin.write(text);
    proc.stdin.end();
    await proc.exited;
  }
}
