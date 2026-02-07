import { describe, it, expect } from "vitest";
import { parseRescueArgs } from "../src/commands/rescue.js";

describe("parseRescueArgs", () => {
  it("parses branch positional arg", () => {
    const opts = parseRescueArgs(["feat/test"]);
    expect(opts?.branch).toBe("feat/test");
    expect(opts?.printMode).toBe(false);
    expect(opts?.workOnly).toBe(false);
  });

  it("parses -p flag", () => {
    const opts = parseRescueArgs(["feat/test", "-p"]);
    expect(opts?.printMode).toBe(true);
  });

  it("parses --print flag", () => {
    const opts = parseRescueArgs(["feat/test", "--print"]);
    expect(opts?.printMode).toBe(true);
  });

  it("parses --model", () => {
    const opts = parseRescueArgs(["feat/test", "--model", "opus"]);
    expect(opts?.model).toBe("opus");
  });

  it("parses --max-budget-usd", () => {
    const opts = parseRescueArgs(["feat/test", "--max-budget-usd", "5"]);
    expect(opts?.maxBudgetUsd).toBe("5");
  });

  it("parses --permission-mode", () => {
    const opts = parseRescueArgs(["feat/test", "--permission-mode", "plan"]);
    expect(opts?.permissionMode).toBe("plan");
  });

  it("parses --no-push", () => {
    const opts = parseRescueArgs(["feat/test", "--no-push"]);
    expect(opts?.noPush).toBe(true);
  });

  it("parses --no-cleanup", () => {
    const opts = parseRescueArgs(["feat/test", "--no-cleanup"]);
    expect(opts?.noCleanup).toBe(true);
  });

  it("parses --work-only", () => {
    const opts = parseRescueArgs(["feat/test", "--work-only"]);
    expect(opts?.workOnly).toBe(true);
  });

  it("parses -- passthrough flags", () => {
    const opts = parseRescueArgs(["feat/test", "--", "--verbose", "--debug"]);
    expect(opts?.extraClaudeFlags).toEqual(["--verbose", "--debug"]);
  });

  it("parses all flags together", () => {
    const opts = parseRescueArgs([
      "feat/test",
      "-p",
      "--model",
      "opus",
      "--max-budget-usd",
      "10",
      "--permission-mode",
      "plan",
      "--no-push",
      "--no-cleanup",
      "--work-only",
      "--",
      "--extra",
    ]);
    expect(opts).toEqual({
      branch: "feat/test",
      printMode: true,
      model: "opus",
      maxBudgetUsd: "10",
      permissionMode: "plan",
      noPush: true,
      noCleanup: true,
      workOnly: true,
      extraClaudeFlags: ["--extra"],
    });
  });

  it("returns null when no branch provided", () => {
    const opts = parseRescueArgs([]);
    expect(opts).toBeNull();
  });

  it("exits on unknown flag", () => {
    expect(() => parseRescueArgs(["feat/test", "--bogus"])).toThrow();
  });

  it("exits on unexpected positional", () => {
    expect(() => parseRescueArgs(["a", "b"])).toThrow();
  });

  it("defaults booleans to false and strings to empty", () => {
    const opts = parseRescueArgs(["feat/test"]);
    expect(opts?.printMode).toBe(false);
    expect(opts?.model).toBe("");
    expect(opts?.maxBudgetUsd).toBe("");
    expect(opts?.permissionMode).toBe("");
    expect(opts?.noPush).toBe(false);
    expect(opts?.noCleanup).toBe(false);
    expect(opts?.workOnly).toBe(false);
    expect(opts?.extraClaudeFlags).toEqual([]);
  });
});
