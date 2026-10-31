import type { IdeaCaptureInput } from "../../../../../protocol/app-actions.generated";
import { updateOwnContentItem } from "@/lib/content/operations/update-item";
import { captureIdea } from "@/lib/ideas/operations/capture";
import { draftSavedIdea } from "@/lib/ideas/operations/draft";
import {
  failureFrom,
  type ActionOutcome,
  type StudioActionContext,
  type StudioActionDefinition,
} from "../executor";
import { ideaLabel } from "./labels";
import { dayLabel, scheduledInstant } from "./when";

/**
 * Bank an idea the way the composer does: words first, then the paid first
 * draft on the same row. Filing and scheduling go through the same update
 * the Ideas controls use. A failed draft keeps the words, as in the composer.
 */
async function run(
  input: IdeaCaptureInput,
  context: StudioActionContext,
): Promise<ActionOutcome> {
  const { userId, timeZone } = context;
  // Checked before anything is saved, so a bad date leaves no half-made idea.
  const at = input.date
    ? scheduledInstant(input.date, input.time, null, timeZone)
    : null;
  const captured = await captureIdea(userId, {
    originalNote: input.note,
    ideaType: "original",
    leadFormat: input.format ?? "short",
  });
  if (!captured.ok) throw failureFrom(captured, "that idea");
  let row = captured.value;
  const notes: string[] = [];
  let partial = false;

  if (input.draft !== false) {
    const drafted = await draftSavedIdea(
      context.request,
      userId,
      row.id,
      context.signal,
    );
    if (drafted.ok) row = drafted.value;
    else {
      partial = true;
      notes.push(
        `${failureFrom(drafted, "the draft").sentence} Your words are saved.`,
      );
    }
  }

  if (input.pillarID || at) {
    const filed = await updateOwnContentItem(userId, row.id, {
      ...(input.pillarID ? { pillarId: input.pillarID } : {}),
      ...(at ? { scheduledFor: at.toISOString() } : {}),
    });
    if (filed.ok) row = filed.value.item;
    else {
      partial = true;
      notes.push(failureFrom(filed, "that idea").sentence);
    }
  }

  const day = row.scheduledFor
    ? ` for ${dayLabel(new Date(row.scheduledFor), timeZone)}`
    : "";
  return {
    summary: [`Created “${ideaLabel(row)}”${day}.`, ...notes].join(" "),
    effects: ["ideas"],
    partial,
  };
}

export const captureAction: StudioActionDefinition<IdeaCaptureInput> = { run };
