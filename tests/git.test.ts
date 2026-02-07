import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeExecResult } from "./helpers.js";

// Mock exec module
vi.mock("../src/exec.js", () => ({
  exec: vi.fn(),
  execInteractive: vi.fn(),
}));

import { exec } from "../src/exec.js";
import {
  getCurrentBranch,
  createWorktree,
  worktreeExists,
  getWorktreePath,
  revParse,
  merge,
  getUnmergedFiles,
  abortMerge,
  push,
  removeWorktree,
} from "../src/git.js";

const mockExec = vi.mocked(exec);

describe("git", () => {
  beforeEach(() => {
    mockExec.mockReset();
  });

  describe("getCurrentBranch", () => {
    it("returns branch from --show-current", async () => {
      mockExec.mockResolvedValueOnce(
        makeExecResult({ stdout: "main\n" }),
      );
      expect(await getCurrentBranch("/cwd")).toBe("main");
      expect(mockExec).toHaveBeenCalledWith(
        "git",
        ["branch", "--show-current"],
        { cwd: "/cwd" },
      );
    });

    it("falls back to rev-parse if --show-current is empty", async () => {
      mockExec.mockResolvedValueOnce(makeExecResult({ stdout: "" }));
      mockExec.mockResolvedValueOnce(
        makeExecResult({ stdout: "develop\n" }),
      );
      expect(await getCurrentBranch("/cwd")).toBe("develop");
    });
  });

  describe("createWorktree", () => {
    it("calls git worktree add -b with branch", async () => {
      // First call: rev-parse --show-toplevel
      mockExec.mockResolvedValueOnce(
        makeExecResult({ stdout: "/repo\n" }),
      );
      // Second call: worktree add -b
      mockExec.mockResolvedValueOnce(makeExecResult());
      const ok = await createWorktree("feat/x", undefined, "/cwd");
      expect(ok).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        "git",
        ["worktree", "add", "-b", "feat/x", expect.stringContaining("feat-x")],
        { cwd: "/cwd" },
      );
    });

    it("includes fromRef when provided", async () => {
      mockExec.mockResolvedValueOnce(
        makeExecResult({ stdout: "/repo\n" }),
      );
      mockExec.mockResolvedValueOnce(makeExecResult());
      await createWorktree("feat/x", "v1.0", "/cwd");
      expect(mockExec).toHaveBeenCalledWith(
        "git",
        ["worktree", "add", "-b", "feat/x", expect.stringContaining("feat-x"), "v1.0"],
        { cwd: "/cwd" },
      );
    });

    it("falls back to add without -b if branch already exists", async () => {
      mockExec.mockResolvedValueOnce(
        makeExecResult({ stdout: "/repo\n" }),
      );
      // First attempt fails (branch exists)
      mockExec.mockResolvedValueOnce(makeExecResult({ exitCode: 1 }));
      // Fallback succeeds
      mockExec.mockResolvedValueOnce(makeExecResult());
      const ok = await createWorktree("feat/x", undefined, "/cwd");
      expect(ok).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        "git",
        ["worktree", "add", expect.stringContaining("feat-x"), "feat/x"],
        { cwd: "/cwd" },
      );
    });

    it("returns false on failure", async () => {
      mockExec.mockResolvedValueOnce(
        makeExecResult({ stdout: "/repo\n" }),
      );
      mockExec.mockResolvedValueOnce(makeExecResult({ exitCode: 1 }));
      mockExec.mockResolvedValueOnce(makeExecResult({ exitCode: 1 }));
      expect(await createWorktree("feat/x", undefined, "/cwd")).toBe(false);
    });
  });

  describe("worktreeExists", () => {
    it("returns true when branch is in worktree list", async () => {
      mockExec.mockResolvedValueOnce(
        makeExecResult({
          stdout:
            "worktree /repo\nHEAD abc123\nbranch refs/heads/main\n\nworktree /other\nHEAD def456\nbranch refs/heads/feat/x\n\n",
        }),
      );
      expect(await worktreeExists("feat/x", "/cwd")).toBe(true);
    });

    it("returns false when branch is not in worktree list", async () => {
      mockExec.mockResolvedValueOnce(
        makeExecResult({
          stdout:
            "worktree /repo\nHEAD abc123\nbranch refs/heads/main\n\n",
        }),
      );
      expect(await worktreeExists("feat/x", "/cwd")).toBe(false);
    });

    it("returns false on failure", async () => {
      mockExec.mockResolvedValueOnce(makeExecResult({ exitCode: 1 }));
      expect(await worktreeExists("feat/x", "/cwd")).toBe(false);
    });
  });

  describe("getWorktreePath", () => {
    it("returns worktree path for matching branch", async () => {
      mockExec.mockResolvedValueOnce(
        makeExecResult({
          stdout:
            "worktree /repo\nHEAD abc123\nbranch refs/heads/main\n\nworktree /path/to/worktree\nHEAD def456\nbranch refs/heads/feat/x\n\n",
        }),
      );
      expect(await getWorktreePath("feat/x", "/cwd")).toBe(
        "/path/to/worktree",
      );
    });

    it("returns empty string when branch not found", async () => {
      mockExec.mockResolvedValueOnce(
        makeExecResult({
          stdout:
            "worktree /repo\nHEAD abc123\nbranch refs/heads/main\n\n",
        }),
      );
      expect(await getWorktreePath("feat/x", "/cwd")).toBe("");
    });

    it("returns empty string on failure", async () => {
      mockExec.mockResolvedValueOnce(makeExecResult({ exitCode: 1 }));
      expect(await getWorktreePath("feat/x", "/cwd")).toBe("");
    });
  });

  describe("revParse", () => {
    it("returns trimmed hash", async () => {
      mockExec.mockResolvedValueOnce(
        makeExecResult({ stdout: "abc123\n" }),
      );
      expect(await revParse("HEAD", "/cwd")).toBe("abc123");
    });
  });

  describe("merge", () => {
    it("returns success on clean merge", async () => {
      mockExec.mockResolvedValueOnce(makeExecResult({ stdout: "ok" }));
      const result = await merge("feat/x", "/cwd");
      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        "git",
        ["merge", "feat/x", "--no-edit"],
        { cwd: "/cwd" },
      );
    });

    it("returns failure on conflict", async () => {
      mockExec.mockResolvedValueOnce(
        makeExecResult({ exitCode: 1, stderr: "conflict" }),
      );
      const result = await merge("feat/x", "/cwd");
      expect(result.success).toBe(false);
    });
  });

  describe("getUnmergedFiles", () => {
    it("returns list of files", async () => {
      mockExec.mockResolvedValueOnce(
        makeExecResult({ stdout: "a.ts\nb.ts\n" }),
      );
      expect(await getUnmergedFiles("/cwd")).toEqual(["a.ts", "b.ts"]);
    });

    it("returns empty array when no conflicts", async () => {
      mockExec.mockResolvedValueOnce(makeExecResult({ stdout: "" }));
      expect(await getUnmergedFiles("/cwd")).toEqual([]);
    });
  });

  describe("abortMerge", () => {
    it("calls git merge --abort", async () => {
      mockExec.mockResolvedValueOnce(makeExecResult());
      await abortMerge("/cwd");
      expect(mockExec).toHaveBeenCalledWith(
        "git",
        ["merge", "--abort"],
        { cwd: "/cwd" },
      );
    });
  });

  describe("push", () => {
    it("returns true on success", async () => {
      mockExec.mockResolvedValueOnce(makeExecResult());
      expect(await push("/cwd")).toBe(true);
    });

    it("returns false on failure", async () => {
      mockExec.mockResolvedValueOnce(makeExecResult({ exitCode: 1 }));
      expect(await push("/cwd")).toBe(false);
    });
  });

  describe("removeWorktree", () => {
    it("removes worktree and deletes branch", async () => {
      // rev-parse --show-toplevel
      mockExec.mockResolvedValueOnce(
        makeExecResult({ stdout: "/repo\n" }),
      );
      // worktree remove
      mockExec.mockResolvedValueOnce(makeExecResult());
      // branch -d
      mockExec.mockResolvedValueOnce(makeExecResult());
      const ok = await removeWorktree("feat/x", "/cwd");
      expect(ok).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        "git",
        ["worktree", "remove", expect.stringContaining("feat-x"), "--force"],
        { cwd: "/cwd" },
      );
      expect(mockExec).toHaveBeenCalledWith(
        "git",
        ["branch", "-d", "feat/x"],
        { cwd: "/cwd" },
      );
    });
  });
});
