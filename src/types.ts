export interface GwtOptions {
  branch: string;
  prompt: string;
  printMode: boolean;
  model: string;
  maxBudgetUsd: string;
  permissionMode: string;
  fromRef: string;
  noPush: boolean;
  noCleanup: boolean;
  workOnly: boolean;
  extraClaudeFlags: string[];
}

export interface SplitOptions {
  input: string;
  inputFile: string;
  interactive: boolean;
  model: string;
  maxBudgetUsd: string;
  permissionMode: string;
  fromRef: string;
  noPush: boolean;
  noCleanup: boolean;
  extraClaudeFlags: string[];
}

export interface WorkStream {
  id: string;
  title: string;
  prompt: string;
  branch: string;
}

export interface StreamResult {
  stream: WorkStream;
  success: boolean;
  skipped?: boolean;
  error?: string;
  reason?: string;
  merged: boolean;
  pushed: boolean;
  cleaned: boolean;
}

export interface RescueOptions {
  branch: string;
  printMode: boolean;
  model: string;
  maxBudgetUsd: string;
  permissionMode: string;
  noPush: boolean;
  noCleanup: boolean;
  workOnly: boolean;
  extraClaudeFlags: string[];
}

export interface PhaseContext {
  options: GwtOptions;
  sourceDir: string;
  sourceBranch: string;
  worktreePath: string;
}

export interface BeadsOptions {
  interactive: boolean;
  detach: boolean;
  groupingModel: string;
  model: string;
  maxBudgetUsd: string;
  permissionMode: string;
  fromRef: string;
  noPush: boolean;
  noCleanup: boolean;
  extraClaudeFlags: string[];
}

export interface PhaseResult {
  success: boolean;
  skipped?: boolean;
  message?: string;
}
