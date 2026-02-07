import {
  logStep,
  logWarn,
  logError,
  logInfo,
} from "../logger.js";
import { findClaude } from "../claude.js";
import { merge, getUnmergedFiles, abortMerge } from "../git.js";
import { execInteractive } from "../exec.js";
import type { PhaseContext, PhaseResult } from "../types.js";

export async function phaseMerge(ctx: PhaseContext): Promise<PhaseResult> {
  logStep("Phase 2: Merge");

  process.stderr.write(
    `Merging ${ctx.options.branch} into ${ctx.sourceBranch}...\n`,
  );

  const mergeResult = await merge(ctx.options.branch, ctx.sourceDir);

  if (mergeResult.success) {
    logInfo("Merge successful");
    return { success: true };
  }

  logWarn("Merge failed");
  if (mergeResult.output.trim()) {
    process.stderr.write(mergeResult.output.trim() + "\n");
  }

  const unmerged = await getUnmergedFiles(ctx.sourceDir);

  if (unmerged.length === 0) {
    logError("No unmerged files detected. Aborting merge.");
    await abortMerge(ctx.sourceDir);
    throw new Error(`Merge failed (no conflict markers found). Worktree preserved at: ${ctx.worktreePath}`);
  }

  logWarn("Merge conflicts detected");

  process.stderr.write("Unmerged files:\n");
  for (const f of unmerged) {
    process.stderr.write(`${f}\n`);
  }

  // Start interactive Claude session for conflict resolution
  let claudeCmd: string;
  try {
    claudeCmd = await findClaude();
  } catch {
    throw new Error("Claude Code not found for conflict resolution");
  }

  const conflictPrompt = `There are git merge conflicts that need resolving. The following files have conflicts:

${unmerged.join("\n")}

Please resolve all merge conflicts in these files. For each file:
1. Open the file and find the conflict markers (<<<<<<< ======= >>>>>>>)
2. Resolve each conflict by choosing the correct code or combining changes
3. Remove all conflict markers
4. Stage the resolved files with git add

After resolving all conflicts, run 'git commit --no-edit' to complete the merge.`;

  logStep("Starting Claude to resolve conflicts (interactive)...");
  await execInteractive(claudeCmd, [conflictPrompt], {
    cwd: ctx.sourceDir,
  });

  // Check if conflicts are resolved
  const remaining = await getUnmergedFiles(ctx.sourceDir);

  if (remaining.length > 0) {
    logError("Unresolved conflicts remain:");
    for (const f of remaining) {
      process.stderr.write(`${f}\n`);
    }
    throw new Error(
      `Unresolved conflicts remain. Resolve manually:\n  cd ${ctx.sourceDir}\n  git add <resolved-files>\n  git commit\nWorktree preserved at: ${ctx.worktreePath}`,
    );
  }

  logInfo("Conflicts resolved and merge completed");
  return { success: true };
}
