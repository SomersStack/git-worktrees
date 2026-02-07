import { createInterface } from "node:readline";

export interface Spinner {
  stop(finalMsg?: string): void;
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function createSpinner(msg: string): Spinner {
  let frame = 0;
  const interval = setInterval(() => {
    const f = SPINNER_FRAMES[frame % SPINNER_FRAMES.length];
    process.stderr.write(`\r  ${f} ${msg}`);
    frame++;
  }, 80);

  return {
    stop(finalMsg?: string) {
      clearInterval(interval);
      // Clear the spinner line
      process.stderr.write(`\r${" ".repeat(msg.length + 6)}\r`);
      if (finalMsg) {
        logInfo(finalMsg);
      }
    },
  };
}

export function logInfo(msg: string): void {
  process.stderr.write(`[OK] ${msg}\n`);
}

export function logWarn(msg: string): void {
  process.stderr.write(`[!] ${msg}\n`);
}

export function logError(msg: string): void {
  process.stderr.write(`[x] ${msg}\n`);
}

export function logStep(msg: string): void {
  process.stderr.write(`==> ${msg}\n`);
}

export async function promptYesNo(
  question: string,
  defaultAnswer: "y" | "n" = "n",
): Promise<boolean> {
  const suffix = defaultAnswer === "y" ? "[Y/n]" : "[y/N]";
  process.stderr.write(`[?] ${question} ${suffix} `);

  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question("", (reply) => {
      rl.close();
      const r = reply.trim().toLowerCase();
      if (r === "y" || r === "yes") {
        resolve(true);
      } else if (r === "n" || r === "no") {
        resolve(false);
      } else {
        resolve(defaultAnswer === "y");
      }
    });
  });
}
