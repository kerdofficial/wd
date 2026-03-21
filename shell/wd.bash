# wd - Workspace Director
# Shell integration for bash
#
# Add to your ~/.bashrc (or ~/.bash_profile on macOS):
#   source ~/.config/wd/wd.bash

function wd() {
  local tmpfile
  tmpfile=$(mktemp /tmp/wd-cmd.XXXXXX)

  WD_SHELL=bash wd-bin --shell-out="$tmpfile" "$@"
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
  local cur
  cur="${COMP_WORDS[COMP_CWORD]}"

  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=($(compgen -W "setup scan new open recent ws config" -- "$cur"))
    return
  fi

  case "${COMP_WORDS[1]}" in
    open)
      local workspaces
      workspaces=$(ls ~/.config/wd/workspaces/*.json 2>/dev/null | xargs -I{} basename {} .json)
      COMPREPLY=($(compgen -W "$workspaces" -- "$cur"))
      ;;
    ws)
      if [[ $COMP_CWORD -eq 2 ]]; then
        COMPREPLY=($(compgen -W "new list edit delete duplicate" -- "$cur"))
      elif [[ $COMP_CWORD -eq 3 ]]; then
        case "${COMP_WORDS[2]}" in
          edit|delete|duplicate)
            local workspaces
            workspaces=$(ls ~/.config/wd/workspaces/*.json 2>/dev/null | xargs -I{} basename {} .json)
            COMPREPLY=($(compgen -W "$workspaces" -- "$cur"))
            ;;
        esac
      fi
      ;;
  esac
}

complete -F _wd_complete wd
