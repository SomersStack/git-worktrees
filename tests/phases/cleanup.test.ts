import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeContext, makeOptions } from "../helpers.js";

vi.mock("../../src/git.js", () => ({
  removeWorktree: vi.fn(),
}));

vi.mock("../../src/logger.js", () => ({
  logStep: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

import { removeWorktree } from "../../src/git.js";
import { phaseCleanup } from "../../src/phases/cleanup.js";

const mockRemoveWorktree = vi.mocked(removeWorktree);
vi.spyOn(process.stderr, "write").mockReturnValue(true);

describe("phaseCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes worktree successfully", async () => {
    mockRemoveWorktree.mockResolvedValue(true);
    const result = await phaseCleanup(makeContext());
    expect(result.success).toBe(true);
  });

  it("warns on failure (non-critical)", async () => {
    mockRemoveWorktree.mockResolvedValue(false);
    const result = await phaseCleanup(makeContext());
    expect(result.success).toBe(false);
    expect(result.message).toContain("failed");
  });

  it("skips when noCleanup is set", async () => {
    const ctx = makeContext({
      options: makeOptions({ noCleanup: true }),
    });
    const result = await phaseCleanup(ctx);
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(mockRemoveWorktree).not.toHaveBeenCalled();
  });
});
