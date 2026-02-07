import { logStep, logInfo } from "../logger.js";
import { push } from "../git.js";
import type { PhaseContext, PhaseResult } from "../types.js";

export async function phasePush(ctx: PhaseContext): Promise<PhaseResult> {
  if (ctx.options.noPush) {
    logInfo("Skipping push (--no-push)");
    return { success: true, skipped: true };
  }

  logStep("Phase 3: Push");

  const ok = await push(ctx.sourceDir);

  if (ok) {
    logInfo("Pushed successfully");
    return { success: true };
  }

  throw new Error(`Push failed. Retry with: cd ${ctx.sourceDir} && git push`);
}
