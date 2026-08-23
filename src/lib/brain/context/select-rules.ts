import { MAX_LOADED_BLOCKS, MAX_LOADED_SKILLS } from "./budgets";
import type { BrainIndex } from "./digest";
import { overlapScore, tokenize } from "./text";
import type {
  BrainBlockSource,
  BrainSelection,
  BrainSkillSource,
  BrainSurface,
} from "./types";

/**
 * Choosing what to load, without asking a model.
 *
 * This exists for two jobs and it has to be good at both. It is the path taken
 * whenever the router is slow, unavailable, rate limited or wrong-shaped, which
 * makes it the reason a provider hiccup cannot fail a generation. And it is the
 * path taken for surfaces and brains where a router call would not earn its
 * latency.
 *
 * The scoring is intentionally simple enough to explain to a creator: a skill
 * that names this surface is a candidate, and after that everything is ranked
 * by how many distinct words it shares with what is being written.
 */

/** How many surface-declared skills load when nothing matched the task text. A
 * skill that says "use me on scripts" means it, but three of them all claiming
 * the script with no relevance signal is a prompt arguing with itself. */
const DEFAULT_DECLARED_SKILLS = 2;
/** With no task text at all, read the top of the brain rather than nothing. */
const DEFAULT_BLOCKS = 2;

function appliesTo(skill: BrainSkillSource, surface: BrainSurface): boolean {
  return skill.surfaces.length === 0 || skill.surfaces.includes(surface);
}

function declaresSurface(
  skill: BrainSkillSource,
  surface: BrainSurface,
): boolean {
  return skill.surfaces.includes(surface);
}

export interface RuleInput {
  index: BrainIndex;
  blocks: Map<string, BrainBlockSource>;
  skills: Map<string, BrainSkillSource>;
  surface: BrainSurface;
  task: string;
}

export function selectByRules(input: RuleInput): BrainSelection {
  const tokens = tokenize(input.task);

  const skillEntries = input.index.entries.filter(
    (entry) => entry.type === "skill",
  );
  const blockEntries = input.index.entries.filter(
    (entry) => entry.type === "context",
  );

  const scoredSkills = skillEntries
    .map((entry, position) => {
      const skill = input.skills.get(entry.id);
      if (!skill || !appliesTo(skill, input.surface)) return null;
      return {
        ref: entry.ref,
        position,
        declared: declaresSurface(skill, input.surface),
        score: overlapScore(tokens, `${skill.name} ${skill.whenToUse}`),
      };
    })
    .filter((scored): scored is NonNullable<typeof scored> => scored !== null);

  const matched = scoredSkills
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score || a.position - b.position);

  const declared = scoredSkills
    .filter(
      (scored) => scored.declared && !matched.some((m) => m.ref === scored.ref),
    )
    .sort((a, b) => a.position - b.position)
    .slice(0, DEFAULT_DECLARED_SKILLS);

  const skillRefs = [...matched, ...declared]
    .slice(0, MAX_LOADED_SKILLS)
    .map((scored) => scored.ref);

  const scoredBlocks = blockEntries
    .map((entry, position) => {
      const block = input.blocks.get(entry.id);
      if (!block) return null;
      const haystack = `${block.title} ${block.digest} ${block.tags.join(" ")}`;
      return {
        ref: entry.ref,
        position,
        score: overlapScore(tokens, haystack),
      };
    })
    .filter((scored): scored is NonNullable<typeof scored> => scored !== null);

  const hits = scoredBlocks
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .slice(0, MAX_LOADED_BLOCKS);

  const contextRefs = (
    hits.length ? hits : scoredBlocks.slice(0, tokens.size ? 0 : DEFAULT_BLOCKS)
  ).map((scored) => scored.ref);

  return { skillRefs, contextRefs, by: "rules" };
}

/** Load everything routable. Used below the selection floor, where choosing
 * costs more than reading. */
export function selectAll(index: BrainIndex): BrainSelection {
  return {
    skillRefs: index.entries
      .filter((entry) => entry.type === "skill")
      .map((entry) => entry.ref),
    contextRefs: index.entries
      .filter((entry) => entry.type === "context")
      .map((entry) => entry.ref),
    by: "all",
  };
}
