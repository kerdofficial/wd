# wd - Workspace Director

![Version](https://img.shields.io/badge/version-1.4.0-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

A fast CLI tool for navigating between projects, creating new apps from templates, and launching development workspaces. Built with TypeScript and Bun. Works on macOS and Linux.

## The problem

When you have dozens (or hundreds) of projects spread across multiple directories, getting to the right one is friction. You `cd` into the wrong folder, you forget the exact directory name, you open four terminal tabs manually every time you start working on a project.

`wd` solves the navigation part, adds a workspace system so a single command can drop you into the right directory and start your usual setup, and includes a Project Constructor for creating new projects from templates.

## Features

- **Fuzzy project search** - type a few letters, pick a project, done
- **Frecency ranking** - projects you use most recently and frequently appear first
- **Configurable scan roots** - point it at any directories, it finds all your projects automatically
- **Project type detection** - recognizes Next.js, NestJS, Angular, Flutter, Swift, Rust, Tauri, and more
- **Project Constructor** - create new projects from built-in or local custom templates with interactive or flag-driven flows
- **Workspace profiles** - group related projects (e.g. frontend + backend) and attach Docker containers
- **Workspace browser** - inspect, open, edit, duplicate, or delete workspaces from an interactive `wd ws` menu
- **Terminal tab opening** - each workspace project can specify tabs to open with commands (`bun dev`, `claude`, etc.), with support for 10 terminal emulators across macOS and Linux
- **Docker integration** - start named containers or docker-compose services when opening a workspace
- **Docker port conflict resolution** - if a container fails due to a port conflict, wd detects which container is blocking and offers to stop it
- **Interactive configuration menu** - manage scan roots, custom types, preferences, ignore rules, and template source settings with `wd config`
- **Custom project types and templates** - extend detection rules and add your own local templates
- **Multi-shell support** - zsh, bash, fish, PowerShell, and Nushell with native completion for each
- **Shell integration** - actually changes your working directory (not just prints a path)

## Requirements

- **macOS** (primary, tested on macOS 26) or **Linux** (experimental)
- **Shell** - zsh (default), bash, fish, PowerShell (pwsh), or Nushell
- [Bun](https://bun.sh) - for building from source
- [OrbStack](https://orbstack.dev) or Docker Desktop - for Docker features (optional)

> **Linux support is experimental.** Terminal tab opening has been tested on Ubuntu with Ptyxis, Konsole, tmux, and Zellij. If you encounter issues on your distribution, please [open an issue](https://github.com/kerdofficial/wd/issues).

## Installation

### Homebrew (recommended)

```sh
brew install kerdofficial/tap/wd
```

Then run first-time setup:

```sh
wd setup
```

`wd setup` detects your shell and shows the exact line to add to your profile.

### Updating

```sh
brew update && brew upgrade wd
```

### Manual

```sh
git clone https://github.com/kerdofficial/wd
cd wd
bun install
bun run build
```

Then link the binary to somewhere on your `$PATH`:

```sh
ln -sf "$(pwd)/dist/wd-bin" ~/.local/bin/wd-bin
```

### First-time setup

Run first-time setup (for both Homebrew and manual installs):

```sh
wd setup
```

`wd setup` creates `~/.config/wd/`, generates and installs the shell wrapper for your shell, offers an initial scan, and tells you the exact line to add to your profile. Supported shells:

| Shell      | Profile                                     | Integration file |
| ---------- | ------------------------------------------- | ---------------- |
| zsh        | `~/.zshrc`                                  | `wd.zsh`         |
| bash       | `~/.bashrc` (or `~/.bash_profile` on macOS) | `wd.bash`        |
| fish       | `~/.config/fish/config.fish`                | `wd.fish`        |
| PowerShell | `$PROFILE`                                  | `wd.ps1`         |
| Nushell    | `~/.config/nushell/config.nu`               | `wd.nu`          |

Restart your shell afterwards.

## Quick start

```sh
# Configure scan roots and install the shell wrapper
wd setup

# Navigate to a project
wd

# See recently visited projects
wd recent

# Create a new project from a template
wd new my-app -t nextjs

# Manage scan roots, preferences, custom types, and template source settings
wd config

# Create a workspace
wd ws new

# Browse workspaces interactively
wd ws

# Duplicate an existing workspace
wd ws duplicate my-workspace

# Open a workspace (cd + Docker + tabs)
wd open my-workspace

# Rescan after adding or moving projects
wd scan
```

## How it works

`wd` scans the directories you configure and builds a cache of all your projects. When you run `wd`, it shows an interactive fuzzy search over that list. Projects you visit frequently and recently appear at the top.

Because a child process cannot change your shell's working directory, `wd` uses a shell function wrapper. The binary writes a `cd` command to a temp file, and the `wd` shell function evals it. This is the same pattern used by tools like `zoxide` and `nvm`.

When opening a workspace, `wd` opens additional terminal tabs using the best available method for your terminal. It supports 10 terminals across macOS and Linux:

| Terminal                | Platform       | Method                                         |
| ----------------------- | -------------- | ---------------------------------------------- |
| tmux                    | Cross-platform | `tmux new-window` + `send-keys`                |
| Zellij                  | Cross-platform | `zellij action new-tab` + `write-chars`        |
| WezTerm                 | Cross-platform | `wezterm cli spawn` + `send-text`              |
| kitty                   | Cross-platform | `kitten @ launch` + `send-text`                |
| iTerm2                  | macOS          | Native AppleScript API                         |
| Terminal.app            | macOS          | AppleScript `do script`                        |
| Ghostty                 | macOS          | Keystroke simulation                           |
| Warp                    | macOS          | Keystroke simulation                           |
| GNOME Terminal / Ptyxis | Linux          | CLI (`ptyxis --tab` or `gnome-terminal --tab`) |
| Konsole                 | Linux          | D-Bus (`qdbus`) with CLI fallback              |

Multiplexers (tmux, Zellij) are detected first, so they work inside any terminal.

### Coming soon

- **[cmux](https://cmux.com) support** - native integration with cmux's Unix socket API for workspace/pane/tab management, purpose-built for AI coding agent workflows
- **Redesigned workspace tab layout** - a new tab configuration system in the Project Constructor, designed to take advantage of cmux's workspace/pane hierarchy and split views

`wd new` loads templates from a default remote source, merges them with local templates from `~/.config/wd/templates/`, caches remote templates locally, and then runs the selected template command with your chosen options.

## Configuration

All config lives in `~/.config/wd/`. Most day-to-day settings can be managed from `wd config`.

| File                            | Purpose                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| `config.json`                   | Scan roots, preferences, custom types, and template source URL |
| `cache.json`                    | Cached project list (auto-refreshed every 24h)                 |
| `history.json`                  | Visit history for frecency ranking                             |
| `workspaces/`                   | Workspace definition files                                     |
| `templates/`                    | Local custom templates and template cache                      |
| `templates/template-cache.json` | Cached remote templates used by `wd new`                       |

## License

[MIT](LICENSE)
