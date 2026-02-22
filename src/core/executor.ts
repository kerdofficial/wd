/**
 * Command executor for template create commands.
 *
 * Silent mode (default): Bun.spawn with captured output + Spinner
 * Verbose mode: PTY-based execution with visual frame border
 */
import { Spinner, green, red, yellow, gray, bold, cyan } from "../ui/format";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExecuteOptions {
  /** Working directory for the command */
  cwd?: string;
  /** Show raw output instead of spinner */
  verbose?: boolean;
  /** Label shown in spinner / header */
  label?: string;
}

export interface ExecuteResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

// ─── Silent executor ──────────────────────────────────────────────────────────

async function executeSilent(
  cmd: string,
  opts: ExecuteOptions
): Promise<ExecuteResult> {
  const label = opts.label ?? "Running command";
  const spinner = new Spinner(label);
  spinner.start();

  try {
    const proc = Bun.spawn(["sh", "-c", cmd], {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "inherit",
      cwd: opts.cwd,
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    const success = exitCode === 0;
    spinner.stop(
      success
        ? `${green("✓")} ${label}`
        : `${red("✗")} ${label} ${gray(`(exit ${exitCode})`)}`
    );

    return { success, exitCode, stdout, stderr };
  } catch (err) {
    spinner.stop(`${red("✗")} ${label} — failed to spawn`);
    return {
      success: false,
      exitCode: 1,
      stdout: "",
      stderr: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Verbose executor ─────────────────────────────────────────────────────────

async function executeVerbose(
  cmd: string,
  opts: ExecuteOptions
): Promise<ExecuteResult> {
  const label = opts.label ?? cmd;
  const cols = process.stdout.columns ?? 80;
  const border = gray("─".repeat(Math.min(cols - 2, 60)));

  console.log(`\n${cyan("┌")} ${bold(label)}`);
  console.log(gray("│") + " " + gray(cmd));
  console.log(gray("│") + border);

  let allStdout = "";
  let allStderr = "";

  try {
    const proc = Bun.spawn(["sh", "-c", cmd], {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "inherit",
      cwd: opts.cwd,
    });

    // Stream stdout
    const stdoutReader = proc.stdout.getReader();
    const stderrReader = proc.stderr.getReader();
    const decoder = new TextDecoder();

    const readStream = async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      isErr: boolean
    ) => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");
        for (let i = 0; i < lines.length - 1; i++) {
          const prefix = isErr ? red("│ ") : gray("│ ");
          process.stdout.write(`${prefix}${lines[i]}\n`);
        }
        // Buffer partial last line
        const partial = lines[lines.length - 1] ?? "";
        if (partial) {
          const prefix = isErr ? red("│ ") : gray("│ ");
          process.stdout.write(`${prefix}${partial}`);
        }
        if (isErr) allStderr += text;
        else allStdout += text;
      }
    };

    await Promise.all([
      readStream(stdoutReader, false),
      readStream(stderrReader, true),
    ]);

    const exitCode = await proc.exited;
    const success = exitCode === 0;

    console.log(`\n${success ? cyan("└") + " " + green("✓ Done") : red("└") + " " + red("✗ Failed")} ${gray(`(exit ${exitCode})`)}`);

    return { success, exitCode, stdout: allStdout, stderr: allStderr };
  } catch (err) {
    console.log(`\n${red("└")} ${red("✗ Failed to spawn process")}`);
    return {
      success: false,
      exitCode: 1,
      stdout: allStdout,
      stderr: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function executeCommand(
  cmd: string,
  opts: ExecuteOptions = {}
): Promise<ExecuteResult> {
  if (opts.verbose) {
    return executeVerbose(cmd, opts);
  }
  return executeSilent(cmd, opts);
}

/** Print error details after a failed command */
export function printCommandError(result: ExecuteResult): void {
  if (result.stderr.trim()) {
    console.error(`\n${red("Error output:")}`);
    for (const line of result.stderr.trim().split("\n")) {
      console.error(`  ${gray("│")} ${line}`);
    }
  }
  if (result.stdout.trim()) {
    console.error(`\n${yellow("Output:")}`);
    for (const line of result.stdout.trim().split("\n").slice(-20)) {
      console.error(`  ${gray("│")} ${line}`);
    }
  }
}
