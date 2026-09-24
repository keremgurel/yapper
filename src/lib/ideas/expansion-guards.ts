import type { IdeaExpansion } from "@/lib/ideas/types";

/**
 * Cheap, deterministic repairs applied to a model's expansion after parsing.
 * The prompt asks for all of this too; these catch the misses the prompt
 * alone does not, without another provider call.
 */

const STOPWORDS = new Set(
  (
    "the and for you your are this that with about from into what when " +
    "how why not but its our their they them who was were has have had " +
    "can will just than then there here one all any"
  ).split(" "),
);

/** Content words reduced to a short stem, so "educational" meets "education"
 * and "marketing" meets "market". */
function stems(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9$%]+/g) ?? [];
  return [
    ...new Set(
      words
        .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
        .map((word) => (word.length > 5 ? word.slice(0, 5) : word)),
    ),
  ];
}

function sharedCount(a: readonly string[], b: readonly string[]): number {
  const set = new Set(b);
  return a.filter((stem) => set.has(stem)).length;
}

function firstWords(text: string, count: number): string {
  return (text.toLowerCase().match(/[a-z0-9']+/g) ?? [])
    .slice(0, count)
    .join(" ");
}

/**
 * The script is spoken right after the chosen hook, so an opening sentence
 * that restates a hook makes the creator say the same thing twice. Drops it
 * when it overlaps a hook heavily, or opens the same way and shares its
 * subject.
 */
export function dropRestatedOpener(
  script: string,
  hooks: readonly string[],
): string {
  const trimmed = script.trim();
  const match = /^[\s\S]*?[.!?](?=\s|$)/.exec(trimmed);
  if (!match || !hooks.length) return trimmed;
  const opener = match[0];
  const rest = trimmed.slice(opener.length).trim();
  // Never strip a script down to nothing.
  if (!rest) return trimmed;
  const openerStems = stems(opener);
  if (!openerStems.length) return trimmed;
  const restated = hooks.some((hook) => {
    const hookStems = stems(hook);
    if (!hookStems.length) return false;
    const overlap =
      sharedCount(openerStems, hookStems) /
      Math.min(openerStems.length, hookStems.length);
    const sameOpening =
      firstWords(opener, 3).length > 0 &&
      firstWords(opener, 3) === firstWords(hook, 3);
    return overlap >= 0.6 || (sameOpening && overlap >= 0.35);
  });
  return restated ? rest : trimmed;
}

/** A new pillar is a label, not a sentence: at most three words. */
function shortPillar(name: string): string {
  return name
    .replace(/[.…:;,\s]+$/u, "")
    .split(/\s+/)
    .slice(0, 3)
    .join(" ")
    .replace(/[.…:;,]+$/u, "");
}

/**
 * Files the model's pillar under an existing one whenever the names are near
 * duplicates ("Educational videos showing..." is "Educational"). Only a
 * genuinely new theme survives as a new pillar, and then as a short label.
 */
export function matchPillar(
  proposed: string | null,
  existing: readonly string[],
): string | null {
  const name = proposed?.trim();
  if (!name) return null;
  const lower = name.toLowerCase();
  const exact = existing.find(
    (pillar) => pillar.trim().toLowerCase() === lower,
  );
  if (exact) return exact;

  const proposedStems = stems(name);
  let best: { pillar: string; score: number } | null = null;
  for (const pillar of existing) {
    const pillarLower = pillar.trim().toLowerCase();
    if (!pillarLower) continue;
    const contains =
      lower.startsWith(`${pillarLower} `) ||
      pillarLower.startsWith(`${lower} `);
    const pillarStems = stems(pillar);
    const shared = sharedCount(proposedStems, pillarStems);
    const score = contains
      ? 1
      : pillarStems.length && proposedStems.length
        ? shared / Math.min(pillarStems.length, proposedStems.length)
        : 0;
    if (score >= 0.5 && (!best || score > best.score)) best = { pillar, score };
  }
  return best?.pillar ?? (shortPillar(name) || null);
}

/** Every guard, in order, over one parsed expansion. */
export function guardExpansion(
  expansion: IdeaExpansion,
  pillarNames: readonly string[],
): IdeaExpansion {
  return {
    ...expansion,
    pillar: matchPillar(expansion.pillar, pillarNames),
    script: expansion.script
      ? dropRestatedOpener(expansion.script, expansion.hooks ?? [])
      : expansion.script,
  };
}
