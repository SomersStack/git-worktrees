# VS Code Extension Integration

The [Workflow extension](https://github.com/user/vs-workflow-extension) provides a sidebar panel for managing gwt worktrees directly from VS Code. It wraps gwt CLI commands in a tree view with inline action buttons, pre-launch option dialogs, and live session status tracking.

## Overview

The extension adds a **Worktrees** panel in the Workflow sidebar. It displays:

- A **GWT header row** with the installed gwt version and action buttons
- A **worktree list** showing every git worktree, with per-item action buttons
- **Live status** — green icon when a Claude agent is running in a worktree
- **Diff stats** — file count and insertions/deletions for each worktree branch

The panel auto-refreshes when worktrees are created or deleted (via file watcher on `.git/worktrees/`), and when any gwt terminal closes.

## GWT Header Buttons

The GWT header row provides four inline buttons:

| Button | Icon | Action |
|--------|------|--------|
| New GWT Agent Session | `play` | Prompts for a task description, then shows a launch options dialog (model, budget, work-only, base ref). Runs `gwt "<prompt>" [flags]` in a terminal. |
| New GWT Interactive Session | `comment-discussion` | Runs bare `gwt` — creates a worktree and opens an interactive Claude session with no initial prompt. |
| Split Task | `split-horizontal` | Prompts for a task description, shows launch options, then runs `gwt split "<task>" [flags]` in a terminal. |
| GWT Docs | `book` | Shows a topic picker (overview, split, rescue, merge, delete, status, workflows) and displays `gwt docs <topic>` output in a webview panel. |

Right-clicking the header row also shows:

| Menu Item | Action |
|-----------|--------|
| Split Task from Editor | Opens a temp `.md` file in the editor for writing a multi-line task description. After editing, runs `gwt split --file <path>`. |
| Batch Merge Worktrees | Shows a multi-select picker of all non-main worktrees, then runs `gwt merge branch1 branch2 ...` |
| Batch Delete Worktrees | Shows a multi-select picker, then runs `gwt delete branch1 branch2 ... [--force]` |

## Worktree Item Buttons

Each worktree row (except the main worktree) has inline action buttons:

| Button | Icon | Action | CLI equivalent |
|--------|------|--------|----------------|
| Merge | `git-merge` | Confirms, then runs `gwt merge <branch>` | `gwt merge <branch>` |
| Rescue | `debug-restart` | Asks "Full lifecycle" or "Work only", then runs `gwt rescue <branch> [--work-only]` | `gwt rescue <branch>` |
| Open in New Window | `multiple-windows` | Opens the worktree directory in a new VS Code window | — |
| Claude Session | `terminal` | Opens a terminal in the worktree and runs `claude --resume \|\| claude` | — |
| View Diff | `diff` | Shows a quick pick of changed files (vs HEAD), opens VS Code diff viewer for selected file | `git diff HEAD...<branch>` |
| Delete | `trash` | Confirms (with force option), runs `gwt delete <branch> [--force]` | `gwt delete <branch>` |

The main worktree row only shows "Open in New Window" and "Claude Session".

## Launch Options Dialog

When creating a new agent session or split, the extension shows a 4-step options dialog:

1. **Model** — Default, opus, sonnet, or haiku (`--model`)
2. **Budget** — Max USD cost limit (`--max-budget-usd`)
3. **Lifecycle** — Full (work + merge + push + cleanup) or Work only (`--work-only`)
4. **Base Ref** — Current branch, or pick from branches/tags (`--from`)

Pressing Escape at any step uses defaults for the remaining options.

## Session Status Tracking

The extension calls `gwt status --json` each time the tree refreshes to enrich the worktree list with live session data:

- **Claude running** — Worktree icon changes to a green play circle. Description shows "agent running".
- **Uncommitted changes** — Description shows "uncommitted changes".
- **Diff summary** — Description shows file count and +/- stats (e.g., `3 files +45 -12`).

Hovering over a worktree item shows a tooltip with full details including Claude PID and diff stat.

## Auto-Refresh and Notifications

The extension listens for VS Code terminal close events. When a terminal created by a gwt command closes:

- The worktree tree view is **immediately refreshed** (no polling delay).
- A **notification** is shown (e.g., "GWT session finished: GWT: implement auth").

This covers terminals named with prefixes: `gwt`, `GWT`, `Claude:`.

## CLI Commands Used

The extension invokes these gwt commands:

| Extension action | CLI command |
|------------------|-------------|
| New agent session | `gwt "<prompt>" [--model M] [--max-budget-usd N] [--work-only] [--from REF]` |
| Interactive session | `gwt` |
| Split task | `gwt split "<task>" [flags]` |
| Split from file | `gwt split --file <path> [flags]` |
| Merge worktree | `gwt merge <branch>` |
| Batch merge | `gwt merge <branch1> <branch2> ...` |
| Rescue worktree | `gwt rescue <branch> [--work-only]` |
| Delete worktree | `gwt delete <branch> [--force]` |
| Batch delete | `gwt delete <branch1> <branch2> ... [--force]` |
| Session status | `gwt status --json` |
| View docs | `gwt docs [topic]` |
| Version check | `gwt --version` |

## View Title Buttons

The panel title bar has two buttons:

| Button | Icon | Action |
|--------|------|--------|
| Create Worktree | `add` | Prompts for a description, runs `gwt "<prompt>"` (simple mode, no options dialog) |
| Refresh | `refresh` | Manually refreshes the worktree list |
