import { excerptBlock } from "./excerpt";
import type { BrainIndex } from "./digest";
import { clampBlock, tokenize } from "./text";
import type {
  BrainBlockSource,
  BrainSelection,
  BrainSkillSource,
  BrainUsed,
} from "./types";

/**
 * The selected half of the brain, written out.
 *
 * Skills are rendered close to whole, because a procedure with its last two
 * steps cut off is worse than no procedure. Sections are excerpted, because
 * they are evidence and the relevant part of the evidence is the point.
 *
 * That difference is why the budget is split before anything is rendered rather
 * than filled first-come: a long imported document would otherwise eat the room
 * a skill needed to be followable.
 */

/** Share of the loaded budget reserved for sections when any were selected.
 * The larger remainder goes to skills, which is the right way round: a skill
 * changes what gets written, a section only changes what it is about. */
const BLOCK_SHARE = 0.45;
const MIN_SKILL_CHARS = 200;

export interface RenderedBrain {
  text: string;
  used: BrainUsed;
}

function renderSkill(skill: BrainSkillSource, maxChars: number): string {
  const instructions = clampBlock(skill.instructions, maxChars);
  if (!instructions) return "";
  return `SKILL: ${skill.name}\n${instructions}`;
}

function renderBlock(
  block: BrainBlockSource,
  task: Set<string>,
  maxChars: number,
): string {
  const heading = `${block.title.toUpperCase()}${block.sourceLabel ? ` (${block.sourceLabel})` : ""}:`;
  const body = excerptBlock(block, task, maxChars - heading.length - 1);
  return body ? `${heading}\n${body}` : "";
}

/**
 * Render a selection. Anything that does not fit is dropped whole rather than
 * truncated into nonsense, and what was actually rendered comes back in `used`
 * so the page can tell the creator what the model read.
 */
export function renderSelection(
  selection: BrainSelection,
  index: BrainIndex,
  blocks: Map<string, BrainBlockSource>,
  skills: Map<string, BrainSkillSource>,
  task: string,
  maxChars: number,
): RenderedBrain {
  const used: BrainUsed = { skills: [], context: [] };
  if (maxChars <= 0) return { text: "", used };

  const byRef = new Map(index.entries.map((entry) => [entry.ref, entry]));
  const chosenSkills = selection.skillRefs
    .map((ref) => skills.get(byRef.get(ref)?.id ?? ""))
    .filter((skill): skill is BrainSkillSource => Boolean(skill));
  const chosenBlocks = selection.contextRefs
    .map((ref) => blocks.get(byRef.get(ref)?.id ?? ""))
    .filter((block): block is BrainBlockSource => Boolean(block));

  const blockBudget = chosenBlocks.length
    ? Math.floor(maxChars * BLOCK_SHARE)
    : 0;
  let skillRoom = maxChars - blockBudget;
  let blockRoom = blockBudget;

  const parts: string[] = [];

  // Even shares, with whatever a short skill did not need passing to the next.
  let remainingSkills = chosenSkills.length;
  for (const skill of chosenSkills) {
    const share = Math.floor(skillRoom / remainingSkills);
    remainingSkills -= 1;
    if (share < MIN_SKILL_CHARS) break;
    const text = renderSkill(skill, share);
    if (!text) continue;
    parts.push(text);
    skillRoom -= text.length + 1;
    used.skills.push(skill.name);
  }

  // Skills rarely spend their whole allowance; the leftover goes to evidence
  // rather than back to the provider.
  blockRoom += Math.max(0, skillRoom);

  const tokens = tokenize(task);
  let remainingBlocks = chosenBlocks.length;
  for (const block of chosenBlocks) {
    const share = Math.floor(blockRoom / remainingBlocks);
    remainingBlocks -= 1;
    if (share <= 0) break;
    const text = renderBlock(block, tokens, share);
    if (!text) continue;
    parts.push(text);
    blockRoom -= text.length + 1;
    used.context.push(block.title);
  }

  return { text: parts.join("\n\n"), used };
}
