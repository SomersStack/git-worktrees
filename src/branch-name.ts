import { randomBytes } from "node:crypto";

export function generateBranchName(slug?: string): string {
  const suffix = randomBytes(2).toString("hex");

  if (slug) {
    const clean = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    return `gwt/${clean}-${suffix}`;
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `gwt/task-${yyyy}${mm}${dd}-${suffix}`;
}
