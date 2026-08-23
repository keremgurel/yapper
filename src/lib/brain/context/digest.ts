import { describeBlock } from "./excerpt";
import { clamp } from "./text";
import type { BrainBlockSource, BrainSkillSource } from "./types";

/**
 * The index: one line for everything the brain holds that this prompt did not
 * load.
 *
 * This is the idea the whole design rests on. A creator can import a 5000 row
 * keyword export, three research documents and a dozen skills, and the prompt
 * still knows all of it exists, what each one is, and when it would matter,
 * for about a line each. The model can then say "your gap list would answer
 * this" even on a call that never read the list, and the router has something
 * to choose from that is not the contents themselves.
 *
 * Refs are short and positional (`s1`, `c3`) rather than uuids: they are what
 * the router echoes back, and a uuid costs eight times the tokens to say.
 */

const TITLE_CAP = 60;
const DIGEST_CAP = 110;

export interface IndexEntry {
  /** `s1`, `c2`. What the router returns. */
  ref: string;
  /** The row id, for mapping a selection back to real content. */
  id: string;
  type: "skill" | "context";
  line: string;
}

export interface BrainIndex {
  entries: IndexEntry[];
  /** The rendered index, or "" when there is nothing routable. */
  text: string;
}

function skillLine(ref: string, skill: BrainSkillSource): string {
  const name = clamp(skill.name, TITLE_CAP);
  const surfaces = skill.surfaces.length ? skill.surfaces.join(", ") : "any";
  const when = clamp(skill.whenToUse, DIGEST_CAP);
  return `[${ref}] ${name} · ${surfaces}${when ? ` · ${when}` : ""}`;
}

function blockLine(ref: string, block: BrainBlockSource): string {
  const title = clamp(block.title, TITLE_CAP);
  const shape = describeBlock(block);
  // The creator's own digest wins; without one the shape at least tells the
  // model whether asking for this section would return prose or rows.
  const digest = clamp(block.digest, DIGEST_CAP);
  return `[${ref}] ${title} · ${shape}${digest ? ` · ${digest}` : ""}`;
}

/**
 * Build the index over the routable half of the brain: enabled skills, and
 * blocks the creator left on automatic. Core blocks are already in the core
 * text, manual blocks are attached by hand, and private blocks never leave the
 * page, so none of the three appear here.
 */
export function buildIndex(
  blocks: BrainBlockSource[],
  skills: BrainSkillSource[],
  maxChars: number,
): BrainIndex {
  const entries: IndexEntry[] = [];

  skills
    .filter((skill) => skill.enabled && skill.name.trim())
    .forEach((skill, position) => {
      const ref = `s${position + 1}`;
      entries.push({
        ref,
        id: skill.id,
        type: "skill",
        line: skillLine(ref, skill),
      });
    });

  blocks
    .filter((block) => block.usage === "auto" && block.title.trim())
    .forEach((block, position) => {
      const ref = `c${position + 1}`;
      entries.push({
        ref,
        id: block.id,
        type: "context",
        line: blockLine(ref, block),
      });
    });

  if (!entries.length) return { entries, text: "" };

  // Drop from the end when it will not fit, and drop the entry with the line:
  // an index that lists a ref the router cannot resolve is worse than a shorter
  // index.
  const kept: IndexEntry[] = [];
  let used = 0;
  for (const entry of entries) {
    const cost = entry.line.length + (kept.length ? 1 : 0);
    if (used + cost > maxChars) break;
    kept.push(entry);
    used += cost;
  }

  return { entries: kept, text: kept.map((entry) => entry.line).join("\n") };
}

/** Look a ref up in an index. Returns null for a ref the model invented. */
export function entryFor(index: BrainIndex, ref: string): IndexEntry | null {
  return index.entries.find((entry) => entry.ref === ref) ?? null;
}
