import type { ShellAdapter, ShellOp } from "./adapter";

export class ZshShellAdapter implements ShellAdapter {
  readonly id = "zsh";

  renderOps(ops: ShellOp[]): string {
    return ops
      .map((op) => {
        switch (op.op) {
          case "cd":
            return `cd ${this.quote(op.path)}`;
          case "run":
            return op.command;
        }
      })
      .join("\n");
  }

  generateWrapper(binaryName: string): string {
    return `# wd - Workspace Director
# Shell integration for zsh
#
# Add to your ~/.zshrc:
#   source ~/.config/wd/wd.zsh

function wd() {
  local tmpfile
  tmpfile=$(mktemp /tmp/wd-cmd.XXXXXX)

  WD_SHELL=zsh ${binaryName} --shell-out="$tmpfile" "$@"
  local exit_code=$?

  if [[ $exit_code -eq 0 && -f "$tmpfile" ]]; then
    local cmd
    cmd=$(cat "$tmpfile")
    if [[ -n "$cmd" ]]; then
      eval "$cmd"
    fi
  fi

  rm -f "$tmpfile"
  return $exit_code
}

_wd_complete() {
  local state
  _arguments \\
    '1: :->subcommand' \\
    '*: :->args'

  case $state in
    subcommand)
      local subcommands=(
        'setup:Configure base directories'
        'scan:Rescan project directories'
        'new:Create a new project from template'
        'open:Open a workspace'
        'recent:Show recently accessed projects'
        'ws:Manage workspaces'
      )
      _describe 'subcommand' subcommands
      ;;
    args)
      case $words[2] in
        open)
          local workspaces
          workspaces=($(ls ~/.config/wd/workspaces/*.json 2>/dev/null | xargs -I{} basename {} .json))
          _describe 'workspace' workspaces
          ;;
        ws)
          case $words[3] in
            edit|delete|duplicate)
              local workspaces
              workspaces=($(ls ~/.config/wd/workspaces/*.json 2>/dev/null | xargs -I{} basename {} .json))
              _describe 'workspace' workspaces
              ;;
            *)
              local ws_cmds=('new:Create a new workspace' 'list:List all workspaces' 'edit:Edit a workspace' 'delete:Delete a workspace' 'duplicate:Duplicate a workspace')
              _describe 'ws command' ws_cmds
              ;;
          esac
          ;;
      esac
      ;;
  esac
}

compdef _wd_complete wd
`;
  }

  integrationFileName(): string {
    return "wd.zsh";
  }

  profilePath(): string {
    return "~/.zshrc";
  }

  sourceCommand(scriptPath: string): string {
    return `source ${scriptPath}`;
  }

  private quote(s: string): string {
    return `'${s.replace(/'/g, "'\\''")}'`;
  }
}
