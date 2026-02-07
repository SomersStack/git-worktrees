import { logStep, logError } from "../logger.js";
import { worktreeExists, getWorktreePath, getCurrentBranch } from "../git.js";
import { phaseMerge, phasePush, phaseCleanup } from "../phases/index.js";
import { printSummary } from "../summary.js";
import type { GwtOptions, PhaseContext } from "../types.js";

const MERGE_USAGE = `gwt merge - Merge worktree branch(es) into the current branch

Usage: gwt merge <branch> [branch2 ...] [options]

Options:
  --no-push    Skip push after merge
  --no-cleanup Keep worktree after merge
  -h, --help   Show this help`;

export interface MergeOptions {
  branch: string;
  branches: string[];
  noPush: boolean;
  noCleanup: boolean;
}

export function parseMergeArgs(argv: string[]): MergeOptions | null {
  const branches: string[] = [];
  let noPush = false;
  let noCleanup = false;

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    switch (arg) {
      case "-h":
      case "--help":
        console.log(MERGE_USAGE);
        process.exit(0);
        break;
      case "--no-push":
        noPush = true;
        i++;
        break;
      case "--no-cleanup":
        noCleanup = true;
        i++;
        break;
      default:
        if (arg.startsWith("-")) {
          logError(`Unknown flag: ${arg}`);
          console.log(MERGE_USAGE);
          process.exit(1);
        }
        branches.push(arg);
        i++;
        break;
    }
  }

  if (branches.length === 0) {
    logError("Missing required argument: <branch>");
    console.log(MERGE_USAGE);
    return null;
  }

  return { branch: branches[0], branches, noPush, noCleanup };
}

async function mergeOneBranch(
  branch: string,
  cwd: string,
  sourceBranch: string,
  noPush: boolean,
  noCleanup: boolean,
): Promise<void> {
  const exists = await worktreeExists(branch, cwd);
  if (!exists) {
    throw new Error(`Worktree for branch '${branch}' does not exist`);
  }

  const worktreePath = await getWorktreePath(branch, cwd);
  if (!worktreePath) {
    throw new Error(`Could not resolve worktree path for '${branch}'`);
  }

  const gwtOptions: GwtOptions = {
    branch,
    prompt: "",
    printMode: false,
    model: "",
    maxBudgetUsd: "",
    permissionMode: "",
    fromRef: "",
    noPush,
    noCleanup,
    workOnly: false,
    extraClaudeFlags: [],
  };

  const ctx: PhaseContext = {
    options: gwtOptions,
    sourceDir: cwd,
    sourceBranch,
    worktreePath,
  };

  logStep(`Merging ${branch} into ${sourceBranch}`);

  await phaseMerge(ctx);
  await phasePush(ctx);
  await phaseCleanup(ctx);
  printSummary(branch, sourceBranch, gwtOptions);
}

export async function mergeMain(argv: string[]): Promise<void> {
  const options = parseMergeArgs(argv);
  if (!options) process.exit(1);

  const cwd = process.cwd();

  const sourceBranch = await getCurrentBranch(cwd);
  if (!sourceBranch || sourceBranch === "HEAD") {
    throw new Error("Cannot determine current branch (detached HEAD?)");
  }

  const errors: Array<{ branch: string; error: string }> = [];

  for (const branch of options.branches) {
    try {
      await mergeOneBranch(
        branch,
        cwd,
        sourceBranch,
        options.noPush,
        options.noCleanup,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (options.branches.length === 1) {
        throw err;
      }
      logError(`Failed to merge ${branch}: ${msg}`);
      errors.push({ branch, error: msg });
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Failed to merge ${errors.length} branch(es): ${errors.map((e) => e.branch).join(", ")}`,
    );
  }
}
