# CLI Reference

Complete reference for every `gwt` command, flag, and option.

## `gwt` — Run a task

Create a worktree, run Claude in it, then merge, push, and clean up.

```
gwt                                    # interactive session (no prompt)
gwt "<prompt>"                         # auto-named branch
gwt <branch> "<prompt>"                # explicit branch name
```

**Lifecycle:** create worktree → Claude works → merge → push → cleanup

With no arguments, `gwt` creates a worktree and opens an interactive Claude session. With a prompt, Claude runs the task automatically. The branch name is auto-generated unless you provide one explicitly.

### Options

| Flag | Description |
|------|-------------|
| `-p, --print` | Non-interactive mode (`claude -p`). Claude runs headlessly and exits when done. |
| `--model <model>` | Override the Claude model (e.g. `opus`, `sonnet`, `haiku`). |
| `--max-budget-usd <n>` | Set a cost limit in USD for the Claude session. |
| `--permission-mode <mode>` | Set the Claude permission mode (e.g. `plan`). |
| `--from <ref>` | Base the worktree on a specific git ref (branch, tag, or commit). |
| `--no-push` | Skip pushing to remote after merge. |
| `--no-cleanup` | Keep the worktree directory after merge (don't delete it). |
| `--work-only` | Run only the work phase — skip merge, push, and cleanup entirely. |
| `--` | Pass all remaining flags through to `claude` verbatim. |
| `-h, --help` | Show help text. |
| `--version` | Show version number. |

### Examples

```bash
gwt                                              # interactive session
gwt "Add unit tests for auth"                    # auto-named branch
gwt feat/tests "Add unit tests for auth"         # explicit branch
gwt feat/tests "Add unit tests" -p --max-budget-usd 5
gwt "Add feature" --from release/v2              # base on specific ref
gwt "Add caching layer" --work-only              # skip merge/push/cleanup
gwt feat/fix "Fix bug" -- --permission-mode plan # pass flags to claude
```

---

## `gwt split` — Parallel task decomposition

Decompose a task into independent work streams using Claude, then run each in its own worktree.

```
gwt split "<task>" [options]
gwt split --file <path> [options]
```

Claude analyzes the task description and breaks it into independent, parallelizable streams. Each stream runs as a separate `gwt --work-only` child process. After all streams complete, successful ones are merged, pushed, and cleaned up.

By default, streams run in parallel with print mode (`-p`). Use `--interactive` to run them sequentially with interactive Claude sessions instead.

### Options

| Flag | Description |
|------|-------------|
| `--file <path>` | Read the task description from a file instead of the command line. |
| `--interactive` | Run streams sequentially with interactive Claude (instead of parallel). |
| `-p, --print` | Non-interactive mode. This is the default for `split` — accepted but ignored. |
| `--model <model>` | Override the Claude model. |
| `--max-budget-usd <n>` | Cost limit per stream (not total). |
| `--permission-mode <mode>` | Set the Claude permission mode. |
| `--from <ref>` | Base all worktrees on a specific git ref. |
| `--no-push` | Skip pushing after merge. |
| `--no-cleanup` | Keep worktrees after merge. |
| `--` | Pass remaining flags to `claude` verbatim. |
| `-h, --help` | Show help text. |

### Examples

```bash
gwt split "build auth, add tests, fix navbar"
gwt split --file tasks.md --max-budget-usd 5
gwt split "implement login and signup" --interactive
gwt split "add auth and update docs" --model sonnet --no-push
```

### Exit codes

- `0` — all streams succeeded
- `1` — one or more streams failed (others still completed)

See the [Task Splitting Guide](split.md) for tips on writing effective task descriptions.

---

## `gwt rescue` — Resume an orphaned session

Resume a Claude session in an existing worktree. Use when a previous session crashed, timed out, or needs follow-up.

```
gwt rescue <branch> [options] [-- <extra-claude-flags>...]
```

Tries `claude --resume` first to pick up the most recent session. If that fails in interactive mode, offers to start a fresh session. After Claude exits, continues through merge/push/cleanup unless `--work-only` is set.

### Options

| Flag | Description |
|------|-------------|
| `-p, --print` | Non-interactive mode (`claude -p`). |
| `--model <model>` | Override the Claude model. |
| `--max-budget-usd <n>` | Cost limit for Claude. |
| `--permission-mode <mode>` | Set the Claude permission mode. |
| `--no-push` | Skip pushing after merge. |
| `--no-cleanup` | Keep worktree after merge. |
| `--work-only` | Resume work only — skip merge/push/cleanup. |
| `--` | Pass remaining flags to `claude` verbatim. |
| `-h, --help` | Show help text. |

### Examples

```bash
gwt rescue feat/auth                         # resume interactively
gwt rescue feat/auth --work-only             # resume without merge/push/cleanup
gwt rescue feat/auth -p --max-budget-usd 5   # resume in print mode with budget
```

---

## `gwt merge` — Merge worktree branches

Merge worktree branch(es) into the current branch, push, and clean up. No AI involved — pure git operations.

```
gwt merge <branch> [branch2 ...] [options]
```

Multiple branches are processed sequentially. If one branch fails to merge, the remaining branches still proceed. A summary of failures is shown at the end.

### Options

| Flag | Description |
|------|-------------|
| `--no-push` | Skip pushing to remote after merge. |
| `--no-cleanup` | Keep the worktree directory after merge. |
| `-h, --help` | Show help text. |

### Examples

```bash
gwt merge feat/auth                                   # merge, push, clean up
gwt merge feat/auth --no-push                         # merge and clean up, skip push
gwt merge feat/auth --no-cleanup                      # merge and push, keep worktree
gwt merge feat/auth feat/tests feat/docs              # batch merge multiple
```

---

## `gwt delete` — Remove worktrees

Remove worktree(s) and delete their local branches.

```
gwt delete <branch> [branch2 ...] [options]
```

By default uses `git branch -d` (safe delete — fails if branch is unmerged). Use `--force` for unmerged branches (`git branch -D`). Multiple branches are processed sequentially.

### Options

| Flag | Description |
|------|-------------|
| `--force` | Force-delete unmerged branches (`git branch -D` instead of `-d`). |
| `-h, --help` | Show help text. |

### Examples

```bash
gwt delete feat/auth                                  # remove worktree + delete branch
gwt delete feat/auth --force                          # force-delete even if unmerged
gwt delete gwt/task-a gwt/task-b gwt/task-c           # batch delete
gwt delete gwt/task-a gwt/task-b --force              # batch force-delete
```

---

## `gwt status` — Session status

Show all worktrees with their current state, including whether a Claude agent is actively running.

```
gwt status [options]
```

### Options

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON for tooling integration. |
| `-h, --help` | Show help text. |

### Human-readable output

```
  main [main]
    /path/to/repo
  gwt/task-20260206-a1b2 [gwt, claude:running(pid:12345), changes]
    /path/to/worktree
```

### JSON output

```json
{
  "worktrees": [
    {
      "branch": "main",
      "path": "/path/to/repo",
      "head": "abc1234...",
      "isGwt": false,
      "isMain": true,
      "hasChanges": false,
      "claudeRunning": false,
      "claudePid": null
    }
  ]
}
```

### JSON fields

| Field | Type | Description |
|-------|------|-------------|
| `branch` | string | Branch name |
| `path` | string | Worktree directory path |
| `head` | string | HEAD commit SHA |
| `isGwt` | boolean | Whether this is a gwt-created worktree |
| `isMain` | boolean | Whether this is the main worktree |
| `hasChanges` | boolean | Whether the worktree has uncommitted changes |
| `claudeRunning` | boolean | Whether a Claude process is active |
| `claudePid` | number \| null | PID of the running Claude process |

### Examples

```bash
gwt status                                            # human-readable
gwt status --json                                     # JSON for tooling
gwt status --json | jq '.worktrees[] | select(.claudeRunning)'
```

---

## `gwt docs` — Built-in documentation

Show AI-friendly documentation for any gwt topic.

```
gwt docs [topic]
```

### Available topics

| Topic | Description |
|-------|-------------|
| *(none)* | Overview of all commands and options |
| `split` | Split command details |
| `rescue` | Rescue command details |
| `merge` | Merge command details |
| `delete` | Delete command details |
| `status` | Status command details |
| `workflows` | Common workflow patterns |

### Examples

```bash
gwt docs                   # overview
gwt docs split             # split command details
gwt docs workflows         # common workflow patterns
```
