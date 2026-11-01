import { studioExecutor } from "./actions";
import type { StudioPlan } from "./catalog";
import type { StudioActionID } from "./registry.generated";
import type { StudioExecution } from "./execute";
import type { StudioConfirmation, StudioTurnReply } from "./wire";

/** The confirmation for a turn's waiting actions, worded from their labels. */
export function confirmationFor(
  executionID: string,
  pending: StudioExecution["pending"],
): StudioConfirmation | undefined {
  if (!pending.length) return undefined;
  const subjects = pending.map((item) => item.label);
  // Deletions say Delete and that it can't be undone; other actions that ask
  // first carry their own button and note.
  const styles = pending.map(
    (item) =>
      studioExecutor(item.action as StudioActionID)?.confirm ?? {
        label: "Delete",
        note: "This can’t be undone.",
      },
  );
  const same = styles.every((style) => style.label === styles[0].label);
  const label = same ? styles[0].label : "Confirm";
  const notes = [...new Set(styles.map((style) => style.note).filter(Boolean))];
  const ask =
    subjects.length === 1
      ? subjects[0]
      : `${subjects.slice(0, -1).join(", ")} and ${subjects.at(-1)!.replace(/^\p{Lu}/u, (letter) => letter.toLowerCase())}`;
  return {
    executionID,
    question: [`${ask}?`, ...notes].join(" "),
    confirmLabel: label,
    typedHint: `Reply yes to ${label.toLowerCase()}, or no to keep it.`,
  };
}

/**
 * What the creator reads after a turn. The receipts are the truth: the
 * model's sentence is shown only when every change it describes happened,
 * and a failure is reported in the failing action's own words.
 */
export function turnReply(
  executionID: string,
  plan: StudioPlan,
  execution: StudioExecution,
): StudioTurnReply {
  const done = execution.receipts.filter(
    (receipt) => receipt.status === "done" || receipt.status === "running",
  );
  const failed = execution.receipts.find(
    (receipt) => receipt.status === "failed",
  );
  const skipped = execution.receipts.some(
    (receipt) => receipt.status === "skipped",
  );
  const confirm = confirmationFor(executionID, execution.pending);
  const base = {
    executionID,
    notes: done.map((receipt) => receipt.summary).filter(Boolean),
    results: execution.receipts,
    effects: execution.effects,
    ...(confirm ? { confirm } : {}),
    ...(execution.open ? { open: execution.open } : {}),
  };
  if (!plan.actions.length)
    return { ...base, message: plan.message, tone: "answer" };
  if (failed)
    return {
      ...base,
      message: skipped
        ? `${failed.summary} I stopped there, so nothing after it changed.`
        : failed.summary,
      tone: "trouble",
    };
  if (!done.length) return { ...base, message: "", tone: "answer" };
  return {
    ...base,
    message: execution.partial
      ? "Part of that didn’t go through; the notes say what changed."
      : plan.message.trim() || "Done.",
    tone: execution.partial ? "trouble" : "done",
  };
}
