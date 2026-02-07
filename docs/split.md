# Task Splitting Guide

Deep dive on `gwt split` — how task decomposition works, how to write good prompts, and when to use parallel vs interactive mode.

## How splitting works

When you run `gwt split "<task>"`, three things happen:

1. **Decompose** — Claude analyzes your task description and breaks it into independent, parallelizable work streams. Each stream gets an ID, a title, and a detailed prompt.

2. **Execute** — Each stream runs as a separate `gwt --work-only` process in its own git worktree. By default, all streams run in parallel. With `--interactive`, they run sequentially.

3. **Merge** — After all streams complete, successful ones are merged back into the current branch, pushed, and cleaned up. Failed streams are reported but don't block the others.

## The decomposition prompt

Under the hood, `gwt split` sends your task description to Claude with instructions to return a JSON array of work streams. Each stream has:

- **id** — A short kebab-case identifier (e.g. `add-tests`)
- **title** — A human-readable title
- **prompt** — The full, detailed prompt for the AI agent working on that stream

Claude follows these rules when decomposing:
- Each stream must be **independent** — it should not depend on the output of another stream
- If the task is a single indivisible unit, it returns an array with one element
- No meta-tasks like "review" or "integrate" — only concrete implementation tasks

## Writing effective task descriptions

The quality of the decomposition depends on how you describe the task.

### Be specific about what you want

```bash
# Vague — Claude may not split well
gwt split "improve the app"

# Specific — clear independent pieces
gwt split "add JWT auth to the API, write unit tests for the user model, update the API docs with the new endpoints"
```

### List independent pieces explicitly

If you already know how to break the work down, say so. Claude will respect explicit structure:

```bash
gwt split "1) add email validation to signup form 2) add rate limiting to login endpoint 3) write integration tests for auth flow"
```

### Use a file for complex tasks

For multi-paragraph descriptions with requirements, context, or acceptance criteria, use `--file`:

```bash
gwt split --file tasks.md --max-budget-usd 5
```

Your file can contain as much detail as needed:

```markdown
# Auth System Overhaul

## Stream 1: JWT middleware
Add JWT-based authentication middleware to the Express app.
- Generate tokens on login
- Validate tokens on protected routes
- Handle token refresh

## Stream 2: User model tests
Write comprehensive unit tests for the User model.
- Test CRUD operations
- Test validation rules
- Test password hashing

## Stream 3: API documentation
Update the OpenAPI spec with all auth-related endpoints.
- Login, logout, refresh endpoints
- Request/response schemas
- Error responses
```

### Avoid dependent tasks

Splitting works best when streams don't depend on each other. If task B needs the output of task A, they can't run in parallel.

```bash
# Bad — the migration must exist before tests can reference it
gwt split "create a database migration for users table, then write tests for the migration"

# Good — these are independent
gwt split "add input validation to the signup form, add rate limiting to the API, update the error handling docs"
```

If your task has dependencies, consider running dependent parts as separate `gwt` commands in sequence instead of using `split`.

## Parallel vs interactive mode

### Parallel (default)

All streams run simultaneously in print mode (`-p`). This is the fastest option and works well for independent tasks where you don't need to interact with Claude.

```bash
gwt split "add auth, write tests, update docs"
```

### Interactive (`--interactive`)

Streams run one at a time with interactive Claude sessions. Use this when you want to:
- Guide each stream manually
- Review work before moving to the next stream
- Debug issues interactively

```bash
gwt split "implement login and signup" --interactive
```

## Budget and model options

`--max-budget-usd` applies **per stream**, not to the total. If you set a $5 budget and Claude creates 3 streams, the maximum total cost is $15.

```bash
# Each stream gets up to $5
gwt split "big task" --max-budget-usd 5
```

The `--model` flag affects both the decomposition step (analyzing your task) and each work stream:

```bash
gwt split "complex refactor" --model sonnet
```

## What happens when streams fail

If a stream fails (Claude exits with a non-zero code), the other streams continue running. After all streams finish:

- Successful streams are merged, pushed, and cleaned up as normal
- Failed streams are reported in the summary table with their error
- The overall exit code is `1` if any stream failed, `0` if all succeeded

The summary looks like:

```
═══════════════════════════════════════════════
gwt split summary
───────────────────────────────────────────────
  OK    add-auth: Add JWT authentication
       merge: merged  push: pushed  cleanup: cleaned
  FAIL  add-tests: Write unit tests
       error: Claude exited with code 1
═══════════════════════════════════════════════
1 succeeded, 1 failed
```

Failed streams leave their worktrees intact so you can rescue them:

```bash
gwt rescue gwt/task-20260206-a1b2
```

## Lifecycle control

By default, successful streams go through the full lifecycle: merge → push → cleanup. You can control this:

```bash
# Skip pushing (merge and clean up locally)
gwt split "task" --no-push

# Keep worktrees around after merge
gwt split "task" --no-cleanup

# Pass extra flags to Claude
gwt split "task" -- --verbose
```

## Base ref

All worktrees created by split share the same base ref:

```bash
# All streams branch from release/v2
gwt split "task" --from release/v2
```

If not specified, streams branch from the current HEAD.
