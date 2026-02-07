import { describe, it, expect, vi } from "vitest";
import { logInfo, logWarn, logError, logStep } from "../src/logger.js";

describe("logger", () => {
  it("logInfo writes [OK] prefix to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    logInfo("hello");
    expect(spy).toHaveBeenCalledWith("[OK] hello\n");
  });

  it("logWarn writes [!] prefix to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    logWarn("careful");
    expect(spy).toHaveBeenCalledWith("[!] careful\n");
  });

  it("logError writes [x] prefix to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    logError("bad");
    expect(spy).toHaveBeenCalledWith("[x] bad\n");
  });

  it("logStep writes ==> prefix to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    logStep("doing stuff");
    expect(spy).toHaveBeenCalledWith("==> doing stuff\n");
  });
});
