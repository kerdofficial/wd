export async function gracefulRun(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("User force closed") ||
        err.message.includes("force closed the prompt"))
    ) {
      console.log("\n  Exiting wd...\n");
      process.exit(0);
    }
    throw err;
  }
}
