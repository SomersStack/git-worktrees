const DOCS_OVERVIEW = `gwt - Git Worktree Task Runner

Commands:
  gwt                             New worktree + fresh interactive Claude session
  gwt "<prompt>"                  Run task in new worktree (auto-named branch)
  gwt <branch> "<prompt>"         Run task with explicit branch name
  gwt split "<task>"              Decompose task into parallel work streams
  gwt beads                       Group open beads into parallel sessions
  gwt rescue <branch>             Resume Claude session in orphaned worktree
  gwt merge <branch> [...]        Merge worktree branch(es) (no AI)
  gwt delete <branch> [...]       Remove worktree(s) and their branches
  gwt status                      Show worktree and session status
  gwt docs [topic]                Show this documentation

Global Options:
  -p, --print                    Non-interactive mode (claude -p)
  --model <model>                Claude model override
  --max-budget-usd <n>           Cost limit for Claude
  --permission-mode <m>          Permission mode for Claude
  --from <ref>                   Base ref for worktree
  --no-push                      Skip push after merge
  --no-cleanup                   Keep worktree after merge
  --work-only                    Run work phase only (skip merge/push/cleanup)
  -- <flags>                     Pass remaining flags to claude verbatim

Automatic lifecycle: worktree create -> claude work -> merge -> push -> cleanup

Detail: gwt docs <split|beads|rescue|merge|delete|status|workflows>`;

const DOCS_SPLIT = `gwt split - Parallel task decomposition

Usage:
  gwt split "<task>" [options]
  gwt split --file <path> [options]

Splits a task description into independent work streams using Claude,
then runs each stream in its own worktree in parallel.

Options:
  --file <path>                  Read task from file instead of argument
  --interactive                  Run streams sequentially (interactive Claude)
  -p, --print                    Non-interactive mode [default for split]
  --model <model>                Claude model override
  --max-budget-usd <n>           Cost limit per stream
  --permission-mode <m>          Permission mode for Claude
  --from <ref>                   Base ref for worktrees
  --no-push                      Skip push after merge
  --no-cleanup                   Keep worktrees after merge
  -- <flags>                     Pass remaining flags to claude verbatim

Examples:
  gwt split "add auth, write tests, update docs"
  gwt split "build login page and add API rate limiting" -p --max-budget-usd 5
  gwt split --file tasks.md --model sonnet --no-push`;

const DOCS_BEADS = `gwt beads - Split open beads into parallel agent sessions

Usage:
  gwt beads [options]

Reads all ready beads (via \`bd ready\`), uses Claude to group them into
small clusters of closely related items, and spawns a parallel gwt session
per group. Each session claims its beads, does the work, and closes them.

Options:
  --grouping-model <model>   Model for the grouping step (default: sonnet)
  --interactive              Run streams sequentially (interactive Claude)
  --model <model>            Claude model override for each work stream
  --max-budget-usd <n>       Cost limit per stream
  --permission-mode <m>      Permission mode for Claude
  --from <ref>               Base ref for worktrees
  --no-push                  Skip push after merge
  --no-cleanup               Keep worktrees after merge
  -- <flags>                 Pass remaining flags to claude verbatim

Examples:
  gwt beads
  gwt beads --max-budget-usd 5
  gwt beads --grouping-model opus --model sonnet
  gwt beads --interactive`;

const DOCS_RESCUE = `gwt rescue - Resume work in an orphaned worktree

Usage:
  gwt rescue <branch> [options] [-- <extra-claude-flags>...]

Opens a new Claude session in an existing worktree. Use when a previous
session crashed, timed out, or needs manual follow-up.

Options:
  -p, --print                    Non-interactive mode (claude -p)
  --model <model>                Claude model override
  --max-budget-usd <n>           Cost limit for Claude
  --permission-mode <m>          Permission mode for Claude
  --no-push                      Skip push after merge
  --no-cleanup                   Keep worktree after merge
  --work-only                    Run work phase only (skip merge/push/cleanup)
  -- <flags>                     Pass remaining flags to claude verbatim

Examples:
  gwt rescue feat/auth-login
  gwt rescue gwt/abc123 --work-only
  gwt rescue feat/fix -p --max-budget-usd 3`;

const DOCS_MERGE = `gwt merge - Merge worktree branch(es)

Usage:
  gwt merge <branch> [branch2 ...] [options]

Merges the specified worktree branch(es) into the current branch, then
pushes and cleans up each worktree. No AI involved — pure git operations.

Multiple branches are processed sequentially. If a branch fails, the
remaining branches still proceed and a summary of failures is shown.

Options:
  --no-push                      Skip push after merge
  --no-cleanup                   Keep worktree after merge

Examples:
  gwt merge feat/auth-login
  gwt merge gwt/abc123 --no-push
  gwt merge feat/fix --no-cleanup
  gwt merge feat/auth feat/tests feat/docs       # batch merge`;

const DOCS_DELETE = `gwt delete - Remove worktree(s) and their branches

Usage:
  gwt delete <branch> [branch2 ...] [options]

Removes the worktree directory and deletes the local branch for each
specified branch. Multiple branches are processed sequentially.

Options:
  --force                        Force-delete unmerged branches (git branch -D)

Examples:
  gwt delete feat/abandoned-feature
  gwt delete gwt/abc123 --force
  gwt delete gwt/task-a gwt/task-b gwt/task-c    # batch delete
  gwt delete gwt/task-a gwt/task-b --force       # batch force-delete`;

const DOCS_WORKFLOWS = `Common gwt Workflows

1. Interactive session (no prompt):
   gwt
   # Creates worktree -> opens interactive Claude -> merges -> pushes -> cleans up

2. Single task (auto-merge):
   gwt "Fix the login bug in auth.ts"
   # Creates worktree -> Claude works -> merges -> pushes -> cleans up

3. Single task (manual merge):
   gwt "Add caching layer" --work-only
   # Review changes, then:
   gwt merge gwt/<branch>

4. Parallel tasks:
   gwt split "add auth, write tests, update API docs" -p --max-budget-usd 5
   # Splits into streams, runs in parallel, merges each result

5. Parallel tasks from a file:
   gwt split --file tasks.md --model sonnet
   # Reads multi-line task description from file

6. Rescue a failed session:
   gwt rescue gwt/<branch>
   # Opens new Claude session in existing worktree
   # Continues from where previous session left off

7. Rescue without merge (review first):
   gwt rescue gwt/<branch> --work-only
   # Resume work but skip merge/push/cleanup

8. Non-interactive with budget:
   gwt "Refactor database module" -p --max-budget-usd 10 --model opus

9. Check session status:
   gwt status                      # human-readable
   gwt status --json               # JSON for tooling

10. Batch merge multiple worktrees:
    gwt merge feat/auth feat/tests feat/docs

11. Batch clean up abandoned worktrees:
    gwt delete gwt/task-a gwt/task-b gwt/task-c
    gwt delete gwt/task-a gwt/task-b --force   # if unmerged

12. Create from a specific base:
    gwt "Add feature" --from release/v2`;

const DOCS_STATUS = `gwt status - Show worktree and session status

Usage:
  gwt status [options]

Shows all worktrees with their current state, including whether a Claude
agent is actively running in each worktree.

Options:
  --json                         Output as JSON (for tooling integration)

Output fields (JSON mode):
  branch          Branch name
  path            Worktree directory path
  head            HEAD commit SHA
  isGwt           Whether this is a gwt-created worktree
  isMain          Whether this is the main worktree
  hasChanges      Whether the worktree has uncommitted changes
  claudeRunning   Whether a Claude process is active in this worktree
  claudePid       PID of the running Claude process (or null)

Examples:
  gwt status
  gwt status --json
  gwt status --json | jq '.worktrees[] | select(.claudeRunning)'`;

const VALID_TOPICS = ["split", "beads", "rescue", "merge", "delete", "status", "workflows"] as const;

const TOPIC_MAP: Record<string, string> = {
  split: DOCS_SPLIT,
  beads: DOCS_BEADS,
  rescue: DOCS_RESCUE,
  merge: DOCS_MERGE,
  delete: DOCS_DELETE,
  status: DOCS_STATUS,
  workflows: DOCS_WORKFLOWS,
};

export function docsMain(argv: string[]): void {
  const topic = argv[0];

  if (!topic) {
    console.log(DOCS_OVERVIEW);
    return;
  }

  const doc = TOPIC_MAP[topic];
  if (doc) {
    console.log(doc);
    return;
  }

  console.error(`Unknown docs topic: "${topic}"`);
  console.error(`Available topics: ${VALID_TOPICS.join(", ")}`);
  process.exit(1);
}
