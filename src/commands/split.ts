import { readFileSync } from "node:fs";
import { logStep, logInfo, logError, logWarn } from "../logger.js";
import { splitWork } from "../splitter.js";
import {
  runStreamsParallel,
  runStreamsSequential,
  runStreamsInTerminals,
  type RunResult,
} from "../stream-runner.js";
import { phaseMerge, phasePush, phaseCleanup } from "../phases/index.js";
import { getCurrentBranch, getWorktreePath } from "../git.js";
import type { SplitOptions, StreamResult } from "../types.js";

const SPLIT_USAGE = `gwt split - Split a task into parallel work streams

Usage: gwt split "<task>" [options]
       gwt split --file <path> [options]

Options:
  --file <path>            Read task description from a file
  --interactive            Run streams sequentially in current terminal
  -p, --print, --headless  Run headless (non-interactive, no terminal windows)
  --model <model>          Claude model override
  --max-budget-usd <n>     Cost limit per stream
  --permission-mode <m>    Permission mode for Claude
  --from <ref>             Base ref for worktrees
  --no-push                Skip push after merge
  --no-cleanup             Keep worktrees after merge
  -h, --help               Show this help
  --                       Pass remaining flags to claude verbatim

By default, opens each stream in its own Terminal window with an interactive
Claude session. Use -p/--headless for background execution.

Examples:
  gwt split "build auth, add tests, fix navbar"
  gwt split --file tasks.md --max-budget-usd 5
  gwt split "implement login and signup" --interactive
  gwt split "add tests, fix lint" -p --max-budget-usd 5`;

export function parseSplitArgs(argv: string[]): SplitOptions | null {
  let input = "";
  let inputFile = "";
  let interactive = false;
  let headless = false;
  let model = "";
  let maxBudgetUsd = "";
  let permissionMode = "";
  let fromRef = "";
  let noPush = false;
  let noCleanup = false;
  let extraClaudeFlags: string[] = [];

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--") {
      extraClaudeFlags = argv.slice(i + 1);
      break;
    }

    switch (arg) {
      case "-h":
      case "--help":
        console.log(SPLIT_USAGE);
        process.exit(0);
        break;
      case "--file":
        inputFile = argv[++i] ?? "";
        i++;
        break;
      case "--interactive":
        interactive = true;
        i++;
        break;
      case "-p":
      case "--print":
      case "--headless":
        headless = true;
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
      default:
        if (arg.startsWith("-")) {
          logError(`Unknown flag: ${arg}`);
          console.log(SPLIT_USAGE);
          process.exit(1);
        }
        if (!input) {
          input = arg;
        } else {
          logError(`Unexpected argument: ${arg}`);
          console.log(SPLIT_USAGE);
          process.exit(1);
        }
        i++;
        break;
    }
  }

  if (!input && !inputFile) {
    logError("No task description provided. Pass a string or use --file.");
    console.log(SPLIT_USAGE);
    return null;
  }

  return {
    input,
    inputFile,
    interactive,
    headless,
    model,
    maxBudgetUsd,
    permissionMode,
    fromRef,
    noPush,
    noCleanup,
    extraClaudeFlags,
  };
}

function getInput(options: SplitOptions): string {
  if (options.inputFile) {
    try {
      return readFileSync(options.inputFile, "utf-8").trim();
    } catch (err) {
      throw new Error(
        `Failed to read file: ${options.inputFile}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
  return options.input;
}

function resolveGwtBin(): string {
  // We're running inside the gwt binary, so use process.argv[1]
  return process.argv[1];
}

const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function printSplitSummary(results: StreamResult[]): void {
  process.stderr.write("\n");
  process.stderr.write(
    "═══════════════════════════════════════════════\n",
  );
  process.stderr.write(`${BOLD}gwt split summary${RESET}\n`);
  process.stderr.write(
    "───────────────────────────────────────────────\n",
  );

  for (const r of results) {
    const status = r.success
      ? `${GREEN}OK${RESET}`
      : `${RED}FAIL${RESET}`;
    const merge = r.merged
      ? "merged"
      : r.success
        ? `${YELLOW}not merged${RESET}`
        : "—";
    const push = r.pushed
      ? "pushed"
      : r.success
        ? `${YELLOW}not pushed${RESET}`
        : "—";
    const clean = r.cleaned ? "cleaned" : "kept";

    process.stderr.write(
      `  ${status}  ${r.stream.id}: ${r.stream.title}\n`,
    );
    process.stderr.write(
      `       merge: ${merge}  push: ${push}  cleanup: ${clean}\n`,
    );
    if (r.error) {
      process.stderr.write(`       error: ${r.error}\n`);
    }
  }

  process.stderr.write(
    "═══════════════════════════════════════════════\n",
  );

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  process.stderr.write(
    `${BOLD}${succeeded} succeeded, ${failed} failed${RESET}\n`,
  );
}

export async function splitMain(argv: string[]): Promise<void> {
  const options = parseSplitArgs(argv);
  if (!options) process.exit(1);

  const input = getInput(options);
  const gwtBin = resolveGwtBin();
  const sourceDir = process.cwd();
  const sourceBranch = await getCurrentBranch(sourceDir);

  // Step 1: Decompose task
  let streams;
  try {
    streams = await splitWork(input, options.model || undefined);
  } catch (err) {
    logError(
      `Split failed: ${err instanceof Error ? err.message : err}`,
    );
    process.stderr.write("\n");
    logStep("Fallback: use gwt directly to run the task in a worktree");
    process.stderr.write(
      [
        "",
        "The task decomposition failed, but you can still run the task",
        "using gwt directly. Run the following command to create a worktree",
        "and kick off a Claude session for the full task:",
        "",
        `  gwt "${input.replace(/"/g, '\\"')}"`,
        "",
        "Or, if you can manually break the task into parts, run one gwt",
        "command per sub-task:",
        "",
        `  gwt <branch-name> "<sub-task prompt>"`,
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  logStep(`Decomposed into ${streams.length} work stream(s):`);
  for (const s of streams) {
    process.stderr.write(`  • ${s.id}: ${s.title}\n`);
    process.stderr.write(`    branch: ${s.branch}\n`);
  }
  process.stderr.write("\n");

  // Step 2: Run streams
  let runResults: RunResult[];
  if (options.interactive) {
    runResults = await runStreamsSequential(streams, options, gwtBin);
  } else if (options.headless) {
    runResults = await runStreamsParallel(streams, options, gwtBin);
  } else {
    // Default: open each stream in its own Terminal window
    const branches = runStreamsInTerminals(streams, options, gwtBin);
    logStep(`Opened ${branches.length} Terminal window(s). Use these to check/merge when done:`);
    for (const b of branches) {
      process.stderr.write(`  gwt merge ${b}\n`);
    }
    return;
  }

  // Step 3: Post-process each successful stream (merge, push, cleanup)
  const finalResults: StreamResult[] = [];

  for (const rr of runResults) {
    const result: StreamResult = {
      stream: rr.stream,
      success: rr.success,
      error: rr.error,
      merged: false,
      pushed: false,
      cleaned: false,
    };

    if (!rr.success) {
      finalResults.push(result);
      continue;
    }

    // Merge
    const worktreePath = await getWorktreePath(rr.stream.branch, sourceDir);
    const ctx = {
      options: {
        branch: rr.stream.branch,
        prompt: rr.stream.prompt,
        printMode: true,
        model: options.model,
        maxBudgetUsd: options.maxBudgetUsd,
        permissionMode: options.permissionMode,
        fromRef: options.fromRef,
        noPush: options.noPush,
        noCleanup: options.noCleanup,
        workOnly: false,
        extraClaudeFlags: options.extraClaudeFlags,
      },
      sourceDir,
      sourceBranch,
      worktreePath,
    };

    try {
      await phaseMerge(ctx);
      result.merged = true;
    } catch (err) {
      logWarn(
        `Merge failed for ${rr.stream.id}: ${err instanceof Error ? err.message : err}`,
      );
      result.error = `merge failed: ${err instanceof Error ? err.message : err}`;
      finalResults.push(result);
      continue;
    }

    // Push
    try {
      await phasePush(ctx);
      result.pushed = !options.noPush;
    } catch (err) {
      logWarn(
        `Push failed for ${rr.stream.id}: ${err instanceof Error ? err.message : err}`,
      );
      result.error = `push failed: ${err instanceof Error ? err.message : err}`;
    }

    // Cleanup
    try {
      await phaseCleanup(ctx);
      result.cleaned = !options.noCleanup;
    } catch (err) {
      logWarn(
        `Cleanup failed for ${rr.stream.id}: ${err instanceof Error ? err.message : err}`,
      );
    }

    finalResults.push(result);
  }

  // Step 4: Summary
  printSplitSummary(finalResults);

  const anyFailed = finalResults.some((r) => !r.success);
  if (anyFailed) {
    process.exit(1);
  }
}
