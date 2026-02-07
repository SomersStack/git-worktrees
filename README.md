# ai-git-worktrees

Run AI coding tasks in isolated git worktrees — automatically create, work, merge, push, and clean up.

## What it does

`gwt` gives every AI coding task its own git worktree. You describe what you want, Claude does the work in an isolated branch, and the result gets merged back automatically. No stashing, no branch juggling, no cleanup.

```
gwt "Fix the auth bug"

  create worktree ──► Claude works ──► merge ──► push ──► cleanup 
```

Split larger tasks into parallel work streams with `gwt split`:

```
gwt split "add auth, write tests, update docs"

                 ┌── worktree 1 ──► Claude ──► merge ──┐
  decompose ───► ├── worktree 2 ──► Claude ──► merge ──┼──► push ──► cleanup
                 └── worktree 3 ──► Claude ──► merge ──┘
```

Also includes tools to rescue crashed sessions, batch-merge results, and manage permissions/limits.

## Quick start

```bash
npm install -g ai-git-worktrees

# Run your first task
gwt "Add input validation to the signup form"
```

That's it. A worktree is created, Claude does the work, and the changes are merged back into your current branch.

## Core commands

| Command | What it does |
|---------|--------------|
| `gwt "<prompt>"` | Run a task in a new worktree (full lifecycle) |
| `gwt` | Open an interactive Claude session in a new worktree |
| `gwt split "<task>"` | Decompose a task into parallel work streams |
| `gwt rescue <branch>` | Resume a Claude session in an existing worktree |
| `gwt merge <branch>` | Merge a worktree branch (no AI) |
| `gwt delete <branch>` | Remove a worktree and its branch |
| `gwt status` | Show all worktrees and running sessions |
| `gwt docs [topic]` | Built-in documentation for any command or topic |

## Examples

**Single task — fully automatic:**
```bash
gwt "Add unit tests for the auth module"
```

**Parallel tasks — split and run simultaneously:**
```bash
gwt split "add JWT auth, write API tests, update the docs" --max-budget-usd 5
```

**Work only — review before merging:**
```bash
gwt "Refactor the database layer" --work-only
# inspect changes, then:
gwt merge gwt/task-20260206-a1b2
```

**Rescue a crashed session:**
```bash
gwt rescue gwt/task-20260206-a1b2
```

**Check what's running:**
```bash
gwt status
```

## Configuration

| Flag | Description |
|------|-------------|
| `-p, --print` | Non-interactive mode (headless) |
| `--model <model>` | Claude model override (`opus`, `sonnet`, `haiku`) |
| `--max-budget-usd <n>` | Cost limit for the session |
| `--permission-mode <mode>` | Permission mode for Claude |
| `--from <ref>` | Base worktree on a specific branch, tag, or commit |
| `--work-only` | Skip merge/push/cleanup (work phase only) |
| `--no-push` | Skip push after merge |
| `--no-cleanup` | Keep worktree after merge |
| `--` | Pass remaining flags to `claude` verbatim |

See the [full CLI reference](docs/commands.md) for every command and option.

## VS Code extension

A sidebar panel for managing worktrees, launching sessions, and tracking status — all from VS Code. See the [VS Code extension docs](docs/vscode-extension.md).

## Requirements

- [Claude Code](https://claude.com/claude-code)
- Node.js 22+
- Git

## Documentation

- [Full CLI reference](docs/commands.md) — every command, flag, and option
- [Workflow recipes](docs/workflows.md) — common patterns and examples
- [Task splitting guide](docs/split.md) — how decomposition works, tips for good prompts
- [VS Code extension](docs/vscode-extension.md) — sidebar panel integration

## License

MIT
