import type { NewBrainBlock } from "@/lib/brain/client";
import type {
  BrainSetupProposal,
  SetupEssentialKey,
  SetupPillar,
} from "@/lib/brain/setup";
import type { PillarDraft, ProjectPatch } from "@/lib/project/client";

/** Where a document handed to Chirpy waits until the Brain page opens. */
export const SETUP_HANDOFF_KEY = "yapper.brain.setup-document";

export async function proposeSetup(
  document: string,
  signal?: AbortSignal,
): Promise<BrainSetupProposal> {
  const res = await fetch("/api/brain/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document }),
    signal,
  });
  if (!res.ok) throw new Error(`setup_${res.status}`);
  return ((await res.json()) as { proposal: BrainSetupProposal }).proposal;
}

/** What the creator chose to keep from a proposal. */
export interface SetupSelection {
  essentials: Set<SetupEssentialKey>;
  pillarMode: "replace" | "add";
  pillars: Set<string>;
  blocks: Set<string>;
}

export function selectEverything(
  proposal: BrainSetupProposal,
  existingPillars: number,
): SetupSelection {
  return {
    essentials: new Set(
      Object.keys(proposal.essentials) as SetupEssentialKey[],
    ),
    // A document that lays out a full pillar system is meant to be the
    // pillar system; a single pillar is more likely an addition.
    pillarMode:
      proposal.pillars.length >= 2 || existingPillars === 0 ? "replace" : "add",
    pillars: new Set(proposal.pillars.map((pillar) => pillar.name)),
    blocks: new Set(proposal.blocks.map((block) => block.title)),
  };
}

/** The project patch an application needs, or null when nothing was chosen. */
export function projectPatchFor(
  proposal: BrainSetupProposal,
  selection: SetupSelection,
  existing: PillarDraft[],
): ProjectPatch | null {
  const patch: ProjectPatch = {};
  for (const key of selection.essentials) {
    const value = proposal.essentials[key];
    if (value) patch[key] = value;
  }
  const chosen = proposal.pillars.filter((pillar) =>
    selection.pillars.has(pillar.name),
  );
  if (chosen.length) patch.pillars = mergePillars(chosen, existing, selection);
  return Object.keys(patch).length ? patch : null;
}

function mergePillars(
  chosen: SetupPillar[],
  existing: PillarDraft[],
  selection: SetupSelection,
): PillarDraft[] {
  const drafts: PillarDraft[] =
    selection.pillarMode === "replace"
      ? []
      : existing.map((pillar) => ({
          id: pillar.id,
          name: pillar.name,
          description: pillar.description,
          examples: pillar.examples,
        }));
  for (const pillar of chosen) {
    const match = drafts.find(
      (draft) => draft.name.toLowerCase() === pillar.name.toLowerCase(),
    );
    if (match) {
      match.description = pillar.description || match.description;
      match.examples = pillar.examples.length
        ? pillar.examples
        : match.examples;
    } else {
      const kept = existing.find(
        (candidate) =>
          candidate.name.toLowerCase() === pillar.name.toLowerCase(),
      );
      drafts.push({ id: kept?.id, ...pillar });
    }
  }
  return drafts;
}

export function blocksFor(
  proposal: BrainSetupProposal,
  selection: SetupSelection,
): NewBrainBlock[] {
  return proposal.blocks
    .filter((block) => selection.blocks.has(block.title))
    .map((block) => ({
      title: block.title,
      body: block.body,
      digest: block.digest,
      tags: block.tags,
      usage: block.usage,
    }));
}
