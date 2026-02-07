import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeOptions } from "../helpers.js";

// Mock all dependencies
vi.mock("../../src/exec.js", () => ({
  exec: vi.fn(),
  execInteractive: vi.fn(),
}));

vi.mock("../../src/claude.js", () => ({
  findClaude: vi.fn(),
  buildClaudeArgs: vi.fn(),
  trustDirectory: vi.fn(),
}));

vi.mock("../../src/git.js", () => ({
  getCurrentBranch: vi.fn(),
  createWorktree: vi.fn(),
  worktreeExists: vi.fn(),
  getWorktreePath: vi.fn(),
  revParse: vi.fn(),
  removeWorktree: vi.fn(),
}));

vi.mock("../../src/logger.js", () => ({
  logStep: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  promptYesNo: vi.fn(),
}));

import { execInteractive } from "../../src/exec.js";
import { findClaude, buildClaudeArgs } from "../../src/claude.js";
import {
  getCurrentBranch,
  createWorktree,
  worktreeExists,
  getWorktreePath,
  revParse,
  removeWorktree,
} from "../../src/git.js";
import { promptYesNo } from "../../src/logger.js";
import { phaseWork } from "../../src/phases/work.js";

const mockGetCurrentBranch = vi.mocked(getCurrentBranch);
const mockCreateWorktree = vi.mocked(createWorktree);
const mockWorktreeExists = vi.mocked(worktreeExists);
const mockGetWorktreePath = vi.mocked(getWorktreePath);
const mockFindClaude = vi.mocked(findClaude);
const mockBuildClaudeArgs = vi.mocked(buildClaudeArgs);
const mockExecInteractive = vi.mocked(execInteractive);
const mockRevParse = vi.mocked(revParse);
const mockPromptYesNo = vi.mocked(promptYesNo);
const mockRemoveWorktree = vi.mocked(removeWorktree);
vi.spyOn(process.stderr, "write").mockReturnValue(true);

function setupNormalFlow() {
  mockGetCurrentBranch.mockResolvedValue("main");
  mockCreateWorktree.mockResolvedValue(true);
  mockGetWorktreePath.mockResolvedValue("/worktree/feat-test");
  mockFindClaude.mockResolvedValue("/usr/bin/claude");
  mockBuildClaudeArgs.mockReturnValue(["Do something"]);
  mockExecInteractive.mockResolvedValue(0);
  mockRevParse
    .mockResolvedValueOnce("aaa111") // source HEAD
    .mockResolvedValueOnce("bbb222"); // worktree HEAD
}

describe("phaseWork", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns context on normal flow", async () => {
    setupNormalFlow();
    const opts = makeOptions();
    const ctx = await phaseWork(opts);
    expect(ctx.sourceBranch).toBe("main");
    expect(ctx.worktreePath).toBe("/worktree/feat-test");
    expect(ctx.options).toBe(opts);
  });

  it("reuses existing worktree on create failure", async () => {
    mockGetCurrentBranch.mockResolvedValue("main");
    mockCreateWorktree.mockResolvedValue(false);
    mockWorktreeExists.mockResolvedValue(true);
    mockGetWorktreePath.mockResolvedValue("/worktree/feat-test");
    mockFindClaude.mockResolvedValue("/usr/bin/claude");
    mockBuildClaudeArgs.mockReturnValue(["x"]);
    mockExecInteractive.mockResolvedValue(0);
    mockRevParse
      .mockResolvedValueOnce("aaa")
      .mockResolvedValueOnce("bbb");

    const ctx = await phaseWork(makeOptions());
    expect(ctx.worktreePath).toBe("/worktree/feat-test");
    expect(mockWorktreeExists).toHaveBeenCalled();
  });

  it("exits when worktree create fails and does not exist", async () => {
    mockGetCurrentBranch.mockResolvedValue("main");
    mockCreateWorktree.mockResolvedValue(false);
    mockWorktreeExists.mockResolvedValue(false);

    await expect(phaseWork(makeOptions())).rejects.toThrow();
  });

  it("exits when claude non-zero and user declines", async () => {
    mockGetCurrentBranch.mockResolvedValue("main");
    mockCreateWorktree.mockResolvedValue(true);
    mockGetWorktreePath.mockResolvedValue("/wt");
    mockFindClaude.mockResolvedValue("/usr/bin/claude");
    mockBuildClaudeArgs.mockReturnValue(["x"]);
    mockExecInteractive.mockResolvedValue(1);
    mockPromptYesNo.mockResolvedValue(false);

    await expect(phaseWork(makeOptions())).rejects.toThrow();
  });

  it("continues when claude non-zero but user confirms", async () => {
    mockGetCurrentBranch.mockResolvedValue("main");
    mockCreateWorktree.mockResolvedValue(true);
    mockGetWorktreePath.mockResolvedValue("/wt");
    mockFindClaude.mockResolvedValue("/usr/bin/claude");
    mockBuildClaudeArgs.mockReturnValue(["x"]);
    mockExecInteractive.mockResolvedValue(1);
    mockPromptYesNo.mockResolvedValue(true);
    mockRevParse
      .mockResolvedValueOnce("aaa")
      .mockResolvedValueOnce("bbb");

    const ctx = await phaseWork(makeOptions());
    expect(ctx).toBeDefined();
  });

  it("exits early when no new commits (same HEAD)", async () => {
    mockGetCurrentBranch.mockResolvedValue("main");
    mockCreateWorktree.mockResolvedValue(true);
    mockGetWorktreePath.mockResolvedValue("/wt");
    mockFindClaude.mockResolvedValue("/usr/bin/claude");
    mockBuildClaudeArgs.mockReturnValue(["x"]);
    mockExecInteractive.mockResolvedValue(0);
    mockRevParse
      .mockResolvedValueOnce("same-hash")
      .mockResolvedValueOnce("same-hash");
    mockRemoveWorktree.mockResolvedValue(true);

    await expect(phaseWork(makeOptions())).rejects.toThrow();
  });
});
