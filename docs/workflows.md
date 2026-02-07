# Workflow Recipes

Common patterns for using `gwt` in day-to-day development.

## Quick one-off task

Hand Claude a task, walk away, come back to merged code.

```bash
gwt "Fix the login bug in auth.ts"
```

Creates a worktree, Claude fixes the bug, merges the result back, pushes, and cleans up. The branch name is auto-generated.

## Interactive session

Open a Claude session with no predefined task — useful for exploration, debugging, or when you want to steer the work interactively.

```bash
gwt
```

You'll get a fresh worktree with an interactive Claude session. When you exit Claude, the changes merge back automatically.

## Work-only mode (review before merging)

Run Claude in a worktree but skip the automatic merge. Inspect the changes yourself, then merge when ready.

```bash
# Step 1: Claude works
gwt "Add caching layer" --work-only

# Step 2: Review the changes (the branch name is printed)
cd ../gwt-task-20260206-a1b2
git diff main

# Step 3: Merge when satisfied
gwt merge gwt/task-20260206-a1b2
```

## Non-interactive with budget

Run a task headlessly with a cost cap. Good for CI or background work.

```bash
gwt "Refactor database module" -p --max-budget-usd 10
```

The `-p` flag runs Claude in print mode (non-interactive). `--max-budget-usd` caps spending.

## Parallel tasks with split

Break a large task into independent streams and run them all at once.

```bash
gwt split "add auth, write tests, update API docs" -p --max-budget-usd 5
```

Claude decomposes the task, runs each piece in its own worktree in parallel, then merges the results. The `--max-budget-usd` applies per stream, not to the total.

## Split from a file

For complex multi-line task descriptions, write them in a file and pass it to split.

```bash
gwt split --file tasks.md --model sonnet
```

The file can contain detailed requirements, acceptance criteria, or anything else Claude needs to understand the work.

## Sequential split (interactive)

If you want to guide each stream interactively rather than running them all in parallel:

```bash
gwt split "implement login and signup" --interactive
```

Each stream runs one at a time with an interactive Claude session.

## Rescue a failed session

When a Claude session crashes, times out, or you need to pick up where it left off:

```bash
gwt rescue gwt/task-20260206-a1b2
```

This opens a new Claude session in the existing worktree, starting with `--resume` to continue the previous conversation. After Claude exits, the full lifecycle (merge/push/cleanup) runs automatically.

## Rescue without merge

Resume work in a worktree but skip the automatic merge — useful when you want to inspect results before merging.

```bash
gwt rescue gwt/task-20260206-a1b2 --work-only
```

Later, merge manually:

```bash
gwt merge gwt/task-20260206-a1b2
```

## Branch from a specific ref

Base the worktree on a release branch, tag, or any other git ref:

```bash
gwt "Add feature" --from release/v2
gwt "Hotfix" --from v1.3.0
```

## Check what's running

See all worktrees and whether Claude is active in any of them:

```bash
gwt status
```

For machine-readable output (useful for scripts or the VS Code extension):

```bash
gwt status --json
gwt status --json | jq '.worktrees[] | select(.claudeRunning)'
```

## Batch merge

Merge multiple worktree branches at once. They're processed sequentially — if one fails, the rest still proceed.

```bash
gwt merge feat/auth feat/tests feat/docs
```

## Batch delete

Clean up multiple worktrees and their branches in one command:

```bash
gwt delete gwt/task-a gwt/task-b gwt/task-c
```

Use `--force` if branches are unmerged:

```bash
gwt delete gwt/task-a gwt/task-b --force
```

## Passing flags to Claude

Use `--` to forward flags directly to `claude`:

```bash
gwt "Fix bug" -- --permission-mode plan
```

Everything after `--` is passed to the `claude` CLI verbatim.

## Choosing a model

Override the default Claude model for a session:

```bash
gwt "Write docs" --model sonnet
gwt "Complex refactor" --model opus
```

For split, the model is used both for task decomposition and for each work stream:

```bash
gwt split "big task" --model sonnet --max-budget-usd 3
```
