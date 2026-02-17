import { exec } from "./exec.js";
import { findClaude } from "./claude.js";
import { generateBranchName } from "./branch-name.js";
import { logStep, logError, createSpinner } from "./logger.js";
import type { WorkStream } from "./types.js";

const BEAD_GROUP_PROMPT = `You are a task grouping assistant. Given a list of open beads (work items),
group them into small clusters of very closely related items. Items that touch
the same file, fix the same subsystem, or share a tight dependency belong
together. Singletons are fine — do not force grouping.

Return ONLY a JSON array (no markdown fences, no explanation) where each element has:
- "id": short kebab-case identifier for the group
- "title": short human-readable group title
- "prompt": full agent prompt that MUST include:
  1. The bead IDs in the group
  2. Instruction to run \`bd show <id>\` for each bead to verify not already claimed/in_progress — skip any that are
  3. Instruction to immediately run \`bd update <id> --status in_progress\` for each unclaimed bead before starting work
  4. Description of the actual work derived from bead titles/descriptions
  5. Instruction to run \`bd close <id>\` for each completed bead
  6. Instruction to run \`bd sync\` when all beads in the group are closed

Rules:
- Clusters should be SMALL (1–3 beads). If in doubt, keep items separate.
- "Closely related" means same module/subsystem, shared implementation, or logical setup — not just thematic similarity.
- Each group must be independently completable — no cross-group dependencies.
- Do NOT add meta-tasks like "review" or "integrate".

Open beads:
`;

export async function fetchReadyBeads(): Promise<string> {
  logStep("Fetching ready beads...");

  const result = await exec("bd", ["ready"]);

  if (result.exitCode !== 0) {
    const msg = result.stderr.trim() || "bd command failed";
    throw new Error(`Failed to fetch beads: ${msg}`);
  }

  const output = result.stdout.trim();
  if (!output) {
    throw new Error("No ready beads found. Nothing to do.");
  }

  return output;
}

export async function groupBeads(
  beadsText: string,
  model?: string,
): Promise<WorkStream[]> {
  logStep("Grouping beads into work streams...");

  const claudeCmd = await findClaude();
  const groupModel = model || "sonnet";

  const args = [
    "-p",
    BEAD_GROUP_PROMPT + beadsText,
    "--output-format",
    "text",
    "--model",
    groupModel,
  ];

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
    logError("Claude failed to group beads");
    if (result.stderr && !spinnerStopped) {
      process.stderr.write(result.stderr + "\n");
    }
    throw new Error("Failed to group beads into work streams");
  }

  const raw = result.stdout.trim();

  // Try to extract JSON array from response
  let jsonStr = raw;

  // 1. Try markdown fences
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  } else {
    // 2. Try to find a bare JSON array
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
      `Failed to parse bead groups from Claude response:\n${raw}`,
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(
      `Expected non-empty JSON array of bead groups, got:\n${raw}`,
    );
  }

  const streams: WorkStream[] = parsed.map(
    (item: { id?: string; title?: string; prompt?: string }) => {
      if (!item.id || !item.title || !item.prompt) {
        throw new Error(
          `Invalid bead group (missing id/title/prompt): ${JSON.stringify(item)}`,
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
