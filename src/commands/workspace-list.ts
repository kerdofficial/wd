import { listWorkspaces } from "../config/manager";
import { bold, cyan, gray, green, yellow, dim } from "../ui/format";

export async function workspaceList(): Promise<void> {
  const workspaces = await listWorkspaces();

  if (workspaces.length === 0) {
    console.log(
      '\nNo workspaces configured. Run "wd ws new" to create one.\n'
    );
    return;
  }

  console.log(`\n${bold("Workspaces")}\n`);

  for (const ws of workspaces) {
    const primary = ws.projects.find((p) => p.isPrimary);
    const primaryName = primary?.path.split("/").at(-1) ?? "—";

    console.log(`  ${bold(cyan(ws.name))}`);
    if (ws.description) {
      console.log(`    ${gray(ws.description)}`);
    }

    // Projects
    for (const p of ws.projects) {
      const name = p.path.split("/").at(-1) ?? p.path;
      const tag = p.isPrimary ? green(" (primary)") : "";
      console.log(`    ${gray("→")} ${name}${tag}`);
    }

    // Docker
    if (ws.docker) {
      if (ws.docker.containers.length > 0) {
        console.log(
          `    ${gray("🐳")} Containers: ${ws.docker.containers.join(", ")}`
        );
      }
      if (ws.docker.compose) {
        console.log(
          `    ${gray("🐳")} Compose: ${ws.docker.compose.file} ${gray("in")} ${ws.docker.compose.path.split("/").at(-1)}`
        );
      }
    }

    console.log();
  }

  console.log(gray(`  Run "wd open <name>" to open a workspace.\n`));
}
