import { exec } from "../exec.js";
import { logError } from "../logger.js";

export interface WorktreeStatus {
  branch: string;
  path: string;
  head: string;
  isGwt: boolean;
  isMain: boolean;
  hasChanges: boolean;
  claudeRunning: boolean;
  claudePid: number | null;
}

export interface StatusOutput {
  worktrees: WorktreeStatus[];
}

const STATUS_USAGE = `gwt status - Show worktree and session status

Usage: gwt status [options]

Options:
  --json       Output as JSON
  -h, --help   Show this help`;

export interface StatusOptions {
  json: boolean;
}

export function parseStatusArgs(argv: string[]): StatusOptions | null {
  let json = false;

  for (const arg of argv) {
    switch (arg) {
      case "--json":
        json = true;
        break;
      case "-h":
      case "--help":
        console.log(STATUS_USAGE);
        process.exit(0);
        break;
      default:
        if (arg.startsWith("-")) {
          logError(`Unknown flag: ${arg}`);
          console.log(STATUS_USAGE);
          process.exit(1);
        }
        break;
    }
  }

  return { json };
}

async function listWorktrees(
  cwd: string,
): Promise<
  Array<{
    path: string;
    branch: string;
    head: string;
    isMain: boolean;
  }>
> {
  const result = await exec("git", ["worktree", "list", "--porcelain"], {
    cwd,
  });
  if (result.exitCode !== 0) return [];

  const entries: Array<{
    path: string;
    branch: string;
    head: string;
    isMain: boolean;
  }> = [];
  const blocks = result.stdout.trim().split("\n\n");

  for (let idx = 0; idx < blocks.length; idx++) {
    const block = blocks[idx];
    if (!block.trim()) continue;

    let wtPath = "";
    let head = "";
    let branch = "";

    for (const line of block.split("\n")) {
      if (line.startsWith("worktree ")) wtPath = line.substring(9);
      else if (line.startsWith("HEAD ")) head = line.substring(5);
      else if (line.startsWith("branch ")) branch = line.substring(7);
    }

    if (wtPath) {
      entries.push({
        path: wtPath,
        branch: branch.replace("refs/heads/", ""),
        head,
        isMain: idx === 0,
      });
    }
  }

  return entries;
}

async function isClaudeRunning(
  worktreePath: string,
): Promise<{ running: boolean; pid: number | null }> {
  // Check for Claude processes whose cwd is this worktree
  const result = await exec("ps", ["aux"]);
  if (result.exitCode !== 0) return { running: false, pid: null };

  for (const line of result.stdout.split("\n")) {
    if (
      (line.includes("claude") || line.includes("claude-code")) &&
      !line.includes("gwt status") &&
      !line.includes("grep")
    ) {
      // Try to check if this Claude process is associated with the worktree
      // by checking for the worktree path in lsof or /proc
      const pidMatch = line.match(/^\S+\s+(\d+)/);
      if (pidMatch) {
        const pid = parseInt(pidMatch[1], 10);
        const cwdCheck = await exec("lsof", [
          "-p",
          String(pid),
          "-Fn",
          "-d",
          "cwd",
        ]);
        if (
          cwdCheck.exitCode === 0 &&
          cwdCheck.stdout.includes(worktreePath)
        ) {
          return { running: true, pid };
        }
      }
    }
  }

  return { running: false, pid: null };
}

async function hasChanges(worktreePath: string): Promise<boolean> {
  const result = await exec("git", ["status", "--porcelain"], {
    cwd: worktreePath,
  });
  return result.exitCode === 0 && result.stdout.trim().length > 0;
}

export async function statusMain(argv: string[]): Promise<void> {
  const options = parseStatusArgs(argv);
  if (!options) process.exit(1);

  const cwd = process.cwd();
  const worktrees = await listWorktrees(cwd);
  const statuses: WorktreeStatus[] = [];

  for (const wt of worktrees) {
    const isGwt = wt.branch.startsWith("gwt/");
    const claude = await isClaudeRunning(wt.path);
    const changed = wt.isMain ? false : await hasChanges(wt.path);

    statuses.push({
      branch: wt.branch,
      path: wt.path,
      head: wt.head,
      isGwt,
      isMain: wt.isMain,
      hasChanges: changed,
      claudeRunning: claude.running,
      claudePid: claude.pid,
    });
  }

  const output: StatusOutput = { worktrees: statuses };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    if (statuses.length === 0) {
      process.stderr.write("No worktrees found.\n");
      return;
    }

    for (const s of statuses) {
      const flags: string[] = [];
      if (s.isMain) flags.push("main");
      if (s.isGwt) flags.push("gwt");
      if (s.claudeRunning) flags.push(`claude:running(pid:${s.claudePid})`);
      if (s.hasChanges) flags.push("changes");

      const tag = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
      process.stderr.write(`  ${s.branch}${tag}\n`);
      process.stderr.write(`    ${s.path}\n`);
    }
  }
}
