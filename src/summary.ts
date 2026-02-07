import type { GwtOptions } from "./types.js";

const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

export function printSummary(
  branch: string,
  sourceBranch: string,
  options: GwtOptions,
): void {
  process.stderr.write("\n");
  process.stderr.write(
    "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n",
  );
  process.stderr.write(`${BOLD}gwt complete${RESET}\n`);
  process.stderr.write(`  Branch:  ${branch} \u2192 ${sourceBranch}\n`);
  process.stderr.write("  Merged:  yes\n");
  process.stderr.write(
    `  Pushed:  ${options.noPush ? "skipped" : "yes"}\n`,
  );
  process.stderr.write(
    `  Cleanup: ${options.noCleanup ? "skipped" : "done"}\n`,
  );
  process.stderr.write(
    "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n",
  );
}
