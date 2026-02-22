import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".config", "wd");

export const paths = {
  configDir: CONFIG_DIR,
  config: join(CONFIG_DIR, "config.json"),
  cache: join(CONFIG_DIR, "cache.json"),
  history: join(CONFIG_DIR, "history.json"),
  shellScript: join(CONFIG_DIR, "wd.zsh"),
  workspacesDir: join(CONFIG_DIR, "workspaces"),

  workspace(name: string): string {
    return join(CONFIG_DIR, "workspaces", `${name}.json`);
  },

  templateCache: join(CONFIG_DIR, "template-cache.json"),
  templatesDir: join(CONFIG_DIR, "templates"),

  template(name: string): string {
    return join(CONFIG_DIR, "templates", `${name}.json`);
  },
} as const;
