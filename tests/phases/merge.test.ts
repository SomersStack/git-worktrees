import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeContext } from "../helpers.js";

vi.mock("../../src/exec.js", () => ({
  exec: vi.fn(),
  execInteractive: vi.fn(),
}));

vi.mock("../../src/claude.js", () => ({
  findClaude: vi.fn(),
}));

vi.mock("../../src/git.js", () => ({
  merge: vi.fn(),
  getUnmergedFiles: vi.fn(),
  abortMerge: vi.fn(),
}));

vi.mock("../../src/logger.js", () => ({
  logStep: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

import { execInteractive } from "../../src/exec.js";
import { findClaude } from "../../src/claude.js";
import { merge, getUnmergedFiles, abortMerge } from "../../src/git.js";
import { phaseMerge } from "../../src/phases/merge.js";

const mockMerge = vi.mocked(merge);
const mockGetUnmergedFiles = vi.mocked(getUnmergedFiles);
const mockAbortMerge = vi.mocked(abortMerge);
const mockFindClaude = vi.mocked(findClaude);
const mockExecInteractive = vi.mocked(execInteractive);
vi.spyOn(process.stderr, "write").mockReturnValue(true);

describe("phaseMerge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success on clean merge", async () => {
    mockMerge.mockResolvedValue({ success: true, output: "ok" });
    const result = await phaseMerge(makeContext());
    expect(result.success).toBe(true);
  });

  it("handles conflict then resolution", async () => {
    mockMerge.mockResolvedValue({ success: false, output: "conflict" });
    mockGetUnmergedFiles
      .mockResolvedValueOnce(["a.ts"]) // initial check
      .mockResolvedValueOnce([]); // after claude resolves
    mockFindClaude.mockResolvedValue("/usr/bin/claude");
    mockExecInteractive.mockResolvedValue(0);

    const result = await phaseMerge(makeContext());
    expect(result.success).toBe(true);
    expect(mockExecInteractive).toHaveBeenCalled();
  });

  it("exits when conflicts remain unresolved", async () => {
    mockMerge.mockResolvedValue({ success: false, output: "conflict" });
    mockGetUnmergedFiles
      .mockResolvedValueOnce(["a.ts"])
      .mockResolvedValueOnce(["a.ts"]); // still unresolved
    mockFindClaude.mockResolvedValue("/usr/bin/claude");
    mockExecInteractive.mockResolvedValue(0);

    await expect(phaseMerge(makeContext())).rejects.toThrow();
  });

  it("aborts and exits on non-conflict merge failure", async () => {
    mockMerge.mockResolvedValue({ success: false, output: "error" });
    mockGetUnmergedFiles.mockResolvedValueOnce([]); // no unmerged = not a conflict
    mockAbortMerge.mockResolvedValue(undefined);

    await expect(phaseMerge(makeContext())).rejects.toThrow();
    expect(mockAbortMerge).toHaveBeenCalled();
  });
});
