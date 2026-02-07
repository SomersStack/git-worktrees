import { describe, it, expect } from "vitest";
import { parseDeleteArgs } from "../src/commands/delete.js";

describe("parseDeleteArgs", () => {
  it("parses branch positional arg", () => {
    const opts = parseDeleteArgs(["feat/test"]);
    expect(opts?.branch).toBe("feat/test");
    expect(opts?.force).toBe(false);
  });

  it("parses --force flag", () => {
    const opts = parseDeleteArgs(["feat/test", "--force"]);
    expect(opts?.force).toBe(true);
  });

  it("returns null when no branch provided", () => {
    const opts = parseDeleteArgs([]);
    expect(opts).toBeNull();
  });

  it("exits on unknown flag", () => {
    expect(() => parseDeleteArgs(["feat/test", "--bogus"])).toThrow();
  });

  it("exits on unexpected positional", () => {
    expect(() => parseDeleteArgs(["a", "b"])).toThrow();
  });
});
