import { exec } from "./exec.js";
import * as path from "node:path";

export async function getCurrentBranch(cwd: string): Promise<string> {
  const result = await exec("git", ["branch", "--show-current"], { cwd });
  const branch = result.stdout.trim();
  if (branch) return branch;

  // Fallback
  const result2 = await exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd,
  });
  return result2.stdout.trim();
}

function sanitizeBranch(branch: string): string {
  return branch.replace(/\//g, "-");
}

async function getWorktreeDir(
  branch: string,
  cwd?: string,
): Promise<string> {
  const result = await exec("git", ["rev-parse", "--show-toplevel"], { cwd });
  if (result.exitCode !== 0) {
    const msg = result.stderr.trim() || "not a git repository";
    throw new Error(`Failed to find git root: ${msg}`);
  }
  const repoRoot = result.stdout.trim();
  return path.resolve(repoRoot, "..", sanitizeBranch(branch));
}

export async function createWorktree(
  branch: string,
  fromRef?: string,
  cwd?: string,
): Promise<{ created: boolean; error: string }> {
  const wtPath = await getWorktreeDir(branch, cwd);

  // Try creating a new branch
  const args = fromRef
    ? ["worktree", "add", "-b", branch, wtPath, fromRef]
    : ["worktree", "add", "-b", branch, wtPath];

  const result = await exec("git", args, { cwd });
  if (result.exitCode === 0) return { created: true, error: "" };

  // Branch may already exist — try attaching without -b
  const fallback = await exec(
    "git",
    ["worktree", "add", wtPath, branch],
    { cwd },
  );
  if (fallback.exitCode === 0) return { created: true, error: "" };

  // Both attempts failed — return the most relevant error
  const error = fallback.stderr.trim() || result.stderr.trim() || "unknown error";
  return { created: false, error };
}

export async function worktreeExists(
  branch: string,
  cwd?: string,
): Promise<boolean> {
  const result = await exec("git", ["worktree", "list", "--porcelain"], {
    cwd,
  });
  if (result.exitCode !== 0) return false;
  return result.stdout.includes(`branch refs/heads/${branch}\n`);
}

export async function getWorktreePath(
  branch: string,
  cwd?: string,
): Promise<string> {
  const result = await exec("git", ["worktree", "list", "--porcelain"], {
    cwd,
  });
  if (result.exitCode !== 0) return "";

  const entries = result.stdout.split("\n\n");
  for (const entry of entries) {
    if (entry.includes(`branch refs/heads/${branch}`)) {
      const match = entry.match(/^worktree (.+)$/m);
      if (match) return match[1];
    }
  }
  return "";
}

export async function revParse(ref: string, cwd: string): Promise<string> {
  const result = await exec("git", ["rev-parse", ref], { cwd });
  return result.stdout.trim();
}

export async function merge(
  branch: string,
  cwd: string,
): Promise<{ success: boolean; output: string }> {
  const result = await exec(
    "git",
    ["merge", branch, "--no-edit", "--autostash"],
    { cwd },
  );
  return {
    success: result.exitCode === 0,
    output: result.stdout + result.stderr,
  };
}

export async function getUnmergedFiles(cwd: string): Promise<string[]> {
  // Use git ls-files -u which reliably lists unmerged (conflicted) files
  const result = await exec("git", ["ls-files", "-u"], {
    cwd,
  });
  if (!result.stdout.trim()) return [];
  // ls-files -u output: "<mode> <hash> <stage>\t<path>" — extract unique paths
  const paths = new Set<string>();
  for (const line of result.stdout.trim().split("\n")) {
    const tab = line.indexOf("\t");
    if (tab !== -1) {
      paths.add(line.slice(tab + 1));
    }
  }
  return [...paths];
}

export async function abortMerge(cwd: string): Promise<void> {
  await exec("git", ["merge", "--abort"], { cwd });
}

export async function push(cwd: string): Promise<boolean> {
  const result = await exec("git", ["push"], { cwd });
  return result.exitCode === 0;
}

export async function hasUncommittedChanges(cwd: string): Promise<boolean> {
  const result = await exec("git", ["status", "--porcelain"], { cwd });
  return result.stdout.trim().length > 0;
}

export async function forceDeleteBranch(
  branch: string,
  cwd: string,
): Promise<boolean> {
  const result = await exec("git", ["branch", "-D", branch], { cwd });
  return result.exitCode === 0;
}

export async function removeWorktree(
  branch: string,
  cwd: string,
): Promise<boolean> {
  const wtPath = await getWorktreeDir(branch, cwd);
  const result = await exec(
    "git",
    ["worktree", "remove", wtPath, "--force"],
    { cwd },
  );
  if (result.exitCode === 0) {
    // Best-effort delete the branch
    await exec("git", ["branch", "-d", branch], { cwd });
  } else if (result.stderr.trim()) {
    process.stderr.write(`Warning: worktree remove failed: ${result.stderr.trim()}\n`);
  }
  return result.exitCode === 0;
}
