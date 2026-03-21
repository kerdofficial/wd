import type { ShellAdapter, ShellOp } from "./adapter";

export class NushellShellAdapter implements ShellAdapter {
  readonly id = "nu";

  renderOps(ops: ShellOp[]): string {
    return ops
      .map((op) => {
        switch (op.op) {
          case "cd":
            return `wd-cd:${op.path}`;
          case "run":
            return `wd-run:${op.command}`;
        }
      })
      .join("\n");
  }

  generateWrapper(binaryName: string): string {
    return `# wd - Workspace Director
# Shell integration for Nushell
#
# Add to your ~/.config/nushell/config.nu:
#   source ~/.config/wd/wd.nu

def wd-complete [context: string, position: int] {
  let words = ($context | str trim | split row ' ' | where { |w| $w != '' })
  let word_count = ($words | length)

  if $word_count <= 1 {
    return [
      { value: "setup", description: "Configure base directories" }
      { value: "scan", description: "Rescan project directories" }
      { value: "new", description: "Create a new project from template" }
      { value: "open", description: "Open a workspace" }
      { value: "recent", description: "Show recently accessed projects" }
      { value: "ws", description: "Manage workspaces" }
      { value: "config", description: "Manage settings" }
    ]
  }

  let sub = ($words | get 1)

  if $sub == "open" {
    return (glob ~/.config/wd/workspaces/*.json
      | each { |f| { value: ($f | path parse | get stem), description: "workspace" } })
  }

  if $sub == "ws" {
    if $word_count <= 2 {
      return [
        { value: "new", description: "Create a new workspace" }
        { value: "list", description: "List all workspaces" }
        { value: "edit", description: "Edit a workspace" }
        { value: "delete", description: "Delete a workspace" }
        { value: "duplicate", description: "Duplicate a workspace" }
      ]
    }

    let ws_sub = ($words | get 2)
    if $ws_sub in ["edit", "delete", "duplicate"] {
      return (glob ~/.config/wd/workspaces/*.json
        | each { |f| { value: ($f | path parse | get stem), description: "workspace" } })
    }
  }

  return []
}

def --env wd [...args: string@wd-complete] {
  let tmpfile = (mktemp -t wd-cmd.XXXXXX)

  $env.WD_SHELL = "nu"
  ^${binaryName} --shell-out $tmpfile ...$args
  let exit_code = $env.LAST_EXIT_CODE

  if $exit_code == 0 and ($tmpfile | path exists) {
    for line in (open $tmpfile --raw | lines | where { |l| ($l | str trim) != "" }) {
      if ($line | str starts-with "wd-cd:") {
        let path = ($line | str replace "wd-cd:" "")
        cd $path
      } else if ($line | str starts-with "wd-run:") {
        let cmd = ($line | str replace "wd-run:" "")
        ^nu -c $cmd
      }
    }
  }

  rm --force $tmpfile
}
`;
  }

  integrationFileName(): string {
    return "wd.nu";
  }

  profilePath(): string {
    return "~/.config/nushell/config.nu";
  }

  sourceCommand(scriptPath: string): string {
    return `source ${scriptPath}`;
  }
}
