import { logStep, logWarn, logError, logInfo, promptYesNo } from "../logger.js";
import { findClaude, buildClaudeArgs, trustDirectory } from "../claude.js";
import {
  worktreeExists,
  getWorktreePath,
  getCurrentBranch,
  revParse,
  hasUncommittedChanges,
} from "../git.js";
import { execInteractive } from "../exec.js";
import { phaseMerge, phasePush, phaseCleanup } from "../phases/index.js";
import { printSummary } from "../summary.js";
import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RescueOptions, GwtOptions, PhaseContext } from "../types.js";

const RESCUE_USAGE = `gwt rescue - Resume a Claude session in an orphaned worktree

Usage: gwt rescue <branch> [options]
       gwt rescue <branch> [options] [-- <extra-claude-flags>...]

Options:
  -p, --print              Non-interactive mode (claude -p)
  --model <model>          Claude model override
  --max-budget-usd <n>     Cost limit for Claude
  --permission-mode <m>    Permission mode for Claude
  --no-push                Skip push after merge
  --no-cleanup             Keep worktree after merge
  --work-only              Run work phase only (skip merge/push/cleanup)
  -h, --help               Show this help
  --                       Pass remaining flags to claude verbatim`;

export function parseRescueArgs(argv: string[]): RescueOptions | null {
  let branch = "";
  let printMode = false;
  let model = "";
  let maxBudgetUsd = "";
  let permissionMode = "";
  let noPush = false;
  let noCleanup = false;
  let workOnly = false;
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
        console.log(RESCUE_USAGE);
        process.exit(0);
        break;
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
      default:
        if (arg.startsWith("-")) {
          logError(`Unknown flag: ${arg}`);
          console.log(RESCUE_USAGE);
          process.exit(1);
        }
        if (!branch) {
          branch = arg;
        } else {
          logError(`Unexpected argument: ${arg}`);
          console.log(RESCUE_USAGE);
          process.exit(1);
        }
        i++;
        break;
    }
  }

  if (!branch) {
    logError("Missing required argument: <branch>");
    console.log(RESCUE_USAGE);
    return null;
  }

  return {
    branch,
    printMode,
    model,
    maxBudgetUsd,
    permissionMode,
    noPush,
    noCleanup,
    workOnly,
    extraClaudeFlags,
  };
}

export async function rescueMain(argv: string[]): Promise<void> {
  const options = parseRescueArgs(argv);
  if (!options) process.exit(1);

  const sourceDir = process.cwd();
  const sourceBranch = await getCurrentBranch(sourceDir);

  if (!sourceBranch || sourceBranch === "HEAD") {
    throw new Error("Cannot determine current branch (detached HEAD?)");
  }

  const exists = await worktreeExists(options.branch, sourceDir);
  if (!exists) {
    throw new Error(`Worktree for branch '${options.branch}' does not exist`);
  }

  const worktreePath = await getWorktreePath(options.branch, sourceDir);
  if (!worktreePath) {
    throw new Error("Could not resolve worktree path");
  }

  logStep(`Rescuing worktree: ${options.branch}`);
  process.stderr.write(`Source branch: ${sourceBranch}\n`);
  process.stderr.write(`Worktree path: ${worktreePath}\n`);

  // Copy .claude settings so the worktree inherits trust/permissions
  const claudeSettingsDir = join(sourceDir, ".claude");
  if (existsSync(claudeSettingsDir)) {
    const dest = join(worktreePath, ".claude");
    await cp(claudeSettingsDir, dest, { recursive: true, force: true });
  }

  trustDirectory(worktreePath);

  // Find claude
  let claudeCmd: string;
  try {
    claudeCmd = await findClaude();
  } catch {
    throw new Error(
      "Claude Code not found. Install from https://claude.com/claude-code",
    );
  }

  // Build args — try --resume first
  const gwtOptions: GwtOptions = {
    branch: options.branch,
    prompt: "",
    printMode: options.printMode,
    model: options.model,
    maxBudgetUsd: options.maxBudgetUsd,
    permissionMode: options.permissionMode,
    fromRef: "",
    noPush: options.noPush,
    noCleanup: options.noCleanup,
    workOnly: options.workOnly,
    extraClaudeFlags: options.extraClaudeFlags,
  };

  const baseArgs = buildClaudeArgs(gwtOptions);

  // Attempt --resume
  logStep("Starting Claude with --resume...");
  const resumeArgs = ["--resume", ...baseArgs];
  let claudeExit = await execInteractive(claudeCmd, resumeArgs, {
    cwd: worktreePath,
  });

  if (claudeExit !== 0) {
    logWarn(`Claude --resume exited with code ${claudeExit}`);
    if (!options.printMode) {
      const retry = await promptYesNo(
        "Retry with a fresh Claude session?",
        "y",
      );
      if (retry) {
        logStep("Starting fresh Claude session...");
        claudeExit = await execInteractive(claudeCmd, baseArgs, {
          cwd: worktreePath,
        });
      }
    }
  }

  if (claudeExit !== 0) {
    logWarn(`Claude exited with code ${claudeExit}`);
    if (!options.printMode) {
      const cont = await promptYesNo("Continue to merge?", "n");
      if (!cont) {
        throw new Error(`Aborted. Worktree preserved at: ${worktreePath}`);
      }
    }
  }

  // Check for new commits
  const sourceHead = await revParse("HEAD", sourceDir);
  const worktreeHead = await revParse("HEAD", worktreePath);

  const ctx: PhaseContext = {
    options: gwtOptions,
    sourceDir,
    sourceBranch,
    worktreePath,
  };

  if (sourceHead === worktreeHead) {
    const dirty = await hasUncommittedChanges(worktreePath);
    if (dirty) {
      logWarn(
        "No new commits, but worktree has uncommitted changes. Preserving worktree.",
      );
      throw new Error(`Worktree preserved at: ${worktreePath}`);
    }
    logWarn("No new commits on worktree branch — nothing to merge");
    if (!options.noCleanup) {
      await phaseCleanup(ctx);
    }
    throw new Error("Done (no changes)");
  }

  if (!options.workOnly) {
    await phaseMerge(ctx);
    await phasePush(ctx);
    await phaseCleanup(ctx);
    printSummary(options.branch, sourceBranch, gwtOptions);
  }
}
