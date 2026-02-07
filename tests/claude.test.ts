import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { buildClaudeArgs, trustDirectory } from "../src/claude.js";
import { makeOptions } from "./helpers.js";

// findClaude is tested via mocking exec — we test buildClaudeArgs as pure function

describe("buildClaudeArgs", () => {
  it("builds args for interactive mode", () => {
    const opts = makeOptions({ prompt: "do stuff" });
    const args = buildClaudeArgs(opts);
    expect(args).toEqual(["do stuff"]);
  });

  it("builds args for print mode", () => {
    const opts = makeOptions({ prompt: "do stuff", printMode: true });
    const args = buildClaudeArgs(opts);
    expect(args).toEqual(["-p", "do stuff"]);
  });

  it("includes model flag", () => {
    const opts = makeOptions({ prompt: "x", model: "opus" });
    const args = buildClaudeArgs(opts);
    expect(args).toContain("--model");
    expect(args).toContain("opus");
  });

  it("includes max-budget-usd flag", () => {
    const opts = makeOptions({ prompt: "x", maxBudgetUsd: "5" });
    const args = buildClaudeArgs(opts);
    expect(args).toContain("--max-budget-usd");
    expect(args).toContain("5");
  });

  it("includes permission-mode flag", () => {
    const opts = makeOptions({ prompt: "x", permissionMode: "plan" });
    const args = buildClaudeArgs(opts);
    expect(args).toContain("--permission-mode");
    expect(args).toContain("plan");
  });

  it("appends extra claude flags", () => {
    const opts = makeOptions({
      prompt: "x",
      extraClaudeFlags: ["--verbose", "--debug"],
    });
    const args = buildClaudeArgs(opts);
    expect(args).toContain("--verbose");
    expect(args).toContain("--debug");
  });

  it("builds all flags together", () => {
    const opts = makeOptions({
      prompt: "do it",
      printMode: true,
      model: "opus",
      maxBudgetUsd: "10",
      permissionMode: "plan",
      extraClaudeFlags: ["--extra"],
    });
    const args = buildClaudeArgs(opts);
    expect(args).toEqual([
      "-p",
      "do it",
      "--model",
      "opus",
      "--max-budget-usd",
      "10",
      "--permission-mode",
      "plan",
      "--extra",
    ]);
  });

  it("omits empty optional flags", () => {
    const opts = makeOptions({ prompt: "x" });
    const args = buildClaudeArgs(opts);
    expect(args).toEqual(["x"]);
    expect(args).not.toContain("--model");
    expect(args).not.toContain("--max-budget-usd");
    expect(args).not.toContain("--permission-mode");
  });
});

describe("trustDirectory", () => {
  let fakeHome: string;
  let origHome: string;

  beforeEach(() => {
    fakeHome = mkdtempSync(join(tmpdir(), "claude-test-"));
    origHome = process.env.HOME!;
    process.env.HOME = fakeHome;
  });

  afterEach(() => {
    process.env.HOME = origHome;
    rmSync(fakeHome, { recursive: true, force: true });
  });

  it("creates .claude.json with trust entry when file does not exist", () => {
    trustDirectory("/some/new/dir");
    const config = JSON.parse(
      readFileSync(join(fakeHome, ".claude.json"), "utf-8"),
    );
    expect(config.projects["/some/new/dir"].hasTrustDialogAccepted).toBe(true);
  });

  it("adds trust entry to existing config without clobbering", () => {
    const existing = {
      projects: { "/existing": { hasTrustDialogAccepted: true, foo: "bar" } },
      otherKey: 123,
    };
    writeFileSync(
      join(fakeHome, ".claude.json"),
      JSON.stringify(existing),
    );

    trustDirectory("/new/dir");
    const config = JSON.parse(
      readFileSync(join(fakeHome, ".claude.json"), "utf-8"),
    );
    expect(config.otherKey).toBe(123);
    expect(config.projects["/existing"].foo).toBe("bar");
    expect(config.projects["/new/dir"].hasTrustDialogAccepted).toBe(true);
  });

  it("preserves existing project fields when trusting", () => {
    const existing = {
      projects: { "/dir": { allowedTools: ["Bash"], lastCost: 1.5 } },
    };
    writeFileSync(
      join(fakeHome, ".claude.json"),
      JSON.stringify(existing),
    );

    trustDirectory("/dir");
    const config = JSON.parse(
      readFileSync(join(fakeHome, ".claude.json"), "utf-8"),
    );
    expect(config.projects["/dir"].allowedTools).toEqual(["Bash"]);
    expect(config.projects["/dir"].lastCost).toBe(1.5);
    expect(config.projects["/dir"].hasTrustDialogAccepted).toBe(true);
  });

  it("no-ops when directory is already trusted", () => {
    const existing = {
      projects: { "/dir": { hasTrustDialogAccepted: true } },
    };
    const json = JSON.stringify(existing);
    writeFileSync(join(fakeHome, ".claude.json"), json);

    trustDirectory("/dir");
    // file should be unchanged (no rewrite)
    const raw = readFileSync(join(fakeHome, ".claude.json"), "utf-8");
    expect(raw).toBe(json);
  });
});
