import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { accessSync, constants, readFileSync, writeFileSync } from "node:fs";
import { exec } from "./exec.js";
import type { GwtOptions } from "./types.js";

export async function findClaude(): Promise<string> {
  // Check common install path
  const localPath = join(homedir(), ".claude", "local", "claude");
  try {
    accessSync(localPath, constants.X_OK);
    return localPath;
  } catch {
    // not found, continue
  }

  // Fall back to PATH
  for (const cmd of ["claude", "claude-code"]) {
    const result = await exec("which", [cmd]);
    if (result.exitCode === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }
  }

  throw new Error(
    "Claude Code not found. Install from https://claude.com/claude-code",
  );
}

/**
 * Mark a directory as trusted in ~/.claude.json so Claude skips the trust
 * dialog on startup.
 */
export function trustDirectory(dir: string): void {
  const absDir = resolve(dir);
  const configPath = join(homedir(), ".claude.json");

  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    // file missing or invalid — start fresh
  }

  const projects = (config.projects ?? {}) as Record<string, unknown>;
  const existing = (projects[absDir] ?? {}) as Record<string, unknown>;

  if (existing.hasTrustDialogAccepted) return; // already trusted

  projects[absDir] = { ...existing, hasTrustDialogAccepted: true };
  config.projects = projects;

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

export function buildClaudeArgs(options: GwtOptions): string[] {
  const args: string[] = [];

  if (options.prompt) {
    if (options.printMode) {
      args.push("-p", options.prompt);
    } else {
      args.push(options.prompt);
    }
  }

  if (options.model) {
    args.push("--model", options.model);
  }
  if (options.maxBudgetUsd) {
    args.push("--max-budget-usd", options.maxBudgetUsd);
  }
  if (options.permissionMode) {
    args.push("--permission-mode", options.permissionMode);
  }

  args.push(...options.extraClaudeFlags);

  return args;
}
