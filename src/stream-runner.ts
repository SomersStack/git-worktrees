import { exec, execInteractive } from "./exec.js";
import { logStep, logInfo, logError } from "./logger.js";
import type { WorkStream, SplitOptions } from "./types.js";

export interface RunResult {
  stream: WorkStream;
  success: boolean;
  error?: string;
}

function buildGwtArgs(
  stream: WorkStream,
  options: SplitOptions,
): string[] {
  const args = [stream.branch, stream.prompt, "-p", "--work-only"];

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
    logError(`[FAIL] ${stream.id}: ${stream.title}`);
    if (result.stderr) {
      process.stderr.write(result.stderr.split("\n").slice(-5).join("\n") + "\n");
    }
    return {
      stream,
      success: false,
      error: `exited with code ${result.exitCode}`,
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
