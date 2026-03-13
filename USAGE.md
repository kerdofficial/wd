# wd Usage Guide

A practical walkthrough of everything `wd` can do, from first-time setup to project creation, workspace automation, and advanced configuration.

---

## Table of contents

- [First-time setup](#first-time-setup)
- [Navigating to a project](#navigating-to-a-project)
- [Recently visited projects](#recently-visited-projects)
- [Rescanning projects](#rescanning-projects)
- [Creating a project](#creating-a-project)
- [Workspaces](#workspaces)
  - [Interactive workspace management](#interactive-workspace-management)
  - [Creating a workspace](#creating-a-workspace)
  - [Opening a workspace](#opening-a-workspace)
  - [Editing a workspace](#editing-a-workspace)
  - [Duplicating a workspace](#duplicating-a-workspace)
  - [Listing workspaces](#listing-workspaces)
  - [Deleting a workspace](#deleting-a-workspace)
- [Managing configuration](#managing-configuration)
- [Custom project types](#custom-project-types)
- [Config file reference](#config-file-reference)
- [Workspace file reference](#workspace-file-reference)
- [How frecency works](#how-frecency-works)
- [How project detection works](#how-project-detection-works)
- [Troubleshooting](#troubleshooting)

---

## First-time setup

Run `wd setup` to configure the tool. The terminal clears and shows the `wd` header, then walks you through adding or removing directories to scan.

```text
$ wd setup

db   d8b   db d8888b.
88   I8I   88 88  `8D
88   I8I   88 88   88
Y8   I8I   88 88   88
`8b d8'8b d8' 88  .8D
 `8b8' `8d8'  Y8888D
  Workspace Director

What would you like to do?
> Add scan root
  Done
```

If you already have configured scan roots, setup lists them first and also lets you remove entries before saving.

For each scan root, you provide:

- **Path** — the directory to scan (for example `/Volumes/MyDrive/Developer/Work`)
- **Label** — a short name shown in the project list (for example `Work`)
- **Category** — a grouping label stored in config
- **Max depth** — how many directory levels deep to search for projects (default: `3`)

**Choosing max depth:**

- If your projects are directly inside the scan root (for example `Work/my-project/`), use depth `2`.
- If they are one level deeper (for example `Personal/Ongoing/my-project/`), use `3`.

After saving the config, setup:

- tries to copy the shell integration script to `~/.config/wd/wd.zsh`
- offers to run an initial project scan immediately
- creates `~/.config/wd/templates/`
- creates a hidden example template in that directory if one does not exist yet

At the end, add this line to your `~/.zshrc` if it is not already there:

```sh
source ~/.config/wd/wd.zsh
```

Then restart your shell or run `source ~/.zshrc`.

> **Note on shell integration:** Without sourcing `wd.zsh`, the `wd-bin` binary still works but `cd` will not take effect in your current shell. This is a shell limitation: a child process cannot change the parent shell's directory. The `wd` function wraps the binary and applies the `cd` command for you.

---

## Navigating to a project

```sh
wd
```

This opens an interactive fuzzy search over all your projects. Start typing to filter; the list narrows as you type. Use arrow keys to move and Enter to select.

**What you see in the list by default:**

```text
  my-app-web       Next.js    Work / my-app
  my-app-api       NestJS     Work / my-app
  blog-site        Next.js    Personal / Ongoing
> design-system    React      Personal / Ongoing
  landing-page     Next.js    Work
```

Each row can show:

- project name
- detected type badge
- scan root label and parent directory

The type badge and category column can be turned on or off later with `wd config`.

**Fuzzy matching rules:**

- All characters of your query must appear in the project name in order, but do not have to be consecutive.
- `maw` matches `my-app-web` (`m...a...w`).
- Matches at word boundaries score higher than matches in the middle of a word.

**Frecency ranking:**

When you type nothing, projects are sorted by frecency. Projects you have visited recently and frequently appear at the top. On first use, the list is alphabetical.

After selecting a project, `wd` changes your shell's working directory to that project and records the visit in frecency history.

---

## Recently visited projects

```sh
wd recent
```

Shows a ranked list of the projects you have visited most recently and frequently, up to `preferences.maxRecent` projects from `config.json` (`20` by default).

The list includes the time since your last visit:

```text
  my-app-web      Next.js    2h ago
  blog-site       Next.js    5h ago
  design-system   React      2d ago
  my-app-api      NestJS     3d ago
```

You can type to filter the list. Selecting a project works the same as `wd`.

---

## Rescanning projects

```sh
wd scan
```

Scans all configured directories and rebuilds the project cache. Use this when:

- you have created new projects since the last scan
- you have deleted or moved projects
- the cache seems out of date

The cache is also refreshed automatically when you run `wd` or `wd recent` if the cache is older than 24 hours.

After scanning, `wd scan` prints a summary with:

- number of scan roots
- total project count
- counts grouped by scan root label
- counts grouped by detected project type

It also refreshes the template cache in the background using the currently configured template source URL.

---

## Creating a project

`wd new` is the Project Constructor. It creates a new project from a template, either fully interactively or by pre-filling some or all choices with CLI flags.

```sh
wd new
```

You can also pass the project name as the first positional argument:

```sh
wd new my-app
```

### Template sources

`wd new` merges templates from two places:

- the built-in remote template source
- local custom template files in `~/.config/wd/templates/*.json`

The remote source can be overridden with `projectConstructor.templates.gistUrl` in `config.json`, or via the `Templates URL` entry in `wd config`.

Important behaviors:

- `hidden: true` templates are loaded but not shown in the normal selection list
- if a local template uses the same `id` as a remote template, `wd new` exits with a template ID collision error
- remote templates are cached in `~/.config/wd/templates/template-cache.json`
- if the remote source is unavailable but a matching cache exists, `wd new` warns and falls back to the cached template set
- `--raw` forces a remote refresh instead of reusing the current cache

### Wizard flow

The normal interactive flow is:

1. Project name
2. Template
3. Variant
4. Package manager
5. Additional template-specific parameters
6. Target directory
7. Summary and action choice: `Create`, `Edit`, or `Cancel`

If you choose `Edit` from the summary screen, the wizard loops back with the previous selections pre-filled.

### Validation and behavior

- Project names must use only lowercase letters, numbers, hyphens, and underscores.
- If a selected template has only one variant or one package manager, `wd new` auto-selects it.
- If the final project path already exists, `wd new` asks whether to continue.
- If the target directory itself does not exist, `wd new` asks whether to create it.
- If you type a directory outside your configured scan roots in the directory picker, `wd new` offers to add it as a new scan root.
- After a successful create, `wd new` changes into the new project directory and records the visit in frecency history.
- If a post-create command fails, `wd new` shows the error and asks whether to continue anyway.
- Unknown flags are warned about and ignored.
- Dynamic flags that do not belong to the selected variant are warned about and ignored.

### Directory picker

Unless you pass `--dir`, `wd new` opens a directory picker for the target directory.

Useful behaviors:

- type to filter visible directories
- press `Tab` to autocomplete the highlighted directory
- type `@` to switch to scan-root matching mode
- in `@` mode, use Left/Right to cycle through matching roots and `Tab` to insert the selected root path
- pressing Enter on a typed path accepts it even if it is new

### Flags

| Flag | Meaning |
| ---- | ------- |
| `my-app` | Positional app name |
| `--template <id>`, `-t <id>` | Pre-select a template by ID or name |
| `--variant <type>`, `-v <type>` | Pre-select a template variant |
| `--pm <name>`, `--package-manager <name>` | Pre-select the package manager |
| `--dir <path>` | Skip the directory picker and use a target directory directly |
| `--dry-run` | Show the interpolated create command and post-create commands without creating anything |
| `--verbose` | Stream command output live instead of using the spinner UI |
| `--raw` | Force-refresh remote templates instead of using the current template cache |

### Dynamic template flags

Templates can expose additional CLI flags through `wizardParameter` definitions.

That gives you:

- a long dynamic flag such as `--base-color zinc`
- an optional shorthand such as `-bc zinc`

These flags are template-defined, not global. Available dynamic flags depend on the selected variant.

### Examples

Fully interactive:

```sh
wd new
```

Partially pre-filled:

```sh
wd new my-app -t nextjs -v shadcn
```

Fully pre-filled:

```sh
wd new my-app -t nextjs -v shadcn --pm bun --dir ~/Developer/Work --base-color zinc
```

Dry run:

```sh
wd new my-app -t nextjs -v shadcn --pm bun --dry-run
```

Verbose command execution:

```sh
wd new my-app -t nextjs --verbose
```

### Example dry-run output

```text
Dry run summary:
  Project:  my-app
  Template: Next.js
  Variant:  shadcn
  Package:  bun

  Command: bunx --bun create-next-app my-app --yes

Dry run complete — no project was created.
```

---

## Workspaces

A workspace is a named group of related projects. The main use case is when you regularly work on two or more projects together, like a frontend and a backend, and you want to jump to the right place, start services, and open your usual tabs with one command.

A workspace stores:

- which projects are part of it
- which project is the primary project
- which terminal tabs to open for each project
- which Docker containers to start, if any
- which compose file to bring up, if any

### Interactive workspace management

```sh
wd ws
```

Running `wd ws` without a subcommand opens an interactive workspace browser.

The first screen shows all saved workspaces with:

- workspace name
- optional description
- included projects
- primary project marker
- attached containers and compose file, if configured

From the list:

- press Enter to open the detail view for the selected workspace
- press `o` on a selected workspace to open it immediately
- choose `Back` or press Escape to exit

The detail view offers these actions:

- `Open`
- `Edit`
- `Duplicate`
- `Delete`
- `Back`

This is the fastest way to inspect or manage workspaces when you do not want to remember exact names.

### Creating a workspace

```sh
wd ws new
```

You will be guided through:

**1. Name and description**

```text
Workspace name: my-app
Description (optional): Frontend + API
```

Workspace names must use only lowercase letters, numbers, hyphens, and underscores. Spaces are not allowed.

If a workspace with the same name already exists, creation is blocked.

**2. Selecting projects**

A checkbox list appears. Use `Space` to select projects and `Enter` to confirm.

```text
Select projects (Space to select, Enter to confirm):
  [ ] my-app-web    Next.js    Work / my-app
  [ ] my-app-api    NestJS     Work / my-app
  [ ] blog-site     Next.js    Personal / Ongoing
```

At least one project must be selected.

**3. Choosing the primary project**

If you selected more than one project, you choose which one `wd open` will `cd` into.

```text
Which is the primary project (where wd will cd)?
> my-app-web
  my-app-api
```

**4. Tab configuration**

For each project, you choose how many terminal tabs to open and what command to run in each tab.

```text
  my-app-web (primary)  /Volumes/MyDrive/Developer/Work/my-app-web

  How many tabs to open? (1 = just cd, 0 = skip): 3
    Tab 1 command: (this is your current shell)
    Tab 2 command: claude
    Tab 3 command: bun dev
```

Rules:

- `0` means do not open a tab for that project
- `1` means one shell in that directory
- leaving a tab command blank opens the tab and only changes directory
- the first tab of the primary project is your current shell, not a newly opened tab

**5. Docker configuration**

If Docker is available, `wd` can attach:

- named containers to start with `docker start`
- a compose file to start with `docker compose up -d`

For compose setup, `wd ws new` first suggests compose files it detected inside the selected projects. If you do not choose one, it lets you enter the path and filename manually.

**6. Saving**

The workspace is saved as `~/.config/wd/workspaces/<name>.json`.

### Opening a workspace

```sh
wd open my-app
```

This does the following:

1. starts any attached Docker containers
2. runs `docker compose up -d` if a compose file is attached
3. changes your directory to the primary project
4. runs the first tab command for the primary project in the current shell, if set
5. opens any additional configured tabs

Example output:

```text
my-app — Frontend + API
  Starting containers: my-app-postgres-1, my-app-redis-1... done
  cd → my-app-web
  Opening tabs...
```

**Docker port conflict resolution:**

If a container fails to start because a port is already in use, `wd` detects the blocking container and offers to stop it and retry.

If Docker is not running, `wd` warns and still performs the `cd`.

If a project path no longer exists, `wd open` exits with a clear error.

**Terminal tab support:**

| Terminal | Method |
| -------- | ------ |
| iTerm2 | Native AppleScript API |
| Terminal.app | AppleScript `do script` |
| Ghostty | Keystroke simulation (`Cmd+T`) |
| Warp | Keystroke simulation (`Cmd+T`) |

macOS asks for Automation permission the first time `wd` opens tabs with AppleScript.

### Editing a workspace

```sh
wd ws edit <name>
```

This opens the same wizard as `wd ws new`, but pre-fills it with the existing workspace values.

Important differences from creation:

- the name is editable
- if you rename the workspace, the old file is deleted and the new name is saved instead
- selected projects are pre-checked
- the current primary project is pre-selected if it is still present
- tab counts and commands are pre-filled
- attached containers are pre-checked
- the current compose config is offered first in the compose suggestions list
- if you remove a project, its old tab configuration is discarded

The same lowercase-only name validation applies here too, and the new name must not collide with an existing workspace.

### Duplicating a workspace

```sh
wd ws duplicate <name>
```

Duplicates an existing workspace under a new name.

Default name generation works like this:

- `my-app` → `my-app-duplicate`
- if that already exists: `my-app-duplicate-2`
- then `my-app-duplicate-3`, and so on

The duplicate flow asks for the new name and then offers:

- `Save & Exit`
- `Edit Workspace`
- `Cancel`

If you choose `Edit Workspace`, the duplicated workspace is saved first and then opened in the normal edit wizard.

### Listing workspaces

```sh
wd ws list
```

Shows all saved workspaces with their projects and Docker configuration.

Example output:

```text
Workspaces

  my-app
    Frontend + API
    → my-app-web (primary)
    → my-app-api
    🐳 Containers: my-app-postgres-1, my-app-redis-1

  blog
    → blog-site (primary)
    → blog-api
    🐳 Compose: docker-compose.local.yaml in blog-api
```

### Deleting a workspace

```sh
wd ws delete my-app
```

Removes the workspace definition file. Your projects and Docker containers are unaffected.

You can also delete a workspace from the interactive `wd ws` detail view.

---

## Managing configuration

```sh
wd config
```

`wd config` opens an interactive configuration menu. It is the main way to manage `wd` after the first setup.

Main menu entries:

- `Scan roots`
- `Custom project types`
- `Show project type badge`
- `Show category`
- `Max recent projects`
- `Scan ignore list`
- `Templates URL`

### Scan roots

This section lets you add or remove scan roots without re-running `wd setup`.

Adding a scan root asks for:

- directory path
- label
- category
- max scan depth

Validation rules:

- path must exist
- path must be a directory
- the same path cannot be added twice

### Custom project types

This section lets you add, edit, or remove custom project detection rules.

Each custom type has:

- `name`
- `markers`
- `patterns`
- `color`

Rules:

- at least one marker or pattern is required
- regex patterns are validated before saving
- a preview is shown before final confirmation

### Show project type badge

Toggles whether selectors show the `[TypeName]` badge next to projects.

### Show category

Toggles whether selectors show the scan-root label / location column next to projects.

### Max recent projects

Sets how many recent projects `wd recent` keeps and displays.

Valid range: `1` to `50`.

### Scan ignore list

Controls which directory names are skipped during scanning.

Available actions:

- add an entry
- remove an entry
- press `e` to open the whole list in your editor

When using the editor flow:

- one entry per line
- empty lines are ignored
- changes are shown as additions and removals before saving
- an empty final list is rejected

### Templates URL

Controls the remote source for built-in project templates used by `wd new`.

Supported URL formats:

- `https://...`
- `file:///absolute/path/to/templates.json`

Available actions:

- set a custom URL
- test the current URL
- reset back to the built-in default

Before saving a new URL, `wd config` tests it and reports:

- whether the source was reachable
- how many valid templates were found
- validation errors for invalid templates when relevant

`file://` rules:

- the path must be absolute
- the path must not contain `..`
- the file must exist

If the test fails, you can still choose whether to save the URL anyway.

---

## Custom project types

By default, `wd` recognizes these built-in project types: Next.js, NestJS, Angular, Flutter, Swift, Rust, Tauri, React, Vue, Bun, Node, Python.

If you work with a framework that is not in this list, define your own detection rules in `wd config` or by editing `~/.config/wd/config.json`.

Example:

```json
{
  "version": 1,
  "configVersion": 1,
  "scanRoots": [],
  "customTypes": [
    {
      "name": "Django",
      "markers": ["manage.py"],
      "patterns": [],
      "color": "yellow"
    },
    {
      "name": "Laravel",
      "markers": ["artisan"],
      "patterns": ["^composer\\.json$"],
      "color": "red"
    }
  ],
  "preferences": {
    "showProjectType": true,
    "showCategory": true,
    "maxRecent": 20,
    "scanIgnore": [
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      ".angular",
      "target",
      ".dart_tool",
      "Pods",
      ".build",
      "DerivedData",
      ".cache"
    ]
  },
  "projectConstructor": {
    "templates": {
      "gistUrl": ""
    }
  }
}
```

**Fields:**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `name` | string | Display name shown in the project list |
| `markers` | string[] | Exact filenames that must exist in the project root |
| `patterns` | string[] | Regular expressions matched against filenames in the project root |
| `color` | string | Badge color: `cyan`, `green`, `yellow`, `blue`, `magenta`, `red`, `gray`, `white` |

**Matching logic:**

- if `markers` is non-empty, all listed files must exist
- if `patterns` is non-empty, at least one pattern must match
- if both are present, both conditions must pass
- custom types are checked after built-in types, so built-ins win if both match

After changing custom types, run `wd scan` to rebuild the cache.

---

## Config file reference

The main config file is `~/.config/wd/config.json`. It is created by `wd setup` and managed by `wd config`, but you can also edit it directly.

Example:

```json
{
  "version": 1,
  "configVersion": 1,
  "scanRoots": [
    {
      "path": "/Volumes/MyDrive/Developer/Work",
      "label": "Work",
      "category": "work",
      "maxDepth": 2
    },
    {
      "path": "/Volumes/MyDrive/Developer/Personal",
      "label": "Personal",
      "category": "personal",
      "maxDepth": 3
    }
  ],
  "customTypes": [],
  "preferences": {
    "showProjectType": true,
    "showCategory": true,
    "maxRecent": 20,
    "scanIgnore": [
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      ".angular",
      "target",
      ".dart_tool",
      "Pods",
      ".build",
      "DerivedData",
      ".cache"
    ]
  },
  "projectConstructor": {
    "templates": {
      "gistUrl": ""
    }
  }
}
```

### Top-level fields

| Field | Default | Description |
| ----- | ------- | ----------- |
| `version` | `1` | Config schema version |
| `configVersion` | `0` or higher | Silent migration version applied to the config |
| `scanRoots` | `[]` | Directories to scan for projects |
| `customTypes` | `[]` | Custom project detection rules |
| `preferences` | object | UI and scanning preferences |
| `projectConstructor` | object | Template source settings for `wd new` |

### `scanRoots[]`

| Field | Default | Description |
| ----- | ------- | ----------- |
| `path` | required | Absolute path to scan |
| `label` | directory name | Label shown in selectors and scan summaries |
| `category` | label lowercased | Stored grouping value |
| `maxDepth` | `3` | How many levels deep to scan |

### `preferences`

| Field | Default | Description |
| ----- | ------- | ----------- |
| `showProjectType` | `true` | Show the project type badge in selectors |
| `showCategory` | `true` | Show the location/category column in selectors |
| `maxRecent` | `20` | Maximum number of projects shown by `wd recent` |
| `scanIgnore` | see default list above | Directory names to skip during scanning |

**About `scanIgnore`:**

Entries are matched against directory entry names, not full paths. For example, `"build"` skips any directory named `build` anywhere inside a scan root.

### `projectConstructor.templates`

| Field | Default | Description |
| ----- | ------- | ----------- |
| `gistUrl` | `""` | Optional override for the remote template source used by `wd new` |

### Related files under `~/.config/wd/`

| Path | Purpose |
| ---- | ------- |
| `templates/*.json` | Local custom templates loaded by `wd new` |
| `templates/template-cache.json` | Cached remote templates used for offline fallback and normal loads |

---

## Workspace file reference

Workspace files live in `~/.config/wd/workspaces/<name>.json`. They are created by `wd ws new`, `wd ws duplicate`, or `wd ws edit`, but can also be edited manually.

Example:

```json
{
  "version": 2,
  "name": "my-app",
  "description": "Frontend + API",
  "projects": [
    {
      "path": "/Volumes/MyDrive/Developer/Work/my-app-web",
      "isPrimary": true,
      "tabs": [{ "command": "bun dev" }, { "command": "claude" }]
    },
    {
      "path": "/Volumes/MyDrive/Developer/Work/my-app-api",
      "isPrimary": false,
      "tabs": [{ "command": "npm run start:dev" }]
    }
  ],
  "docker": {
    "containers": ["my-app-postgres-1", "my-app-redis-1"],
    "compose": {
      "path": "/Volumes/MyDrive/Developer/Work/my-app-api",
      "file": "docker-compose.yml"
    }
  }
}
```

### Fields

| Field | Description |
| ----- | ----------- |
| `version` | Workspace schema version (`2` for newly saved workspaces) |
| `name` | Workspace name |
| `description` | Optional human-readable description |
| `projects[]` | Included projects and their tab setup |
| `docker.containers[]` | Named containers to start |
| `docker.compose` | Optional compose file configuration |

### `projects[].tabs`

Each tab opens in that project's directory.

- if `command` is missing or empty, the tab only changes directory
- the first tab of the primary project is special: its command runs in your current shell after the `cd`
- other tabs are opened as new terminal tabs

---

## How frecency works

Frecency combines frequency and recency. Each visit stores a timestamp. When ranking projects, recent visits are worth more than older ones.

| Age of visit | Points |
| ------------ | ------ |
| Last 4 hours | 100 |
| Last 24 hours | 80 |
| Last 3 days | 60 |
| Last week | 40 |
| Last 2 weeks | 20 |
| Last month | 10 |
| Older | 2 |

A project's total score is the sum of its visit scores.

Additional rules:

- visit records older than 90 days are pruned
- each project stores at most 50 visit timestamps
- `wd`, `wd recent`, and successful `wd new` navigation all feed the same history file

The history file is `~/.config/wd/history.json`. Delete it to reset frecency completely.

---

## How project detection works

When `wd` scans a directory, it looks at the files directly inside it and tries to match them against detection rules. The first rule that matches wins.

**Built-in detection rules (priority order):**

| Type | Detected by |
| ---- | ----------- |
| Tauri | `src-tauri/` directory exists |
| Flutter | `pubspec.yaml` exists |
| Swift | `*.xcodeproj`, `*.xcworkspace`, or `Package.swift` |
| Rust | `Cargo.toml` |
| Angular | `angular.json` |
| NestJS | `nest-cli.json` |
| Next.js | `next.config.ts`, `next.config.js`, or `next.config.mjs` |
| Bun | `bunfig.toml` |
| Node | `package.json` |
| Python | `pyproject.toml`, `setup.py`, or `requirements.txt` |
| unknown | none of the above |

A directory is recognized as a project at all if it contains any built-in marker, a `.git` directory, or markers from your custom types. Otherwise, `wd` treats it as a container directory and keeps recursing until `maxDepth` is reached.

This is why `maxDepth` matters. A project at `Personal/Ongoing/my-project/` needs a scan depth of at least `3` when scanning from `Personal/`.

Custom types are checked after built-in types, so they cannot override a built-in match.

---

## Troubleshooting

**`wd: command not found`**

The shell integration is not active. Make sure your `~/.zshrc` contains:

```sh
source ~/.config/wd/wd.zsh
```

Then reload your shell.

**`wd-bin: command not found`**

The binary is not on your `PATH`. Check that your symlink exists:

```sh
ls -la ~/.local/bin/wd-bin
```

**`wd is not configured yet`**

Run `wd setup` first. `wd config` and other config-backed commands expect `~/.config/wd/config.json` to exist.

**Projects are missing from the list**

Run `wd scan` and then check:

- is the directory inside a configured scan root?
- does the project contain a recognized marker file?
- is one of its parent directories filtered by `scanIgnore`?
- is `maxDepth` high enough?

**`wd new` says no templates were found**

Check:

- whether your configured template URL is reachable
- whether your local templates in `~/.config/wd/templates/` are valid JSON
- whether all available templates are marked `hidden: true`

You can reset the remote source from `wd config` under `Templates URL`.

**`wd new` says the template cache is stale**

This means the remote template source could not be refreshed and `wd` fell back to the last cached copy. That is safe for normal use, but you may be missing newer templates until the source becomes reachable again.

Use `wd new --raw` after connectivity is restored to force a refresh.

**Template URL testing fails for `file://` paths**

For local template sources:

- the path must be absolute
- the path must not contain `..`
- the file must exist
- the JSON must be either an array of templates or an object with a `templates` array

**Workspace name already exists**

Workspace names must be unique. Use `wd ws list` to see existing names, then choose another name or duplicate and rename from there.

**Unknown command or unknown workspace command**

Recent versions of `wd` print a helpful command list instead of silently falling back to the main selector. If you see this, double-check the command spelling and available subcommands.

**Docker containers are not starting**

- make sure OrbStack or Docker Desktop is running
- make sure the container names in the workspace still match `docker ps -a`
- if a container fails because of a port conflict, `wd` can offer to stop the blocking container and retry

**Tabs are not opening**

- `wd` uses AppleScript and macOS Automation permissions for tab opening
- Ghostty and Warp rely on keystroke simulation, which is less reliable if the terminal loses focus
- tabs only open for workspace projects that actually have tab entries configured

**`wd open` changed directory but my editor stayed in the old place**

`wd open` only changes the terminal shell directory. Open your editor manually in the new project if needed.

**The project list is slow to appear**

The cache may be rebuilding because:

- the cache is older than 24 hours
- the cache file does not exist

If this keeps happening, reduce scan size by lowering `maxDepth` or adding more names to `scanIgnore`.
