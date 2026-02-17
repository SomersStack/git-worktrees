import { spawn } from "node:child_process";
import { exec, execInteractive } from "./exec.js";
import { logStep, logInfo, logError, logWarn } from "./logger.js";
import type { WorkStream, SplitOptions } from "./types.js";

export interface RunResult {
  stream: WorkStream;
  success: boolean;
  skipped?: boolean;
  error?: string;
  reason?: string;
}

const NO_CHANGES_PATTERNS = [
  /No new commits/i,
  /Done \(no changes\)/i,
];

function isNoChangesError(stderr: string): boolean {
  const tail = stderr.split("\n").slice(-10).join("\n");
  return NO_CHANGES_PATTERNS.some((p) => p.test(tail));
}

function extractReason(stderr: string): string | undefined {
  const lines = stderr.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return undefined;
  // Return last meaningful line, stripped of ANSI and log prefixes
  const last = lines[lines.length - 1]
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/^\[.*?\]\s*/, "")
    .trim();
  return last || undefined;
}

function buildGwtArgs(
  stream: WorkStream,
  options: SplitOptions,
): string[] {
  const args = [stream.branch, stream.prompt, "-p", "--work-only", "--no-cleanup"];

  if (options.model) {
    args.push("--model", options.model);
  }
  if (options.maxBudgetUsd) {
    args.push("--max-budget-usd", options.maxBudgetUsd);
  }
  if (options.permissionMode) {
    args.push("--permission-mode", options.permissionMode);
  }
  if (options.fromRef) {
    args.push("--from", options.fromRef);
  }

  if (options.extraClaudeFlags.length > 0) {
    args.push("--", ...options.extraClaudeFlags);
  }

  return args;
}

export async function runSingleStream(
  stream: WorkStream,
  options: SplitOptions,
  gwtBin: string,
): Promise<RunResult> {
  const args = buildGwtArgs(stream, options);

  if (options.interactive) {
    logStep(`[START] ${stream.id}: ${stream.title}`);
    const exitCode = await execInteractive(gwtBin, args);
    if (exitCode !== 0) {
      return { stream, success: false, error: `exited with code ${exitCode}` };
    }
    return { stream, success: true };
  }

  logStep(`[START] ${stream.id}: ${stream.title}`);
  const result = await exec(gwtBin, args);

  if (result.exitCode !== 0) {
    if (isNoChangesError(result.stderr)) {
      const reason = extractReason(result.stderr) || "no changes";
      logWarn(`[SKIP] ${stream.id}: ${stream.title} — ${reason}`);
      return { stream, success: true, skipped: true, reason };
    }

    const reason = extractReason(result.stderr);
    logError(`[FAIL] ${stream.id}: ${stream.title}`);
    if (result.stderr) {
      process.stderr.write(result.stderr.split("\n").slice(-5).join("\n") + "\n");
    }
    return {
      stream,
      success: false,
      error: `exited with code ${result.exitCode}`,
      reason,
    };
  }

  logInfo(`[DONE] ${stream.id}: ${stream.title}`);
  return { stream, success: true };
}

export async function runStreamsParallel(
  streams: WorkStream[],
  options: SplitOptions,
  gwtBin: string,
): Promise<RunResult[]> {
  logStep(`Running ${streams.length} streams in parallel...`);

  const results = await Promise.allSettled(
    streams.map((stream) => runSingleStream(stream, options, gwtBin)),
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") {
      return r.value;
    }
    return {
      stream: streams[i],
      success: false,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });
}

export async function runStreamsSequential(
  streams: WorkStream[],
  options: SplitOptions,
  gwtBin: string,
): Promise<RunResult[]> {
  logStep(`Running ${streams.length} streams sequentially (interactive)...`);

  const results: RunResult[] = [];
  for (const stream of streams) {
    const result = await runSingleStream(stream, options, gwtBin);
    results.push(result);
  }
  return results;
}

export function runStreamsDetached(
  streams: WorkStream[],
  options: SplitOptions,
  gwtBin: string,
): string[] {
  const branches: string[] = [];

  for (const stream of streams) {
    const args = buildGwtArgs(stream, options);
    logStep(`[DETACH] ${stream.id}: ${stream.title} → ${stream.branch}`);

    const child = spawn(gwtBin, args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    branches.push(stream.branch);
  }

  return branches;
}
