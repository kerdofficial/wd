const WORKSPACE_SUBCOMMANDS = [
  "new",
  "list",
  "edit",
  "duplicate",
  "delete",
] as const;

export function stripGlobalArgs(argv: string[]): string[] {
  const result: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--shell-out") {
      i++;
      continue;
    }
    if (arg.startsWith("--shell-out=")) {
      continue;
    }
    result.push(arg);
  }

  return result;
}

export function getRootExtraArgs(argv: string[]): string[] {
  return stripGlobalArgs(argv.slice(2));
}

export function getWorkspaceTailArgs(argv: string[]): string[] {
  const wsIndex = argv.indexOf("ws");
  if (wsIndex === -1) return [];
  return stripGlobalArgs(argv.slice(wsIndex + 1));
}

export function getWorkspaceSubcommands(): string[] {
  return [...WORKSPACE_SUBCOMMANDS];
}
