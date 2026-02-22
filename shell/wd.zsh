# wd - Workspace Director
# Shell integration for zsh
#
# Add to your ~/.zshrc:
#   source $(brew --prefix)/share/wd/wd.zsh     # if installed via Homebrew
#   source ~/.config/wd/wd.zsh                   # if installed manually

function wd() {
  local tmpfile
  tmpfile=$(mktemp /tmp/wd-cmd.XXXXXX)

  # Run the binary with the temp file path for shell command output
  wd-bin --shell-out="$tmpfile" "$@"
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

# Tab completion
_wd_complete() {
  local state
  _arguments \
    '1: :->subcommand' \
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
            edit|delete)
              local workspaces
              workspaces=($(ls ~/.config/wd/workspaces/*.json 2>/dev/null | xargs -I{} basename {} .json))
              _describe 'workspace' workspaces
              ;;
            *)
              local ws_cmds=('new:Create a new workspace' 'list:List all workspaces' 'edit:Edit a workspace' 'delete:Delete a workspace')
              _describe 'ws command' ws_cmds
              ;;
          esac
          ;;
      esac
      ;;
  esac
}

compdef _wd_complete wd
