# wd — Workspace Director

A fast macOS CLI tool for navigating between projects, creating new apps from templates, and launching development workspaces. Built with TypeScript and Bun.

## The problem

When you have dozens (or hundreds) of projects spread across multiple directories, getting to the right one is friction. You `cd` into the wrong folder, you forget the exact directory name, you open four terminal tabs manually every time you start working on a project.

`wd` solves the navigation part, adds a workspace system so a single command can drop you into the right directory and start your usual setup, and includes a Project Constructor for creating new projects from templates.

## Features

- **Fuzzy project search** — type a few letters, pick a project, done
- **Frecency ranking** — projects you use most recently and frequently appear first
- **Configurable scan roots** — point it at any directories, it finds all your projects automatically
- **Project type detection** — recognizes Next.js, NestJS, Angular, Flutter, Swift, Rust, Tauri, and more
- **Project Constructor** — create new projects from built-in or local custom templates with interactive or flag-driven flows
- **Workspace profiles** — group related projects (e.g. frontend + backend) and attach Docker containers
- **Workspace browser** — inspect, open, edit, duplicate, or delete workspaces from an interactive `wd ws` menu
- **Terminal tab opening** — each workspace project can specify tabs to open with commands (`bun dev`, `claude`, etc.)
- **Docker integration** — start named containers or docker-compose services when opening a workspace
- **Docker port conflict resolution** — if a container fails due to a port conflict, wd detects which container is blocking and offers to stop it
- **Interactive configuration menu** — manage scan roots, custom types, preferences, ignore rules, and template source settings with `wd config`
- **Custom project types and templates** — extend detection rules and add your own local templates
- **Shell integration** — actually changes your working directory (not just prints a path)

## Requirements

- **macOS** (tested on macOS 26) — terminal tab opening relies on AppleScript
- **zsh** — shell integration currently supports zsh only (contributions for bash/fish/nushell are welcome)
- [Bun](https://bun.sh) — for building from source
- [OrbStack](https://orbstack.dev) or Docker Desktop — for Docker features (optional)

## Installation

### Homebrew (recommended)

```sh
brew install kerdofficial/tap/wd
```

Then add the shell integration to your `~/.zshrc`:

```sh
source $(brew --prefix)/share/wd/wd.zsh
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

Add the shell integration to your `~/.zshrc`:

```sh
source ~/.config/wd/wd.zsh
```

### First-time setup

Run first-time setup:

```sh
wd setup
```

`wd setup` creates `~/.config/wd/`, copies the shell wrapper to `~/.config/wd/wd.zsh`, offers an initial scan, and initializes the local templates directory with an example hidden template. Restart your shell or `source ~/.zshrc` afterwards.

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

When opening a workspace, `wd` uses AppleScript (via `osascript`) to open additional terminal tabs. It detects your terminal from `$TERM_PROGRAM` and uses the appropriate API: native AppleScript for iTerm2 and Terminal.app, keystroke simulation for Ghostty and Warp.

`wd new` loads templates from a default remote source, merges them with local templates from `~/.config/wd/templates/`, caches remote templates locally, and then runs the selected template command with your chosen options.

## Project structure

```text
src/
  commands/      — one file per CLI command
  config/        — schema (Zod), file manager, path constants
  core/          — scanner, detector, fuzzy search, frecency, docker, templates, terminal
  ui/            — ANSI colors, spinner, formatters
  utils/         — shell output protocol, fs helpers, prompt wrapper
shell/
  wd.zsh         — shell function wrapper (installed to ~/.config/wd/)
```

## Configuration

All config lives in `~/.config/wd/`. Most day-to-day settings can be managed from `wd config`.

| File                          | Purpose                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `config.json`                 | Scan roots, preferences, custom types, and template source URL |
| `cache.json`                  | Cached project list (auto-refreshed every 24h)                 |
| `history.json`                | Visit history for frecency ranking                             |
| `workspaces/`                 | Workspace definition files                                     |
| `templates/`                  | Local custom templates and template cache                      |
| `templates/template-cache.json` | Cached remote templates used by `wd new`                     |

## License

MIT License

Copyright (c) 2026 Kerekes Dániel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
