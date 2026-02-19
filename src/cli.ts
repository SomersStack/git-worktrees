import { logError } from "./logger.js";
import { printSummary } from "./summary.js";
import { phaseWork, phaseMerge, phasePush, phaseCleanup } from "./phases/index.js";
import { generateBranchName } from "./branch-name.js";
import type { GwtOptions } from "./types.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { version: GWT_VERSION } = require("../package.json");

const USAGE = `gwt - Git Worktree Task

Usage: gwt                                    # new worktree + fresh Claude session
       gwt "<prompt>" [options]               # auto-named branch
       gwt <branch> "<prompt>" [options]      # explicit branch
       gwt split "<task>" [options]           # split task into parallel streams
       gwt beads [options]                    # split open beads into parallel sessions
       [-- <extra-claude-flags>...]

Options:
  -p, --print              Non-interactive mode (claude -p)
  --model <model>          Claude model override
  --max-budget-usd <n>     Cost limit for Claude
  --permission-mode <m>    Permission mode for Claude
  --from <ref>             Base ref for worktree (passed to git gtr new --from)
  --no-push                Skip push after merge
  --no-cleanup             Keep worktree after merge
  --work-only              Run work phase only (skip merge/push/cleanup)
  -h, --help               Show this help
  --version                Show version
  --                       Pass remaining flags to claude verbatim

Subcommands:
  split                    Decompose a task into independent work streams
                           and run them in parallel. See: gwt split --help
  beads                    Group open beads and run each group in parallel.
                           See: gwt beads --help
  rescue <branch>          Resume a Claude session in an orphaned worktree
  merge  <branch> [...]    Merge worktree branch(es) (no AI). See: gwt merge --help
  delete <branch> [...]    Remove worktree(s) and their branches. See: gwt delete --help
  status                   Show worktree and session status. See: gwt status --help
  docs   [topic]           AI-friendly docs. Topics: split, beads, rescue, merge, delete, status, workflows

Examples:
  gwt
  gwt "Add unit tests for auth"
  gwt feat/tests "Add unit tests for auth"
  gwt feat/tests "Add unit tests" -p --max-budget-usd 5
  gwt feat/fix "Fix bug" -- --permission-mode plan
  gwt split "build auth, add tests, fix navbar" -p --max-budget-usd 5`;

export function parseArgs(argv: string[]): GwtOptions | null {
  let branch = "";
  let prompt = "";
  let printMode = false;
  let model = "";
  let maxBudgetUsd = "";
  let permissionMode = "";
  let fromRef = "";
  let noPush = false;
  let noCleanup = false;
  let workOnly = false;
  let extraClaudeFlags: string[] = [];
  const positionals: string[] = [];

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--") {
      extraClaudeFlags = argv.slice(i + 1);
      break;
    }

    switch (arg) {
      case "-p":
      case "--print":
        printMode = true;
        i++;
        break;
      case "--model":
        model = argv[++i] ?? "";
        i++;
        break;
      case "--max-budget-usd":
        maxBudgetUsd = argv[++i] ?? "";
        i++;
        break;
      case "--permission-mode":
        permissionMode = argv[++i] ?? "";
        i++;
        break;
      case "--from":
        fromRef = argv[++i] ?? "";
        i++;
        break;
      case "--no-push":
        noPush = true;
        i++;
        break;
      case "--no-cleanup":
        noCleanup = true;
        i++;
        break;
      case "--work-only":
        workOnly = true;
        i++;
        break;
      case "-h":
      case "--help":
        console.log(USAGE);
        process.exit(0);
        break;
      case "--version":
        console.log(`gwt version ${GWT_VERSION}`);
        process.exit(0);
        break;
      default:
        if (arg.startsWith("-")) {
          logError(`Unknown flag: ${arg}`);
          console.log(USAGE);
          process.exit(1);
        }
        positionals.push(arg);
        i++;
        break;
    }
  }

  // Resolve positionals into branch + prompt.
  // Git branch names cannot contain spaces, so any positional with spaces is a
  // prompt fragment (this commonly happens when shell quoting goes wrong and a
  // single quoted prompt is split into multiple argv entries).
  if (positionals.length === 0) {
    // No args → fresh session with auto-generated branch
    branch = generateBranchName();
  } else if (positionals.length === 1) {
    const arg = positionals[0];
    if (arg.includes(" ")) {
      // Contains spaces → must be a prompt, not a branch
      branch = generateBranchName();
      prompt = arg;
    } else {
      // Could be a branch name; treat as prompt with auto-generated branch
      // (matching the original single-arg behavior)
      branch = generateBranchName();
      prompt = arg;
    }
  } else if (positionals.length === 2 && !positionals[0].includes(" ")) {
    // Classic:  gwt <branch> "<prompt>"
    branch = positionals[0];
    prompt = positionals[1];
  } else {
    // Multiple args or first arg has spaces → shell probably mangled quoting.
    // Join everything as the prompt and auto-generate a branch.
    branch = generateBranchName();
    prompt = positionals.join(" ");
  }

  return {
    branch,
    prompt,
    printMode,
    model,
    maxBudgetUsd,
    permissionMode,
    fromRef,
    noPush,
    noCleanup,
    workOnly,
    extraClaudeFlags,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Subcommand routing
  if (args[0] === "split") {
    const { splitMain } = await import("./commands/split.js");
    await splitMain(args.slice(1));
    return;
  }

  if (args[0] === "beads") {
    const { beadsMain } = await import("./commands/beads.js");
    await beadsMain(args.slice(1));
    return;
  }

  if (args[0] === "rescue") {
    const { rescueMain } = await import("./commands/rescue.js");
    await rescueMain(args.slice(1));
    return;
  }

  if (args[0] === "merge") {
    const { mergeMain } = await import("./commands/merge.js");
    await mergeMain(args.slice(1));
    return;
  }

  if (args[0] === "delete") {
    const { deleteMain } = await import("./commands/delete.js");
    await deleteMain(args.slice(1));
    return;
  }

  if (args[0] === "status") {
    const { statusMain } = await import("./commands/status.js");
    await statusMain(args.slice(1));
    return;
  }

  if (args[0] === "docs") {
    const { docsMain } = await import("./commands/docs.js");
    docsMain(args.slice(1));
    return;
  }

  const options = parseArgs(args);
  if (!options) process.exit(1);

  try {
    const ctx = await phaseWork(options);
    if (!options.workOnly) {
      await phaseMerge(ctx);
      await phasePush(ctx);
      await phaseCleanup(ctx);
      printSummary(options.branch, ctx.sourceBranch, options);
    }
  } catch (err) {
    logError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";

const thisFile = fileURLToPath(import.meta.url);
const argv1 = process.argv[1];
const isMain =
  argv1 &&
  (argv1 === thisFile ||
    (() => {
      try {
        return realpathSync(argv1) === realpathSync(thisFile);
      } catch {
        return false;
      }
    })());

if (isMain) {
  main();
}
