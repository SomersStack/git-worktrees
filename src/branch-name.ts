import { randomBytes } from "node:crypto";

export function generateBranchName(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = randomBytes(2).toString("hex");
  return `gwt/task-${yyyy}${mm}${dd}-${suffix}`;
}
