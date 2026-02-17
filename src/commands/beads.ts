import { logStep, logInfo, logError, logWarn } from "../logger.js";
import { fetchReadyBeads, groupBeads } from "../bead-grouper.js";
import {
  runStreamsParallel,
  runStreamsSequential,
  runStreamsDetached,
  type RunResult,
} from "../stream-runner.js";
import { phaseMerge, phasePush, phaseCleanup } from "../phases/index.js";
import { getCurrentBranch, getWorktreePath } from "../git.js";
import type { BeadsOptions, SplitOptions, StreamResult } from "../types.js";

const BEADS_USAGE = `gwt beads - Split open beads into parallel agent sessions

Usage: gwt beads [options]

Reads all ready beads (via \`bd ready\`), groups them into small clusters
using Claude, and spawns a parallel gwt session per group.

Options:
  --grouping-model <model>   Model for grouping step (default: sonnet)
  --interactive              Run streams sequentially (interactive Claude)
  --detach                   Spawn worktrees and exit immediately
  --model <model>            Claude model override for each work stream
  --max-budget-usd <n>       Cost limit per stream
  --permission-mode <m>      Permission mode for Claude
  --from <ref>               Base ref for worktrees
  --no-push                  Skip push after merge
  --no-cleanup               Keep worktrees after merge
  -h, --help                 Show this help
  --                         Pass remaining flags to claude verbatim

Examples:
  gwt beads
  gwt beads --max-budget-usd 5
  gwt beads --grouping-model opus --model sonnet
  gwt beads --interactive
  gwt beads --detach`;

export function parseBeadsArgs(argv: string[]): BeadsOptions | null {
  let interactive = false;
  let detach = false;
  let groupingModel = "";
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
        console.log(BEADS_USAGE);
        process.exit(0);
        break;
      case "--grouping-model":
        groupingModel = argv[++i] ?? "";
        i++;
        break;
      case "--interactive":
        interactive = true;
        i++;
        break;
      case "--detach":
        detach = true;
        i++;
        break;
      case "-p":
      case "--print":
        // print mode is default for beads, accept but ignore
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
          console.log(BEADS_USAGE);
          process.exit(1);
        }
        logError(`Unexpected argument: ${arg}`);
        console.log(BEADS_USAGE);
        process.exit(1);
        break;
    }
  }

  return {
    interactive,
    detach,
    groupingModel,
    model,
    maxBudgetUsd,
    permissionMode,
    fromRef,
    noPush,
    noCleanup,
    extraClaudeFlags,
  };
}

const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function printBeadsSummary(results: StreamResult[]): void {
  process.stderr.write("\n");
  process.stderr.write(
    "═══════════════════════════════════════════════\n",
  );
  process.stderr.write(`${BOLD}gwt beads summary${RESET}\n`);
  process.stderr.write(
    "───────────────────────────────────────────────\n",
  );

  for (const r of results) {
    const status = r.skipped
      ? `${YELLOW}SKIP${RESET}`
      : r.success
        ? `${GREEN}OK${RESET}  `
        : `${RED}FAIL${RESET}`;
    const merge = r.merged
      ? "merged"
      : r.success && !r.skipped
        ? `${YELLOW}not merged${RESET}`
        : "—";
    const push = r.pushed
      ? "pushed"
      : r.success && !r.skipped
        ? `${YELLOW}not pushed${RESET}`
        : "—";
    const clean = r.cleaned ? "cleaned" : "kept";

    process.stderr.write(
      `  ${status}  ${r.stream.id}: ${r.stream.title}\n`,
    );
    if (!r.skipped) {
      process.stderr.write(
        `       merge: ${merge}  push: ${push}  cleanup: ${clean}\n`,
      );
    }
    if (r.reason) {
      process.stderr.write(`       reason: ${r.reason}\n`);
    }
    if (r.error) {
      process.stderr.write(`       error: ${r.error}\n`);
    }
  }

  process.stderr.write(
    "═══════════════════════════════════════════════\n",
  );

  const succeeded = results.filter((r) => r.success && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.success).length;
  const parts: string[] = [];
  parts.push(`${succeeded} succeeded`);
  if (skipped > 0) parts.push(`${skipped} skipped`);
  parts.push(`${failed} failed`);
  process.stderr.write(`${BOLD}${parts.join(", ")}${RESET}\n`);
}

function toSplitOptions(opts: BeadsOptions): SplitOptions {
  return {
    input: "",
    inputFile: "",
    interactive: opts.interactive,
    model: opts.model,
    maxBudgetUsd: opts.maxBudgetUsd,
    permissionMode: opts.permissionMode,
    fromRef: opts.fromRef,
    noPush: opts.noPush,
    noCleanup: opts.noCleanup,
    extraClaudeFlags: opts.extraClaudeFlags,
  };
}

export async function beadsMain(argv: string[]): Promise<void> {
  const options = parseBeadsArgs(argv);
  if (!options) process.exit(1);

  const gwtBin = process.argv[1];
  const sourceDir = process.cwd();
  const sourceBranch = await getCurrentBranch(sourceDir);

  // Step 1: Fetch ready beads
  let beadsText: string;
  try {
    beadsText = await fetchReadyBeads();
  } catch (err) {
    logError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  logInfo(`Fetched beads:\n${beadsText}\n`);

  // Step 2: Group beads into work streams
  let streams;
  try {
    streams = await groupBeads(
      beadsText,
      options.groupingModel || undefined,
    );
  } catch (err) {
    logError(
      `Grouping failed: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }

  logStep(`Grouped into ${streams.length} work stream(s):`);
  for (const s of streams) {
    process.stderr.write(`  • ${s.id}: ${s.title}\n`);
    process.stderr.write(`    branch: ${s.branch}\n`);
  }
  process.stderr.write("\n");

  // Step 3: Run streams
  const splitOpts = toSplitOptions(options);

  if (options.detach) {
    const branches = runStreamsDetached(streams, splitOpts, gwtBin);
    logStep(`Detached ${branches.length} stream(s). Use these to check on them:`);
    for (const b of branches) {
      process.stderr.write(`  gwt rescue ${b}\n`);
    }
    return;
  }

  let runResults: RunResult[];
  if (options.interactive) {
    runResults = await runStreamsSequential(streams, splitOpts, gwtBin);
  } else {
    runResults = await runStreamsParallel(streams, splitOpts, gwtBin);
  }

  // Step 4: Post-process each successful stream (merge, push, cleanup)
  const finalResults: StreamResult[] = [];

  for (const rr of runResults) {
    const result: StreamResult = {
      stream: rr.stream,
      success: rr.success,
      skipped: rr.skipped,
      error: rr.error,
      reason: rr.reason,
      merged: false,
      pushed: false,
      cleaned: false,
    };

    if (!rr.success || rr.skipped) {
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

  // Step 5: Summary
  printBeadsSummary(finalResults);

  const anyFailed = finalResults.some((r) => !r.success && !r.skipped);
  if (anyFailed) {
    process.exit(1);
  }
}
