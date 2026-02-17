import { exec } from "./exec.js";
import { findClaude } from "./claude.js";
import { generateBranchName } from "./branch-name.js";
import { logStep, logError, createSpinner } from "./logger.js";
import type { WorkStream } from "./types.js";

const SPLIT_PROMPT = `You are a task decomposition assistant. Given a task description, break it into independent, parallelizable work streams.

Return ONLY a JSON array (no markdown fences, no explanation) where each element has:
- "id": a short kebab-case identifier (e.g. "add-tests")
- "title": a short human-readable title
- "prompt": the full detailed prompt that an AI coding agent should receive to complete this work stream independently

Rules:
- Each work stream must be independent — it should not depend on the output of another stream.
- If the task is a single indivisible unit, return an array with one element.
- Do NOT include meta-tasks like "review" or "integrate" — only concrete implementation tasks.

Task description:
`;

export async function splitWork(
  input: string,
  model?: string,
): Promise<WorkStream[]> {
  logStep("Splitting task into work streams...");

  const claudeCmd = await findClaude();

  const args = ["-p", SPLIT_PROMPT + input, "--output-format", "text"];
  if (model) {
    args.push("--model", model);
  }

  const spinner = createSpinner("Waiting for Claude...");
  let spinnerStopped = false;

  const result = await exec(claudeCmd, args, {
    onStderr(chunk) {
      if (!spinnerStopped) {
        spinner.stop();
        spinnerStopped = true;
      }
      process.stderr.write(chunk);
    },
  });

  if (!spinnerStopped) {
    spinner.stop();
  }

  if (result.exitCode !== 0) {
    logError("Claude failed to split task");
    if (result.stderr && !spinnerStopped) {
      // Only write stderr if we haven't already streamed it
      process.stderr.write(result.stderr + "\n");
    }
    throw new Error("Failed to decompose task into work streams");
  }

  const raw = result.stdout.trim();

  // Try to extract JSON array from response
  let jsonStr = raw;

  // 1. Try markdown fences
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  } else {
    // 2. Try to find a bare JSON array (Claude may include preamble text)
    const firstBracket = raw.indexOf("[");
    const lastBracket = raw.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      jsonStr = raw.slice(firstBracket, lastBracket + 1);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(
      `Failed to parse work streams from Claude response:\n${raw}`,
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(
      `Expected non-empty JSON array of work streams, got:\n${raw}`,
    );
  }

  const streams: WorkStream[] = parsed.map(
    (item: { id?: string; title?: string; prompt?: string }) => {
      if (!item.id || !item.title || !item.prompt) {
        throw new Error(
          `Invalid work stream (missing id/title/prompt): ${JSON.stringify(item)}`,
        );
      }
      return {
        id: item.id,
        title: item.title,
        prompt: item.prompt,
        branch: generateBranchName(item.id),
      };
    },
  );

  return streams;
}
