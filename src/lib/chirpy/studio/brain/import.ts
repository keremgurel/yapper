import type { BrainImportInput } from "../../../../../protocol/app-actions.generated";
import { describePaste, detectPaste } from "@/lib/brain/detect";
import { createKnowledge } from "@/lib/brain/operations/knowledge";
import { chargedIngestProposal } from "@/lib/brain/operations/ingest";
import { StudioActionFailure, type StudioActionDefinition } from "../executor";
import { brainFailure } from "./failure";
import { quoted } from "./labels";
import { latestPaste } from "./paste";

/** Shorter than this is a note Chirpy can write itself with knowledge.add. */
const PASTE_MIN = 120;

/**
 * Add > Paste from the conversation: the creator's paste is parsed with the
 * same code the browser runs, only a sample is sent to be named (the import
 * credit), and the section is filed with the ordinary create.
 */
export const importAction: StudioActionDefinition<BrainImportInput> = {
  async run(input, context) {
    const paste = latestPaste(context.messages, PASTE_MIN);
    if (!paste)
      throw new StudioActionFailure(
        "no_paste",
        "Paste what you want filed into your message, then ask again.",
      );
    const detected = detectPaste(paste);
    const named = await chargedIngestProposal(
      context.request,
      context.userId,
      { shape: describePaste(detected), sample: detected.sample },
      context.signal,
    );
    if (!named.ok) throw brainFailure(named, "that paste");
    const { proposal } = named.value;
    const title = input.title?.trim() || proposal.title;
    const saved = await createKnowledge(context.userId, {
      title,
      kind: detected.kind,
      body: detected.body,
      items: detected.items,
      rows: detected.rows,
      digest: proposal.digest,
      usage: proposal.usage,
      tags: proposal.tags,
      sourceLabel: proposal.sourceLabel || "Pasted to Chirpy",
    });
    if (!saved.ok) throw brainFailure(saved, "that paste");
    return {
      summary: `Filed ${quoted(saved.value.title)} in your Knowledge as ${describePaste(detected)}.`,
      effects: ["brain"],
    };
  },
};
