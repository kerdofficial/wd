# wd — Workspace Director

A fast macOS CLI tool for navigating between projects and launching development workspaces. Built with TypeScript and Bun.

## The problem

When you have dozens (or hundreds) of projects spread across multiple directories, getting to the right one is friction. You `cd` into the wrong folder, you forget the exact directory name, you open four terminal tabs manually every time you start working on a project.

`wd` solves the navigation part, and gives you a workspace system so a single command can drop you into the right directory, start your Docker services, and open all the terminal tabs you need — each with the right command already running.

## Features

- **Fuzzy project search** — type a few letters, pick a project, done
- **Frecency ranking** — projects you use most recently and frequently appear first
- **Configurable scan roots** — point it at any directories, it finds all your projects automatically
- **Project type detection** — recognizes Next.js, NestJS, Angular, Flutter, Swift, Rust, Tauri, and more
- **Workspace profiles** — group related projects (e.g. frontend + backend) and attach Docker containers
- **Terminal tab opening** — each workspace project can specify tabs to open with commands (`bun dev`, `claude`, etc.)
- **Docker integration** — start named containers or docker-compose services when opening a workspace
- **Docker port conflict resolution** — if a container fails due to a port conflict, wd detects which container is blocking and offers to stop it
- **Custom project types** — define your own detection rules for frameworks not built-in
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

Restart your shell or `source ~/.zshrc`.

## Quick start

```sh
# Configure which directories to scan
wd setup

# Navigate to a project
wd

# See recently visited projects
wd recent

# Create a workspace (group of related projects + terminal tabs + Docker)
wd ws new

# Edit an existing workspace
wd ws edit my-workspace

# Open a workspace (cd + start Docker + open tabs)
wd open my-workspace

# Rescan after adding new projects
wd scan
```

## How it works

`wd` scans the directories you configure and builds a cache of all your projects. When you run `wd`, it shows an interactive fuzzy search over that list. Projects you visit frequently and recently appear at the top.

Because a child process cannot change your shell's working directory, `wd` uses a shell function wrapper. The binary writes a `cd` command to a temp file, and the `wd` shell function evals it. This is the same pattern used by tools like `zoxide` and `nvm`.

When opening a workspace, `wd` uses AppleScript (via `osascript`) to open additional terminal tabs. It detects your terminal from `$TERM_PROGRAM` and uses the appropriate API: native AppleScript for iTerm2 and Terminal.app, keystroke simulation for Ghostty and Warp.

## Project structure

```
src/
  commands/      — one file per CLI command
  config/        — schema (Zod), file manager, path constants
  core/          — scanner, detector, fuzzy search, frecency, docker, terminal
  ui/            — ANSI colors, spinner, formatters
  utils/         — shell output protocol, fs helpers, prompt wrapper
shell/
  wd.zsh         — shell function wrapper (installed to ~/.config/wd/)
```

## Configuration

All config lives in `~/.config/wd/`:

| File           | Purpose                                        |
| -------------- | ---------------------------------------------- |
| `config.json`  | Scan roots, preferences, custom types          |
| `cache.json`   | Cached project list (auto-refreshed every 24h) |
| `history.json` | Visit history for frecency ranking             |
| `workspaces/`  | Workspace definition files                     |

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
