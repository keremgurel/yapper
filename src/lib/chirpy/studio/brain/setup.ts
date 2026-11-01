import type { BrainSetupInput } from "../../../../../protocol/app-actions.generated";
import { createKnowledge } from "@/lib/brain/operations/knowledge";
import { saveProjectBrain } from "@/lib/brain/operations/project";
import { chargedSetupProposal } from "@/lib/brain/operations/setup";
import {
  blocksFor,
  projectPatchFor,
  selectEverything,
} from "@/lib/brain/setup-client";
import { SETUP_DOCUMENT_MAX } from "@/lib/brain/setup";
import type { SetupEssentialKey } from "@/lib/brain/setup-types";
import { clamp } from "@/lib/brain/context/text";
import { listPillars } from "@/lib/db/project-pillars";
import { getActiveProject } from "@/lib/db/projects";
import { parsePillarInput, parseProjectInput } from "@/lib/project/input";
import { StudioActionFailure, type StudioActionDefinition } from "../executor";
import { plural } from "../ideas/labels";
import { brainFailure } from "./failure";
import { ESSENTIAL_LABELS, joined } from "./labels";
import { latestPaste } from "./paste";

/** A message this long is a document; anything shorter is a request. */
const DOCUMENT_MIN = 200;

/**
 * "Set up from a document" from the conversation: the same charged reading,
 * then the sheet's Apply with everything ticked, except that pillars are
 * always added to the ones the creator has. Removing a pillar unfiles its
 * ideas, which Chirpy only does after asking.
 */
export const setupAction: StudioActionDefinition<BrainSetupInput> = {
  async run(_input, context) {
    const { userId } = context;
    const document = latestPaste(context.messages, DOCUMENT_MIN);
    if (!document)
      throw new StudioActionFailure(
        "no_document",
        "Paste the document about your content into your message, then ask again. For a file, use Set up from a document on the Brain tab.",
      );
    const read = await chargedSetupProposal(
      context.request,
      userId,
      document.slice(0, SETUP_DOCUMENT_MAX),
      context.signal,
    );
    if (!read.ok) throw brainFailure(read, "that document");
    const { proposal } = read.value;

    const project = await getActiveProject(userId);
    const existing = await listPillars(project.id);
    const selection = {
      ...selectEverything(proposal, existing.length),
      pillarMode: "add" as const,
    };
    const patch = projectPatchFor(proposal, selection, existing);
    const fields = Object.keys(proposal.essentials).filter(
      (key) => proposal.essentials[key as SetupEssentialKey],
    );
    const newPillars = proposal.pillars.filter(
      (pillar) =>
        !existing.some(
          (row) => row.name.toLowerCase() === pillar.name.toLowerCase(),
        ),
    ).length;
    if (patch) {
      const saved = await saveProjectBrain(
        userId,
        parseProjectInput(patch as Record<string, unknown>),
        parsePillarInput(patch.pillars),
      );
      if (!saved.ok) throw brainFailure(saved, "your Brain");
    }
    let sections = 0;
    for (const block of blocksFor(proposal, selection)) {
      const saved = await createKnowledge(userId, block);
      if (saved.ok) sections += 1;
    }

    const landed = [
      fields.length
        ? `filled ${joined(fields.map((key) => ESSENTIAL_LABELS[key]))}`
        : "",
      newPillars ? `added ${plural(newPillars, "pillar")}` : "",
      sections ? `added ${plural(sections, "Knowledge section")}` : "",
    ].filter(Boolean);
    const notes = proposal.notes.trim();
    return {
      summary: [
        landed.length
          ? `Set up your Brain: ${joined(landed)}.`
          : "That document didn’t add anything new to your Brain.",
        notes ? `Not covered: ${clamp(notes, 200)}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      effects: ["brain"],
      partial: sections < proposal.blocks.length,
    };
  },
};
