import { $ } from "bun";

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string; // "running", "exited", etc.
  state: string;
}

/**
 * List all Docker containers (running + stopped).
 */
export async function listAllContainers(): Promise<DockerContainer[]> {
  try {
    const format = "{{json .}}";
    const output = await $`docker ps -a --format ${format}`.text();
    const lines = output.trim().split("\n").filter(Boolean);
    return lines
      .map((line) => {
        try {
          const json = JSON.parse(line);
          return {
            id: json.ID ?? "",
            name: json.Names ?? "",
            image: json.Image ?? "",
            status: json.Status ?? "",
            state: json.State ?? "",
          };
        } catch {
          return null;
        }
      })
      .filter((c): c is DockerContainer => c !== null && c.name !== "");
  } catch {
    return [];
  }
}

/**
 * Check if Docker daemon is reachable.
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    await $`docker info`.quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * Start named containers.
 */
export async function startContainers(
  names: string[]
): Promise<{ success: boolean; started: string[]; failed: string[] }> {
  const started: string[] = [];
  const failed: string[] = [];

  await Promise.all(
    names.map(async (name) => {
      try {
        await $`docker start ${name}`.quiet();
        started.push(name);
      } catch {
        failed.push(name);
      }
    })
  );

  return { success: failed.length === 0, started, failed };
}

/**
 * Get the host port numbers that a container wants to bind.
 * Uses HostConfig.PortBindings which is populated even when the container is stopped.
 * Returns port numbers as strings, e.g. ["5432", "6379"].
 */
export async function getContainerPorts(name: string): Promise<string[]> {
  try {
    const format = "{{json .HostConfig.PortBindings}}";
    const output = await $`docker inspect --format ${format} ${name}`.text();
    const bindingsMap: Record<string, Array<{ HostIp: string; HostPort: string }> | null> =
      JSON.parse(output.trim());
    const hostPorts: string[] = [];
    for (const bindings of Object.values(bindingsMap)) {
      if (bindings) {
        for (const b of bindings) {
          if (b.HostPort) hostPorts.push(b.HostPort);
        }
      }
    }
    return hostPorts;
  } catch {
    return [];
  }
}

/**
 * Find which running container is using a given host port.
 * Parses the Ports field of running containers (e.g. "0.0.0.0:5432->5432/tcp").
 * Returns the container name, or null if none found.
 */
export async function findPortConflict(port: string): Promise<string | null> {
  try {
    const format = "{{json .}}";
    const output = await $`docker ps --format ${format}`.text();
    const lines = output.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const container = JSON.parse(line);
      const ports: string = container.Ports ?? "";
      // Ports field looks like "0.0.0.0:5432->5432/tcp, :::5432->5432/tcp"
      if (ports.includes(`:${port}->`)) {
        return container.Names ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Stop a named container.
 */
export async function stopContainer(name: string): Promise<boolean> {
  try {
    await $`docker stop ${name}`.quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * Start services via docker compose.
 */
export async function startDockerCompose(
  projectPath: string,
  composeFile: string,
  services?: string[]
): Promise<{ success: boolean; error?: string }> {
  const composePath = `${projectPath}/${composeFile}`;
  const composeFileObj = Bun.file(composePath);
  if (!(await composeFileObj.exists())) {
    return { success: false, error: `Compose file not found: ${composePath}` };
  }

  const args = ["-f", composePath, "up", "-d"];
  if (services && services.length > 0) {
    args.push(...services);
  }

  try {
    await $`docker compose ${args}`.cwd(projectPath);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
