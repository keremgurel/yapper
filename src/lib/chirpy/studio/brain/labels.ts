import type { BrainOverview } from "./overview";

/** Field names as the Essentials card shows them. */
export const ESSENTIAL_LABELS: Record<string, string> = {
  name: "Name",
  whatIMake: "What I make",
  audience: "Who it’s for",
  voice: "How I sound",
  scriptingPatterns: "How my scripts are built",
  offers: "What I’m promoting",
  doNots: "Never say",
  defaultFormat: "Default format",
};

/** “A”, “A and B”, “A, B and C”. */
export function joined(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export function quoted(label: string): string {
  return `“${label.length > 60 ? `${label.slice(0, 57)}…` : label}”`;
}

/** Knowledge sections, skills and samples by id, for confirmation
 * questions. */
export function brainNames(brain: BrainOverview | undefined) {
  if (!brain) return {};
  return Object.fromEntries([
    ...brain.knowledge.map((line) => [line.id, line.title]),
    ...brain.skills.map((skill) => [skill.id, skill.name]),
    ...brain.voice.samples.map((sample) => [sample.id, sample.title]),
  ]);
}

/** Move `id` to a 1-based position in `ids`, clamped to the list. */
export function movedTo(
  ids: readonly string[],
  id: string,
  position: number,
): string[] {
  const rest = ids.filter((item) => item !== id);
  const index = Math.max(0, Math.min(rest.length, Math.trunc(position) - 1));
  return [...rest.slice(0, index), id, ...rest.slice(index)];
}
