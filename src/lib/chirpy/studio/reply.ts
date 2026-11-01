import { studioExecutor } from "./actions";
import type { StudioPlan } from "./catalog";
import type { StudioExecution } from "./execute";
import { STUDIO_ACTIONS, type StudioActionID } from "./registry.generated";
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
 * deletions say it can't be undone with Delete and Keep it, anything else
 * (a standing rule) is a plain Confirm or Cancel. When every waiting action
 * names the same button of its own (`confirm` on its executor, such as
 * Cancel it for a scheduled post), that button, note and cancel word win. */
export function confirmationFor(
  executionID: string,
  pending: StudioExecution["pending"],
): StudioConfirmation | undefined {
  if (!pending.length) return undefined;
  const subjects = pending.map((item, index) =>
    index ? item.label[0].toLowerCase() + item.label.slice(1) : item.label,
  );
  const asked =
    subjects.length === 1
      ? subjects[0]
      : `${subjects.slice(0, -1).join(", ")} and ${subjects.at(-1)}`;
  const deletions = onlyDeletions(pending.map((item) => item.action));
  const fallback = deletions
    ? { label: "Delete", note: "This can’t be undone.", cancel: "Keep it" }
    : { label: "Confirm", note: undefined, cancel: "Cancel" };
  const own = pending.map(
    (item) => studioExecutor(item.action as StudioActionID)?.confirm,
  );
  const style =
    own[0] && own.every((style) => style?.label === own[0]!.label)
      ? { ...own[0], cancel: own[0].cancel ?? fallback.cancel }
      : fallback;
  return {
    executionID,
    question: [`${asked}?`, style.note].filter(Boolean).join(" "),
    confirmLabel: style.label,
    cancelLabel: style.cancel,
    typedHint:
      style === fallback && !deletions
        ? "Reply yes to go ahead, or no to leave it as it is."
        : `Reply yes to ${style.label.toLowerCase()}, or no to ${style.cancel.toLowerCase()}.`,
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
      : execution.replies.join("\n\n") || plan.message.trim() || "Done.",
    tone: execution.partial ? "trouble" : "done",
  };
}
