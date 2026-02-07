import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeContext, makeOptions } from "../helpers.js";

vi.mock("../../src/git.js", () => ({
  push: vi.fn(),
}));

vi.mock("../../src/logger.js", () => ({
  logStep: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import { push } from "../../src/git.js";
import { phasePush } from "../../src/phases/push.js";

const mockPush = vi.mocked(push);
vi.spyOn(process.stderr, "write").mockReturnValue(true);

describe("phasePush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pushes successfully", async () => {
    mockPush.mockResolvedValue(true);
    const result = await phasePush(makeContext());
    expect(result.success).toBe(true);
    expect(result.skipped).toBeUndefined();
  });

  it("exits on push failure", async () => {
    mockPush.mockResolvedValue(false);
    await expect(phasePush(makeContext())).rejects.toThrow();
  });

  it("skips when noPush is set", async () => {
    const ctx = makeContext({
      options: makeOptions({ noPush: true }),
    });
    const result = await phasePush(ctx);
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
