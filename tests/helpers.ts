import type { GwtOptions, PhaseContext } from "../src/types.js";
import type { ExecResult } from "../src/exec.js";

export function makeOptions(overrides?: Partial<GwtOptions>): GwtOptions {
  return {
    branch: "feat/test",
    prompt: "Do something",
    printMode: false,
    model: "",
    maxBudgetUsd: "",
    permissionMode: "",
    fromRef: "",
    noPush: false,
    noCleanup: false,
    workOnly: false,
    extraClaudeFlags: [],
    ...overrides,
  };
}

export function makeContext(overrides?: Partial<PhaseContext>): PhaseContext {
  return {
    options: makeOptions(),
    sourceDir: "/fake/source",
    sourceBranch: "main",
    worktreePath: "/fake/worktree",
    ...overrides,
  };
}

export function makeExecResult(overrides?: Partial<ExecResult>): ExecResult {
  return {
    stdout: "",
    stderr: "",
    exitCode: 0,
    ...overrides,
  };
}
