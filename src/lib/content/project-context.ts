/**
 * Compile a creator's project into the compact context block every AI call
 * receives. Pure and dependency-free so the exact prompt text can be unit
 * tested without a database or a provider.
 *
 * Two rules drive the whole design:
 *
 * 1. Byte-stability. The block is deterministic for a given project, so it can
 *    sit at the very start of a system prompt and be served from the provider's
 *    prompt cache on every repeat call. Never interpolate timestamps, counts,
 *    or anything else that changes between requests.
 * 2. A hard ceiling. Fields are free text a creator can paste an essay into.
 *    Every field is truncated individually, so one rambling answer cannot
 *    crowd out the pillars.
 */

/** The project fields the block is built from (a structural subset of the DB
 * row, so callers can pass a row straight in). */
export interface ProjectContextSource {
  name: string;
  whatIMake: string;
  audience: string;
  voice: string;
  offers: string;
  doNots: string;
}

export interface PillarContextSource {
  name: string;
  description: string;
  examples: string[];
}

/** One section of the brain the creator wrote themselves. Prose blocks carry
 * `body`, collected ones carry `items`; a block can hold both. */
export interface BrainBlockContextSource {
  title: string;
  body: string;
  items: string[];
  /** False for a block the creator keeps out of prompts. */
  inContext: boolean;
}

/**
 * How much context a given call needs.
 * - `pillars`: classification only (which bucket does this belong to).
 * - `full`: writing (expansion, hooks, script, chat), where voice and audience
 *   change the output rather than just the label.
 */
export type ContextTier = "pillars" | "full";

export interface ProjectContextOptions {
  tier?: ContextTier;
  /** The creator's own sections, in their own order. */
  blocks?: BrainBlockContextSource[];
  /** Characters, not tokens, since that is what we can actually measure. Set
   * around 4 chars/token; the default is a ~400 token ceiling. */
  maxChars?: number;
}

// Raised from 1600 when the brain gained blocks the creator writes themselves.
// The fixed fields answer the questions every creator has; the blocks answer
// the ones only this one has, and they are worth the room.
const DEFAULT_MAX_CHARS = 2400;

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

const BLOCK_CAPS = {
  title: 60,
  body: 400,
  item: 120,
} as const;
const MAX_BLOCKS = 12;
const MAX_ITEMS_PER_BLOCK = 8;

/** Collapse whitespace and cap length. Truncation is on a word boundary so the
 * block never ends mid-word, which reads as corrupted to both humans and
 * models. */
function clamp(value: string, max: number): string {
  const flat = value.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function pillarLine(pillar: PillarContextSource): string {
  const name = clamp(pillar.name, FIELD_CAPS.pillarName);
  const description = clamp(pillar.description, FIELD_CAPS.pillarDescription);
  const examples = pillar.examples
    .map((e) => clamp(e, FIELD_CAPS.pillarExample))
    .filter(Boolean)
    .slice(0, MAX_EXAMPLES_PER_PILLAR);

  let line = `- ${name}`;
  if (description) line += `: ${description}`;
  if (examples.length) line += ` (e.g. ${examples.join("; ")})`;
  return line;
}

/** One brain block, as its heading and what is under it. */
function blockLines(block: BrainBlockContextSource): string[] {
  if (!block.inContext) return [];
  const title = clamp(block.title, BLOCK_CAPS.title);
  if (!title) return [];

  const body = clamp(block.body ?? "", BLOCK_CAPS.body);
  const items = (block.items ?? [])
    .map((item) => clamp(item, BLOCK_CAPS.item))
    .filter(Boolean)
    .slice(0, MAX_ITEMS_PER_BLOCK);
  if (!body && !items.length) return [];

  const lines = [`${title.toUpperCase()}:`];
  if (body) lines.push(body);
  lines.push(...items.map((item) => `- ${item}`));
  return lines;
}

/**
 * Build the block. Returns an empty string when there is nothing worth saying,
 * so callers can append it unconditionally without emitting a stray header that
 * would tell the model "here is the context" and then show it nothing.
 */
export function buildProjectContext(
  project: ProjectContextSource | null,
  pillars: PillarContextSource[],
  options: ProjectContextOptions = {},
): string {
  const tier = options.tier ?? "full";
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const lines: string[] = [];

  if (project && tier === "full") {
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
    .filter((p) => p.name.trim())
    .slice(0, MAX_PILLARS)
    .map(pillarLine);
  if (named.length) {
    lines.push("PILLARS:", ...named);
  }

  // Last, so the global ceiling drops these before it drops who the creator is
  // talking to. A missing hook list costs less than a missing audience.
  if (tier === "full") {
    for (const block of (options.blocks ?? []).slice(0, MAX_BLOCKS)) {
      const section = blockLines(block);
      if (section.length) lines.push(...section);
    }
  }

  if (!lines.length) return "";

  // Global ceiling: drop whole lines from the end rather than cutting one in
  // half, so a truncated block is still a well-formed one.
  let block = lines.join("\n");
  while (block.length > maxChars && lines.length > 1) {
    lines.pop();
    block = lines.join("\n");
  }
  return block.length > maxChars ? clamp(block, maxChars) : block;
}

/**
 * Wrap the block for appending to a system prompt. Empty in, empty out, so a
 * creator who has filled nothing in gets today's behaviour unchanged instead of
 * a prompt asserting context that is not there.
 *
 * Appended rather than prepended, deliberately. Both orderings are byte-stable
 * for one creator, so both cache across their repeated calls; putting the fixed
 * instructions first additionally makes that prefix identical for every user,
 * so it can cache across creators too.
 */
export function projectContextSection(block: string): string {
  if (!block.trim()) return "";
  return (
    "\n\nTHE CREATOR'S STANDING CONTEXT. Treat it as ground truth about who " +
    "they are and who they are talking to. Write for this audience in this " +
    "voice; never restate it back to them.\n\n" +
    block
  );
}
