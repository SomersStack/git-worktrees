import { logStep, logInfo, logError } from "../logger.js";
import { worktreeExists, getWorktreePath, removeWorktree, forceDeleteBranch } from "../git.js";

const DELETE_USAGE = `gwt delete - Remove worktree(s) and their branches

Usage: gwt delete <branch> [branch2 ...] [options]

Options:
  --force    Force-delete unmerged branches (git branch -D)
  -h, --help Show this help`;

export interface DeleteOptions {
  branch: string;
  branches: string[];
  force: boolean;
}

export function parseDeleteArgs(argv: string[]): DeleteOptions | null {
  const branches: string[] = [];
  let force = false;

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    switch (arg) {
      case "-h":
      case "--help":
        console.log(DELETE_USAGE);
        process.exit(0);
        break;
      case "--force":
        force = true;
        i++;
        break;
      default:
        if (arg.startsWith("-")) {
          logError(`Unknown flag: ${arg}`);
          console.log(DELETE_USAGE);
          process.exit(1);
        }
        branches.push(arg);
        i++;
        break;
    }
  }

  if (branches.length === 0) {
    logError("Missing required argument: <branch>");
    console.log(DELETE_USAGE);
    return null;
  }

  return { branch: branches[0], branches, force };
}

async function deleteOneBranch(
  branch: string,
  cwd: string,
  force: boolean,
): Promise<void> {
  const exists = await worktreeExists(branch, cwd);
  if (!exists) {
    throw new Error(`Worktree for branch '${branch}' does not exist`);
  }

  const wtPath = await getWorktreePath(branch, cwd);
  logStep(`Removing worktree for branch: ${branch}`);

  const ok = await removeWorktree(branch, cwd);

  if (!ok) {
    throw new Error(
      `Failed to remove worktree. Try manually:\n  git worktree remove <path> --force && git branch -d ${branch}`,
    );
  }

  if (force) {
    await forceDeleteBranch(branch, cwd);
  }

  logInfo(`Worktree removed: ${wtPath || branch}`);
}

export async function deleteMain(argv: string[]): Promise<void> {
  const options = parseDeleteArgs(argv);
  if (!options) process.exit(1);

  const cwd = process.cwd();
  const errors: Array<{ branch: string; error: string }> = [];

  for (const branch of options.branches) {
    try {
      await deleteOneBranch(branch, cwd, options.force);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (options.branches.length === 1) {
        throw err;
      }
      logError(`Failed to delete ${branch}: ${msg}`);
      errors.push({ branch, error: msg });
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Failed to delete ${errors.length} branch(es): ${errors.map((e) => e.branch).join(", ")}`,
    );
  }
}
