export const WORKSPACE_NAME_PATTERN = /^[a-z0-9-_]+$/;

export function isValidWorkspaceName(name: string): boolean {
  return WORKSPACE_NAME_PATTERN.test(name.trim());
}

export function normalizeWorkspaceName(name: string): string {
  return name.trim().toLowerCase();
}
