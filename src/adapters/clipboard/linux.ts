import type { ClipboardAdapter } from "./adapter";
import { commandExists } from "../terminal/helpers";

export class LinuxClipboardAdapter implements ClipboardAdapter {
  private tool: string | null = null;

  async copy(text: string): Promise<void> {
    if (this.tool === null) {
      if (await commandExists("wl-copy")) {
        this.tool = "wl-copy";
      } else if (await commandExists("xclip")) {
        this.tool = "xclip";
      } else {
        return;
      }
    }

    const args =
      this.tool === "xclip" ? ["xclip", "-selection", "clipboard"] : ["wl-copy"];
    const proc = Bun.spawn(args, { stdin: "pipe" });
    proc.stdin.write(text);
    proc.stdin.end();
    await proc.exited;
  }
}
