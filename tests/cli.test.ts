import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseArgs } from "../src/cli.js";

describe("parseArgs", () => {
  it("parses positional branch and prompt", () => {
    const opts = parseArgs(["feat/test", "Add tests"]);
    expect(opts?.branch).toBe("feat/test");
    expect(opts?.prompt).toBe("Add tests");
  });

  it("parses -p flag", () => {
    const opts = parseArgs(["feat/test", "prompt", "-p"]);
    expect(opts?.printMode).toBe(true);
  });

  it("parses --print flag", () => {
    const opts = parseArgs(["feat/test", "prompt", "--print"]);
    expect(opts?.printMode).toBe(true);
  });

  it("parses --model", () => {
    const opts = parseArgs(["feat/test", "prompt", "--model", "opus"]);
    expect(opts?.model).toBe("opus");
  });

  it("parses --max-budget-usd", () => {
    const opts = parseArgs([
      "feat/test",
      "prompt",
      "--max-budget-usd",
      "5",
    ]);
    expect(opts?.maxBudgetUsd).toBe("5");
  });

  it("parses --permission-mode", () => {
    const opts = parseArgs([
      "feat/test",
      "prompt",
      "--permission-mode",
      "plan",
    ]);
    expect(opts?.permissionMode).toBe("plan");
  });

  it("parses --from", () => {
    const opts = parseArgs(["feat/test", "prompt", "--from", "v1.0"]);
    expect(opts?.fromRef).toBe("v1.0");
  });

  it("parses --no-push", () => {
    const opts = parseArgs(["feat/test", "prompt", "--no-push"]);
    expect(opts?.noPush).toBe(true);
  });

  it("parses --no-cleanup", () => {
    const opts = parseArgs(["feat/test", "prompt", "--no-cleanup"]);
    expect(opts?.noCleanup).toBe(true);
  });

  it("parses -- passthrough flags", () => {
    const opts = parseArgs([
      "feat/test",
      "prompt",
      "--",
      "--verbose",
      "--debug",
    ]);
    expect(opts?.extraClaudeFlags).toEqual(["--verbose", "--debug"]);
  });

  it("parses all flags together", () => {
    const opts = parseArgs([
      "feat/test",
      "Do stuff",
      "-p",
      "--model",
      "opus",
      "--max-budget-usd",
      "10",
      "--no-push",
      "--no-cleanup",
      "--from",
      "main",
      "--permission-mode",
      "plan",
      "--",
      "--extra",
    ]);
    expect(opts).toEqual({
      branch: "feat/test",
      prompt: "Do stuff",
      printMode: true,
      model: "opus",
      maxBudgetUsd: "10",
      permissionMode: "plan",
      fromRef: "main",
      noPush: true,
      noCleanup: true,
      workOnly: false,
      extraClaudeFlags: ["--extra"],
    });
  });

  it("single positional arg is treated as prompt with auto-generated branch", () => {
    const opts = parseArgs(["Add unit tests for auth"]);
    expect(opts?.prompt).toBe("Add unit tests for auth");
    expect(opts?.branch).toMatch(/^gwt\/task-\d{8}-[0-9a-f]{4}$/);
  });

  it("auto-generated branch matches expected pattern", () => {
    const opts = parseArgs(["Fix the bug"]);
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    expect(opts?.branch).toMatch(
      new RegExp(`^gwt/task-${yyyy}${mm}${dd}-[0-9a-f]{4}$`),
    );
  });

  it("no args returns auto-generated branch with empty prompt", () => {
    const opts = parseArgs([]);
    expect(opts?.branch).toMatch(/^gwt\/task-\d{8}-[0-9a-f]{4}$/);
    expect(opts?.prompt).toBe("");
  });

  it("exits on unknown flag", () => {
    expect(() => parseArgs(["feat/test", "prompt", "--bogus"])).toThrow();
  });

  it("exits on unexpected positional", () => {
    expect(() => parseArgs(["a", "b", "c"])).toThrow();
  });

  it("defaults booleans to false and strings to empty", () => {
    const opts = parseArgs(["feat/test", "prompt"]);
    expect(opts?.printMode).toBe(false);
    expect(opts?.model).toBe("");
    expect(opts?.maxBudgetUsd).toBe("");
    expect(opts?.permissionMode).toBe("");
    expect(opts?.fromRef).toBe("");
    expect(opts?.noPush).toBe(false);
    expect(opts?.noCleanup).toBe(false);
    expect(opts?.workOnly).toBe(false);
    expect(opts?.extraClaudeFlags).toEqual([]);
  });
});
