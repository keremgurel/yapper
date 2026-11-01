import type { StudioPlan } from "./catalog";
import type { StudioExecution } from "./execute";
import { STUDIO_ACTIONS } from "./registry.generated";
import type { StudioConfirmation, StudioTurnReply } from "./wire";

/** Whether every one of these actions removes something for good, so the
 * question says it can't be undone and the buttons say Delete and Keep it. */
export function onlyDeletions(actions: readonly string[]): boolean {
  return actions.every(
    (id) =>
      STUDIO_ACTIONS.find((action) => action.id === id)?.effect ===
      "destructive",
  );
}

/** The confirmation for a turn's waiting actions, worded from their labels:
 * deletions as before, anything else (a standing rule) as a plain yes or
 * no. */
export function confirmationFor(
  executionID: string,
  pending: StudioExecution["pending"],
): StudioConfirmation | undefined {
  if (!pending.length) return undefined;
  const subjects = pending.map((item, index) =>
    index ? item.label[0].toLowerCase() + item.label.slice(1) : item.label,
  );
  const deletions = onlyDeletions(pending.map((item) => item.action));
  const asked =
    subjects.length === 1
      ? subjects[0]
      : `${subjects.slice(0, -1).join(", ")} and ${subjects.at(-1)}`;
  return deletions
    ? {
        executionID,
        question: `${asked}? This can’t be undone.`,
        confirmLabel: "Delete",
        cancelLabel: "Keep it",
        typedHint: "Reply yes to delete, or no to keep it.",
      }
    : {
        executionID,
        question: `${asked}?`,
        confirmLabel: "Confirm",
        cancelLabel: "Cancel",
        typedHint: "Reply yes to go ahead, or no to leave it as it is.",
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
      : execution.replies.join("\n\n") || plan.message.trim() || "Done.",
    tone: execution.partial ? "trouble" : "done",
  };
}
