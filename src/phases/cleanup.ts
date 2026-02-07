import { logStep, logInfo, logWarn } from "../logger.js";
import { removeWorktree } from "../git.js";
import type { PhaseContext, PhaseResult } from "../types.js";

export async function phaseCleanup(ctx: PhaseContext): Promise<PhaseResult> {
  if (ctx.options.noCleanup) {
    logInfo("Skipping cleanup (--no-cleanup)");
    return { success: true, skipped: true };
  }

  logStep("Phase 4: Cleanup");

  const ok = await removeWorktree(ctx.options.branch, ctx.sourceDir);

  if (ok) {
    logInfo("Worktree removed");
    return { success: true };
  }

  logWarn("Could not remove worktree (non-critical)");
  process.stderr.write(
    `  Remove manually: git worktree remove <path> && git branch -d ${ctx.options.branch}\n`,
  );
  return { success: false, message: "Worktree removal failed" };
}
