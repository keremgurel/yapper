import { excerptBlock } from "./excerpt";
import { clamp } from "./text";
import type {
  BrainBlockSource,
  BrainPillarSource,
  BrainProjectSource,
} from "./types";

/**
 * Who the creator is, compiled. The part of the brain every writing prompt
 * carries whatever the task is.
 *
 * Two rules drive this file, and they are the same two the original context
 * block was built on.
 *
 * Byte-stability. The output is deterministic for a given project, so it can
 * sit at a fixed position in a system prompt and be served from the provider's
 * prompt cache on every repeat call. Never interpolate timestamps, counts of
 * things that move, or anything else that changes between requests.
 *
 * A hard ceiling. Every field is free text a creator can paste an essay into,
 * so each is truncated individually before the global cap applies, and one
 * rambling answer cannot crowd out the pillars.
 */

/** Per-field caps, applied before the global ceiling. Pillars get the most
 * headroom because they are the part the model classifies against. */
const FIELD_CAPS = {
  name: 80,
  whatIMake: 320,
  audience: 320,
  voice: 240,
  offers: 200,
  doNots: 200,
  pillarName: 60,
  pillarDescription: 160,
  pillarExample: 90,
} as const;

const MAX_PILLARS = 12;
const MAX_EXAMPLES_PER_PILLAR = 2;

/** How many sections a creator may promote to always-on. Past a handful this
 * stops being identity and starts being the thing selection exists to avoid. */
export const MAX_CORE_BLOCKS = 4;
const CORE_BLOCK_CAP = 400;

function pillarLine(pillar: BrainPillarSource): string {
  const name = clamp(pillar.name, FIELD_CAPS.pillarName);
  const description = clamp(pillar.description, FIELD_CAPS.pillarDescription);
  const examples = pillar.examples
    .map((example) => clamp(example, FIELD_CAPS.pillarExample))
    .filter(Boolean)
    .slice(0, MAX_EXAMPLES_PER_PILLAR);

  let line = `- ${name}`;
  if (description) line += `: ${description}`;
  if (examples.length) line += ` (e.g. ${examples.join("; ")})`;
  return line;
}

export interface CoreOptions {
  maxChars: number;
  /** False for the classification tier, which asks only which pillar something
   * belongs to and cannot use voice or audience to answer it. */
  includeProject?: boolean;
}

/**
 * Build the core block. Returns "" when there is nothing worth saying, so a
 * caller can append it unconditionally without emitting a header that tells the
 * model "here is the context" and then shows it nothing.
 */
export function buildCore(
  project: BrainProjectSource | null,
  pillars: BrainPillarSource[],
  coreBlocks: BrainBlockSource[],
  options: CoreOptions,
): string {
  const includeProject = options.includeProject ?? true;
  const lines: string[] = [];

  if (project && includeProject) {
    const name = clamp(project.name, FIELD_CAPS.name);
    if (name) lines.push(`PROJECT: ${name}`);
    const fields: [string, string, number][] = [
      ["Makes", project.whatIMake, FIELD_CAPS.whatIMake],
      ["Audience", project.audience, FIELD_CAPS.audience],
      ["Voice", project.voice, FIELD_CAPS.voice],
      ["Offers", project.offers, FIELD_CAPS.offers],
      ["Never", project.doNots, FIELD_CAPS.doNots],
    ];
    for (const [label, value, cap] of fields) {
      const text = clamp(value ?? "", cap);
      if (text) lines.push(`${label}: ${text}`);
    }
  }

  const named = pillars
    .filter((pillar) => pillar.name.trim())
    .slice(0, MAX_PILLARS)
    .map(pillarLine);
  if (named.length) lines.push("PILLARS:", ...named);

  // Last, so the global ceiling drops these before it drops who the creator is
  // talking to. A missing rule costs less than a missing audience.
  //
  // A section is pushed as one unit, heading and contents together, because the
  // ceiling below drops units from the end: pushed as two, a tight budget would
  // leave a heading standing over nothing, which reads to a model as a section
  // whose contents it failed to receive.
  if (includeProject) {
    for (const block of coreBlocks.slice(0, MAX_CORE_BLOCKS)) {
      const title = clamp(block.title, 60);
      // No task tokens: a core block is read from the top every time, which is
      // also what keeps this output byte-stable across requests.
      const body = excerptBlock(block, new Set(), CORE_BLOCK_CAP);
      if (!title || !body) continue;
      lines.push(`${title.toUpperCase()}:\n${body}`);
    }
  }

  if (!lines.length) return "";

  // Global ceiling: drop whole units from the end rather than cutting one in
  // half, so a truncated block is still a well-formed one.
  let block = lines.join("\n");
  while (block.length > options.maxChars && lines.length > 1) {
    lines.pop();
    // The pillar heading is the one unit that is not self-contained; without a
    // pillar under it, it is a promise the block does not keep.
    if (lines[lines.length - 1] === "PILLARS:") lines.pop();
    block = lines.join("\n");
  }
  return block.length > options.maxChars
    ? clamp(block, options.maxChars)
    : block;
}
