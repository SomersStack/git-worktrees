import { logStep, logWarn, logInfo, promptYesNo } from "../logger.js";
import { findClaude, buildClaudeArgs, trustDirectory } from "../claude.js";
import {
  getCurrentBranch,
  createWorktree,
  worktreeExists,
  getWorktreePath,
  revParse,
  hasUncommittedChanges,
} from "../git.js";
import { execInteractive } from "../exec.js";
import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { GwtOptions, PhaseContext, PhaseResult } from "../types.js";

export async function phaseWork(options: GwtOptions): Promise<PhaseContext> {
  logStep("Phase 1: Work");

  const sourceDir = process.cwd();
  const sourceBranch = await getCurrentBranch(sourceDir);

  if (!sourceBranch || sourceBranch === "HEAD") {
    throw new Error("Cannot determine current branch (detached HEAD?)");
  }

  process.stderr.write(`Source branch: ${sourceBranch}\n`);

  // Create worktree via git gtr (or reuse if it exists)
  logStep(`Creating worktree for branch: ${options.branch}`);
  const created = await createWorktree(
    options.branch,
    options.fromRef || undefined,
    sourceDir,
  );

  if (!created) {
    const exists = await worktreeExists(options.branch, sourceDir);
    if (exists) {
      logWarn("Worktree already exists, reusing it");
    } else {
      throw new Error("Failed to create worktree");
    }
  }

  const worktreePath = await getWorktreePath(options.branch, sourceDir);

  if (!worktreePath) {
    throw new Error("Could not resolve worktree path");
  }

  process.stderr.write(`Worktree path: ${worktreePath}\n`);

  // Copy .claude settings so the worktree inherits trust/permissions
  const claudeSettingsDir = join(sourceDir, ".claude");
  if (existsSync(claudeSettingsDir)) {
    const dest = join(worktreePath, ".claude");
    await cp(claudeSettingsDir, dest, { recursive: true, force: true });
  }

  // Mark worktree directory as trusted so Claude skips the trust dialog
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

  // Build claude args and run
  const claudeArgs = buildClaudeArgs(options);

  logStep("Starting Claude in worktree...");
  const claudeExit = await execInteractive(claudeCmd, claudeArgs, {
    cwd: worktreePath,
  });

  if (claudeExit !== 0) {
    logWarn(`Claude exited with code ${claudeExit}`);
    if (!options.printMode) {
      const cont = await promptYesNo("Continue to merge?", "n");
      if (!cont) {
        throw new Error(`Aborted. Worktree preserved at: ${worktreePath}`);
      }
    }
  }

  // Check if there are actually any new commits to merge
  const sourceHead = await revParse("HEAD", sourceDir);
  const worktreeHead = await revParse("HEAD", worktreePath);

  const ctx: PhaseContext = {
    options,
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
    logWarn("No new commits on worktree branch \u2014 nothing to merge");
    if (!options.noCleanup) {
      const { phaseCleanup } = await import("./cleanup.js");
      await phaseCleanup(ctx);
    }
    throw new Error("Done (no changes)");
  }

  return ctx;
}
