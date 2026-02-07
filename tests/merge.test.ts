import { describe, it, expect } from "vitest";
import { parseMergeArgs } from "../src/commands/merge.js";

describe("parseMergeArgs", () => {
  it("parses branch positional arg", () => {
    const opts = parseMergeArgs(["feat/test"]);
    expect(opts?.branch).toBe("feat/test");
    expect(opts?.noPush).toBe(false);
    expect(opts?.noCleanup).toBe(false);
  });

  it("parses --no-push flag", () => {
    const opts = parseMergeArgs(["feat/test", "--no-push"]);
    expect(opts?.noPush).toBe(true);
  });

  it("parses --no-cleanup flag", () => {
    const opts = parseMergeArgs(["feat/test", "--no-cleanup"]);
    expect(opts?.noCleanup).toBe(true);
  });

  it("parses all flags together", () => {
    const opts = parseMergeArgs(["feat/test", "--no-push", "--no-cleanup"]);
    expect(opts).toEqual({
      branch: "feat/test",
      noPush: true,
      noCleanup: true,
    });
  });

  it("returns null when no branch provided", () => {
    const opts = parseMergeArgs([]);
    expect(opts).toBeNull();
  });

  it("exits on unknown flag", () => {
    expect(() => parseMergeArgs(["feat/test", "--bogus"])).toThrow();
  });

  it("exits on unexpected positional", () => {
    expect(() => parseMergeArgs(["a", "b"])).toThrow();
  });
});
