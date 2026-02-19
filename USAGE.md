# wd Usage Guide

A practical walkthrough of everything `wd` can do, from first-time setup to advanced configuration.

---

## Table of contents

- [First-time setup](#first-time-setup)
- [Navigating to a project](#navigating-to-a-project)
- [Recently visited projects](#recently-visited-projects)
- [Rescanning projects](#rescanning-projects)
- [Workspaces](#workspaces)
  - [Creating a workspace](#creating-a-workspace)
  - [Opening a workspace](#opening-a-workspace)
  - [Editing a workspace](#editing-a-workspace)
  - [Listing workspaces](#listing-workspaces)
  - [Deleting a workspace](#deleting-a-workspace)
- [Custom project types](#custom-project-types)
- [Config file reference](#config-file-reference)
- [Workspace file reference](#workspace-file-reference)
- [How frecency works](#how-frecency-works)
- [How project detection works](#how-project-detection-works)
- [Troubleshooting](#troubleshooting)

---

## First-time setup

Run `wd setup` to configure the tool. The terminal clears and shows the `wd` header, then walks you through adding directories to scan.

```
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

For each scan root, you provide:

- **Path** — the directory to scan (e.g. `/Volumes/MyDrive/Developer/Work`)
- **Label** — a short name shown in the project list (e.g. `Work`)
- **Category** — used for grouping in output (e.g. `work`)
- **Max depth** — how many directory levels deep to search for projects (default: 3)

**Choosing max depth:**

If your projects are directly inside the scan root (e.g. `Work/my-project/`), use depth `2`. If they are one level deeper (e.g. `Personal/Ongoing/my-project/`), use `3`.

Once you finish adding roots, `wd` will scan immediately and show you how many projects were found.

At the end of setup, you will see instructions for shell integration. If you have not already added it, add this line to your `~/.zshrc`:

```sh
source ~/.config/wd/wd.zsh
```

Then restart your shell or run `source ~/.zshrc`. After that, the `wd` command will work with proper directory changing.

> **Note on shell integration:** Without sourcing `wd.zsh`, the `wd-bin` binary still works but `cd` will not take effect in your current shell. This is a fundamental shell limitation — no child process can change the parent shell's directory. The `wd` function wraps the binary and handles this.

---

## Navigating to a project

```sh
wd
```

This opens an interactive fuzzy search over all your projects. Start typing to filter; the list narrows as you type. Use arrow keys to move, Enter to select.

**What you see in the list:**

```
  my-app-web       Next.js    Work / my-app
  my-app-api       NestJS     Work / my-app
  blog-site        Next.js    Personal / Ongoing
> design-system    React      Personal / Ongoing
  landing-page     Next.js    Work
```

Each row shows: project name, detected type, and which scan root and parent directory it lives in.

**Fuzzy matching rules:**

- All characters of your query must appear in the project name in order, but do not have to be consecutive
- `maw` matches `my-app-web` (m...a...w)
- Matches at word boundaries (after `-` or `/`) score higher than matches in the middle of a word

**Frecency ranking:**

When you type nothing, projects are sorted by frecency (see [How frecency works](#how-frecency-works)). Projects you have visited recently and frequently appear at the top. On first use, the list is alphabetical.

After selecting a project, `wd` changes your shell's working directory to that project. Your prompt will update to reflect the new location.

---

## Recently visited projects

```sh
wd recent
```

Shows a ranked list of the projects you have visited most recently and frequently — up to 20 by default (configurable in `config.json`).

The list includes the time since your last visit:

```
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

- You have created new projects since the last scan
- You have deleted or moved projects
- The cache seems out of date

The cache is also refreshed automatically when you run `wd` or `wd recent` if the cache is older than 24 hours.

After scanning, `wd scan` prints a summary:

```
Scanned 2 roots in 0.14s
  Found 109 projects

  Work          22 projects
  Personal      87 projects

  Types:
    [Next.js]    18
    [NestJS]      3
    [Angular]     2
    [Flutter]     2
    [Tauri]       6
    ...
```

---

## Workspaces

A workspace is a named group of related projects. The main use case is when you regularly work on two projects together — like a frontend and a backend — and you want to jump to the right place, start your services, and have all your terminal tabs ready with a single command.

A workspace stores:

- Which projects are part of it
- Which project is the "primary" (where `wd open` will `cd` to)
- Which terminal tabs to open for each project, and what command to run in each
- Which Docker containers to start (optional)
- A docker-compose file to bring up (optional)

### Creating a workspace

```sh
wd ws new
```

You will be guided through:

**1. Name and description**

```
Workspace name: my-app
Description (optional): Frontend + API
```

Names must be alphanumeric, hyphens and underscores are allowed. No spaces.

**2. Selecting projects**

A checkbox list appears. Use **Space** to select projects, **Enter** to confirm. Multiple projects can be selected at once.

```
Select projects (Space to select, Enter to confirm):
  [ ] my-app-web    Next.js    Work / my-app
  [ ] my-app-api    NestJS     Work / my-app
  [ ] blog-site     Next.js    Personal / Ongoing
```

**3. Choosing the primary project**

If you selected more than one project, you choose which one `wd open` will `cd` into. Usually this is the frontend.

```
Which is the primary project (where wd will cd)?
> my-app-web
  my-app-api
```

**4. Tab configuration**

For each project, you choose how many terminal tabs to open and what command to run in each. The first tab of the primary project is your current shell — any command you set there runs after the `cd`.

```
  my-app-web (primary)  /Volumes/MyDrive/Developer/Work/my-app-web

  How many tabs to open? (1 = just cd, 0 = skip): 3
    Tab 1 command: (this is your current shell)
    Tab 2 command: claude
    Tab 3 command: bun dev

  my-app-api  /Volumes/MyDrive/Developer/Work/my-app-api

  How many tabs to open? (1 = just cd, 0 = skip): 1
    Tab 1 command: npm run start:dev
```

Leave a command blank to open a tab that just `cd`s into the project without running anything.

**5. Docker configuration (optional)**

If Docker is running, `wd` lists all your existing containers and lets you pick which ones to start when the workspace opens.

```
Configure Docker containers for this workspace? (y/N): y

Select containers to start when opening this workspace:
  [ ] my-app-postgres-1    postgres:15    [exited]
  [ ] my-app-redis-1       redis:7        [exited]
  [ ] other-app-db-1       postgres:14    [running]
```

Use Space to select, Enter to confirm.

You can also attach a docker-compose file instead of (or in addition to) named containers. `wd` will suggest compose files it detected in your selected projects.

**6. Saving**

The workspace is saved to `~/.config/wd/workspaces/my-app.json`.

### Opening a workspace

```sh
wd open my-app
```

This does the following:

1. Starts any Docker containers attached to the workspace (`docker start <name>`)
2. Runs `docker compose up -d` if a compose file is attached
3. Changes your directory to the primary project
4. Runs the first tab's command in the current shell (if set)
5. Opens additional terminal tabs as configured, with their commands

Example output:

```
my-app — Frontend + API
  🐳 Starting containers: my-app-postgres-1, my-app-redis-1... ✓
  ✓ cd → my-app-web
  ⇥ Opening tabs...
```

**Docker port conflict resolution:**

If a container fails to start because a port is already in use, `wd` detects which container is causing the conflict and offers to resolve it:

```
  ! my-app-postgres-1 failed: port 5432 already in use by other-app-db-1

  What to do?
> Stop other-app-db-1 and retry my-app-postgres-1
  Skip
```

If Docker is not running (OrbStack or Docker Desktop not started), `wd` warns you and still performs the `cd`.

If a project path no longer exists (for example, if the drive is not mounted), `wd open` exits with a clear error message.

**Terminal tab support:**

`wd` detects your terminal from the `$TERM_PROGRAM` environment variable and uses the appropriate method to open tabs:

| Terminal     | Method                       |
| ------------ | ---------------------------- |
| iTerm2       | Native AppleScript API       |
| Terminal.app | AppleScript `do script`      |
| Ghostty      | Keystroke simulation (Cmd+T) |
| Warp         | Keystroke simulation (Cmd+T) |

macOS will ask for Automation permission the first time `wd` tries to open tabs via AppleScript. Allow it in System Settings → Privacy & Security → Automation.

### Editing a workspace

```sh
wd ws edit <name>
```

Opens the same wizard as `wd ws new`, but with all fields pre-filled from the existing workspace. Tab-complete the workspace name after `ws edit`.

Every step works the same as creation, with these differences:

- **Name** — editable; if you change it, the old workspace file is deleted and a new one is saved under the new name
- **Projects** — currently selected projects are pre-checked in the checkbox list; you can add or remove freely
- **Primary project** — the current primary is pre-selected; if you removed it from the project list, the first selected project is used as the default
- **Tab configuration** — existing tab counts and commands are pre-filled as defaults; just press Enter to keep them
- **Docker containers** — currently attached containers are pre-checked; the Docker section defaults to open if the workspace already has Docker config
- **Compose file** — current compose config is offered as the first option in the list

If you removed a project from the workspace, its tab configuration is discarded. If you added a new project, its tab configuration starts fresh.

### Listing workspaces

```sh
wd ws list
```

Shows all saved workspaces with their projects and Docker configuration:

```
Workspaces

  my-app
    Frontend + API
    -> my-app-web  (primary)  3 tabs
    -> my-app-api             1 tab
    Containers: my-app-postgres-1, my-app-redis-1

  blog
    -> blog-site  (primary)
    -> blog-api
    Compose: docker-compose.local.yaml in blog-api
```

### Deleting a workspace

```sh
wd ws delete my-app
```

Removes the workspace definition file. Your projects and Docker containers are unaffected.

---

## Custom project types

By default, `wd` recognizes these project types: Next.js, NestJS, Angular, Flutter, Swift, Rust, Tauri, Bun, Node, Python.

If you work with a framework that is not in this list, you can define your own detection rules in `~/.config/wd/config.json`.

Add a `customTypes` array:

```json
{
  "version": 1,
  "scanRoots": [...],
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
    },
    {
      "name": "Elixir",
      "markers": [],
      "patterns": ["^mix\\.exs$"],
      "color": "magenta"
    }
  ]
}
```

**Fields:**

| Field      | Type     | Description                                                                                    |
| ---------- | -------- | ---------------------------------------------------------------------------------------------- |
| `name`     | string   | Display name shown in the project list                                                         |
| `markers`  | string[] | Exact filenames that must exist in the project root                                            |
| `patterns` | string[] | Regular expressions matched against filenames in the project root                              |
| `color`    | string   | Color for the type badge: `cyan`, `green`, `yellow`, `blue`, `magenta`, `red`, `gray`, `white` |

**Matching logic:**

- If `markers` is non-empty, all listed files must exist
- If `patterns` is non-empty, at least one must match a filename in the directory
- Both can be combined: markers must all match AND at least one pattern must match
- Custom types are checked after all built-in types, so they have lower priority

After editing `config.json`, run `wd scan` to rebuild the cache with the new rules.

---

## Config file reference

The main config file is `~/.config/wd/config.json`. It is created and managed by `wd setup`, but you can also edit it directly.

```json
{
  "version": 1,
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
  }
}
```

**`scanRoots`** — directories to scan for projects

| Field      | Default          | Description                               |
| ---------- | ---------------- | ----------------------------------------- |
| `path`     | required         | Absolute path to scan                     |
| `label`    | directory name   | Shown in the project list                 |
| `category` | label lowercased | Used for grouping                         |
| `maxDepth` | 3                | How many levels deep to look for projects |

**`preferences`**

| Field             | Default   | Description                                     |
| ----------------- | --------- | ----------------------------------------------- |
| `showProjectType` | true      | Show the `[Next.js]` badge in the project list  |
| `showCategory`    | true      | Show the scan root label in the project list    |
| `maxRecent`       | 20        | Maximum number of projects shown in `wd recent` |
| `scanIgnore`      | see above | Directory names to skip during scanning         |

**Adding directories to `scanIgnore`:**

If scanning is slow, or if `wd` is picking up directories that are not projects, add their names to `scanIgnore`. Names are matched against directory entries, not full paths — so `"build"` will skip any directory named `build` anywhere in the scan.

---

## Workspace file reference

Workspace files live in `~/.config/wd/workspaces/<name>.json`. They are created by `wd ws new` but can be edited manually.

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
    "containers": ["my-app-postgres-1", "my-app-redis-1"]
  }
}
```

**`projects[].tabs`** — array of tabs to open for this project

Each tab opens in the project's directory. `command` is optional — if omitted or null, the tab just `cd`s into the directory without running anything.

The first tab of the primary project is special: instead of opening a new terminal tab, its command runs directly in your current shell after the `cd`. This is how the primary shell gets its startup command (e.g. `bun dev`).

**`docker.containers`** — named containers to `docker start` when opening the workspace.

**`docker.compose`** — optional docker-compose configuration:

```json
"compose": {
  "path": "/Volumes/MyDrive/Developer/Work/my-app-api",
  "file": "docker-compose.yml"
}
```

---

## How frecency works

Frecency combines frequency (how often you visit a project) and recency (how recently you visited it). Each visit is stored with a timestamp. When ranking, each visit earns points based on how recent it is:

| Age of visit  | Points |
| ------------- | ------ |
| Last 4 hours  | 100    |
| Last 24 hours | 80     |
| Last 3 days   | 60     |
| Last week     | 40     |
| Last 2 weeks  | 20     |
| Last month    | 10     |
| Older         | 2      |

A project's total score is the sum of all its visits' points. The project you opened this morning and last week will score higher than a project you opened only once last month.

Visit records older than 90 days are automatically pruned. Each project stores at most 50 visit timestamps.

The history file is `~/.config/wd/history.json`. You can delete it to reset frecency entirely.

---

## How project detection works

When `wd` scans a directory, it looks at the files directly inside it (not recursively) and tries to match them against detection rules. The first rule that matches wins.

**Built-in detection rules (in priority order):**

| Type    | Detected by                                              |
| ------- | -------------------------------------------------------- |
| Tauri   | `src-tauri/` directory exists                            |
| Flutter | `pubspec.yaml` exists                                    |
| Swift   | `*.xcodeproj`, `*.xcworkspace`, or `Package.swift`       |
| Rust    | `Cargo.toml`                                             |
| Angular | `angular.json`                                           |
| NestJS  | `nest-cli.json`                                          |
| Next.js | `next.config.ts`, `next.config.js`, or `next.config.mjs` |
| Bun     | `bunfig.toml`                                            |
| Node    | `package.json`                                           |
| Python  | `pyproject.toml`, `setup.py`, or `requirements.txt`      |
| unknown | (none of the above matched)                              |

A directory is recognized as a project at all if it contains any of the above markers, a `.git` directory, or markers from your custom types. If none of these are present, the directory is treated as a container (like `Personal/Ongoing/`) and `wd` recurses into it looking for projects.

This is why `maxDepth` matters: a directory like `Personal/Ongoing/my-project/` needs at least depth 3 to be found when scanning from `Personal/`.

**Custom types** are checked after all built-in rules, so a project that contains both `manage.py` and `package.json` will be classified as `Node` (since `package.json` is a built-in marker), not `Django`. To change this behavior, you would need to remove the project from the Node category by ensuring it does not match any higher-priority rule — which is not currently possible to override on a per-project basis.

---

## Troubleshooting

**`wd: command not found`**

The shell integration is not active. Make sure your `~/.zshrc` contains:

```sh
source ~/.config/wd/wd.zsh
```

And that you have reloaded your shell (`source ~/.zshrc` or open a new tab).

**`wd-bin: command not found`**

The binary is not on your PATH. Check that `~/.local/bin` is in your `$PATH` and that the symlink exists:

```sh
ls -la ~/.local/bin/wd-bin
```

If missing, re-run the symlink step from the installation instructions.

**`wd is not configured yet`**

You need to run `wd setup` first to create the config file.

**Projects are missing from the list**

Run `wd scan` to refresh the cache. If projects are still missing, check:

- Is the directory inside a configured scan root?
- Does the project have any marker files (`package.json`, `pubspec.yaml`, etc.)?
- Is the directory name in `scanIgnore`?
- Is `maxDepth` deep enough for your directory structure?

**The drive is not mounted**

If your projects live on an external drive that is not currently mounted, `wd` will warn you during scan but continue with any other accessible roots. The cached entries from the unmounted drive remain in the list but will fail with an error if you try to navigate to them.

**Docker containers are not starting**

- Make sure OrbStack or Docker Desktop is running before you run `wd open`
- Check that the container names in your workspace match the actual container names (`docker ps -a`)
- Container names can change when you recreate them — update the workspace with `wd ws edit <name>` to reselect the right containers
- If a container fails due to a port conflict, `wd` will detect this and offer to stop the blocking container interactively

**Tabs are not opening**

- `wd` uses AppleScript (`osascript`) to open tabs — macOS will prompt for Automation permission the first time. Allow it in System Settings → Privacy & Security → Automation.
- Ghostty and Warp use keystroke simulation rather than a native API. This is less reliable if the terminal loses focus during the operation. If tabs are not appearing, try keeping the terminal focused while `wd open` runs.
- Tabs are only opened if at least one project in the workspace has a `tabs` array with entries.

**`wd open` changed directory but my editor is still in the old place**

`wd open` only changes the directory in the terminal tab where you ran it. If you want your editor to open the project, open it manually after navigating (`cursor .`, `code .`, etc.).

**The project list is slow to appear**

The cache may be rebuilding. This happens when:

- The cache is older than 24 hours
- The cache file does not exist

If rebuilding consistently takes more than a second or two, check if any of your scan roots contain very large numbers of directories. Add commonly large directories like `node_modules` to `scanIgnore` (it is there by default, but nested `node_modules` inside unusual structures might not be caught).
