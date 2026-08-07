/**
 * The hook archetypes that actually carry short-form openers.
 *
 * This is a versioned library in source rather than a prompt string, for two
 * reasons. The model gets a menu of named mechanisms instead of inventing an
 * angle each time, and every generated hook comes back tagged with the pattern
 * it used, so a creator can see WHY a line should work and ask for three more
 * of the same kind.
 *
 * About 390 tokens for the full menu, or ~40 when narrowed to one pattern.
 * Injected only into hook generation, never into the calls that run on every
 * capture.
 */
export interface HookPattern {
  /** Stable id. Stored on the hook, so renaming a `name` never orphans data. */
  id: string;
  name: string;
  /** Why it works on a scrolling viewer, in one line. */
  mechanism: string;
  whenToUse: string;
  shape: string;
  example: string;
}

export const HOOK_PATTERNS: HookPattern[] = [
  {
    id: "contrarian",
    name: "Contrarian claim",
    mechanism: "Contradicts a belief the viewer holds, so they stay to argue.",
    whenToUse: "The advice in your niche is common and slightly wrong.",
    shape: "<Widely held belief> is wrong. <What is actually true>.",
    example: "Studying more vocabulary is why your score is stuck.",
  },
  {
    id: "negation",
    name: "Stop doing X",
    mechanism:
      "Names a behaviour the viewer recognises in themselves and tells them to drop it.",
    whenToUse: "There is one specific habit costing your audience results.",
    shape: "Stop <specific behaviour>. Do <replacement> instead.",
    example: "Stop rehearsing your answer word for word.",
  },
  {
    id: "stakes",
    name: "Stakes first",
    mechanism: "Leads with the cost of getting it wrong, not the topic.",
    whenToUse: "The consequence is concrete and the viewer already fears it.",
    shape: "<Consequence> because of <small overlooked thing>.",
    example: "People fail this section for one silent habit.",
  },
  {
    id: "cold-open",
    name: "Mid-action cold open",
    mechanism:
      "Starts inside the moment, so the viewer arrives already halfway in.",
    whenToUse: "The content is a story, a demo, or a reaction.",
    shape: "Begin at the most surprising second, no preamble.",
    example: "…and that is when the examiner stopped writing.",
  },
  {
    id: "number",
    name: "Specific-number proof",
    mechanism:
      "A precise number reads as evidence in a way a round one cannot.",
    whenToUse: "You have a real figure, a count, or a timeframe.",
    shape: "<Precise number> <unit> and <outcome>.",
    example: "I recorded 47 takes before one sounded natural.",
  },
  {
    id: "pov",
    name: "POV framing",
    mechanism: "Puts the viewer inside a scene instead of describing it.",
    whenToUse: "The feeling is more recognisable than the fact.",
    shape: "POV: <situation the viewer has been in>.",
    example: "POV: the timer starts and your mind goes blank.",
  },
  {
    id: "enemy",
    name: "Named enemy",
    mechanism:
      "Gives the viewer something to be against, which is stickier than something to be for.",
    whenToUse: "A practice, industry habit, or myth deserves the blame.",
    shape: "<Named thing> is why <problem the viewer has>.",
    example: "Test-prep scripts are why you sound robotic.",
  },
  {
    id: "curiosity",
    name: "Curiosity gap with a payoff",
    mechanism:
      "Opens a specific question the viewer wants closed. Specific, or it reads as clickbait.",
    whenToUse: "You have a genuine reveal to deliver quickly.",
    shape: "<Concrete setup> and <the part that does not add up>.",
    example: "Same answer, two speakers, nine-point gap.",
  },
  {
    id: "credential",
    name: "Credential flash",
    mechanism: "Buys attention with standing before making the claim.",
    whenToUse: "You have earned experience the viewer would care about.",
    shape: "<Credential>, and <the claim it licenses>.",
    example: "I scored these for six years. Here is what we listen for.",
  },
  {
    id: "callout",
    name: "Direct-address callout",
    mechanism:
      "Selects the viewer, so scrolling past feels like being spoken over.",
    whenToUse: "The idea is for a narrow, self-identifying group.",
    shape: "If you <specific situation>, <promise>.",
    example: "If you freeze on question two, this is for you.",
  },
];

const BY_ID = new Map(HOOK_PATTERNS.map((p) => [p.id, p]));

export function hookPattern(id: string | null | undefined): HookPattern | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/** The display name for a stored pattern id. Falls back to the raw id so a hook
 * generated against a pattern that has since been retired still renders as
 * something, rather than silently losing its attribution. */
export function hookPatternName(id: string | null | undefined): string | null {
  if (!id) return null;
  return BY_ID.get(id)?.name ?? id;
}

/**
 * The pattern menu as the prompt sees it.
 *
 * Only the mechanism and one example are sent. `whenToUse` and `shape` are for
 * the creator picking a pattern in the UI; spending prompt tokens restating
 * them buys nothing, since the example already demonstrates the shape. That
 * takes the full menu from roughly 680 tokens down to about 390.
 *
 * `only` narrows the library to one pattern, which is what makes "give me three
 * more, all stakes-first" a genuinely cheaper call than the full menu rather
 * than a post-filter over a generic one.
 */
export function hookPatternBlock(only?: string | null): string {
  const patterns = only
    ? HOOK_PATTERNS.filter((p) => p.id === only)
    : HOOK_PATTERNS;
  if (!patterns.length) return "";
  const lines = patterns.map(
    (p) => `- ${p.id} (${p.name}): ${p.mechanism} e.g. "${p.example}"`,
  );
  return `\n\nHOOK PATTERNS:\n${lines.join("\n")}`;
}
