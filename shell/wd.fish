# wd - Workspace Director
# Shell integration for fish
#
# Add to your ~/.config/fish/config.fish:
#   source ~/.config/wd/wd.fish

function wd
  set -l tmpfile (mktemp /tmp/wd-cmd.XXXXXX)

  env WD_SHELL=fish wd-bin --shell-out="$tmpfile" $argv
  set -l exit_code $status

  if test $exit_code -eq 0 -a -s "$tmpfile"
    source $tmpfile
  end

  rm -f "$tmpfile"
  return $exit_code
end

# Completions
complete -c wd -f
complete -c wd -n '__fish_use_subcommand' -a setup -d 'Configure base directories'
complete -c wd -n '__fish_use_subcommand' -a scan -d 'Rescan project directories'
complete -c wd -n '__fish_use_subcommand' -a new -d 'Create a new project from template'
complete -c wd -n '__fish_use_subcommand' -a open -d 'Open a workspace'
complete -c wd -n '__fish_use_subcommand' -a recent -d 'Show recently accessed projects'
complete -c wd -n '__fish_use_subcommand' -a ws -d 'Manage workspaces'
complete -c wd -n '__fish_use_subcommand' -a config -d 'Manage settings'

complete -c wd -n '__fish_seen_subcommand_from open' -a '(ls ~/.config/wd/workspaces/*.json 2>/dev/null | xargs -I{} basename {} .json)' -f

complete -c wd -n '__fish_seen_subcommand_from ws; and not __fish_seen_subcommand_from new list edit delete duplicate' -a new -d 'Create a new workspace'
complete -c wd -n '__fish_seen_subcommand_from ws; and not __fish_seen_subcommand_from new list edit delete duplicate' -a list -d 'List all workspaces'
complete -c wd -n '__fish_seen_subcommand_from ws; and not __fish_seen_subcommand_from new list edit delete duplicate' -a edit -d 'Edit a workspace'
complete -c wd -n '__fish_seen_subcommand_from ws; and not __fish_seen_subcommand_from new list edit delete duplicate' -a delete -d 'Delete a workspace'
complete -c wd -n '__fish_seen_subcommand_from ws; and not __fish_seen_subcommand_from new list edit delete duplicate' -a duplicate -d 'Duplicate a workspace'

complete -c wd -n '__fish_seen_subcommand_from edit delete duplicate' -a '(ls ~/.config/wd/workspaces/*.json 2>/dev/null | xargs -I{} basename {} .json)' -f
