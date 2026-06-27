import type { Idea } from "@/lib/inspiration/ideas";

/** Format an idea draft into a clean, paste-ready outline/script. */
export function ideaToScript(idea: Idea): string {
  const lines: string[] = [idea.title.trim() || "Untitled idea", ""];

  const hooks = idea.hooks.map((h) => h.trim()).filter(Boolean);
  if (hooks.length) {
    lines.push("HOOK OPTIONS");
    hooks.forEach((h, i) => lines.push(`${i + 1}. ${h}`));
    lines.push("");
  }

  const points = idea.points.map((p) => p.trim()).filter(Boolean);
  if (points.length) {
    lines.push("KEY POINTS");
    points.forEach((p) => lines.push(`- ${p}`));
    lines.push("");
  }

  if (idea.example.trim()) {
    lines.push("EXAMPLE");
    lines.push(idea.example.trim());
    lines.push("");
  }

  if (idea.cta.trim()) {
    lines.push("CTA");
    lines.push(idea.cta.trim());
  }

  return lines.join("\n").trim();
}
