import { runInvocation } from "./execute";
import type { StudioActionContext } from "./executor";
import {
  finishInvocation,
  invocationID,
  takePending,
  turnInvocations,
  type StudioInvocation,
} from "./receipts";
import type { StudioDecision } from "./typed-decision";
import type {
  StudioActionReceipt,
  StudioEffect,
  StudioTurnReply,
} from "./wire";

function receiptOf(record: StudioInvocation): StudioActionReceipt {
  return {
    invocationID: invocationID(record.executionID, record.index),
    action: record.action,
    status:
      record.status === "pending"
        ? "running"
        : record.status === "canceled"
          ? "canceled"
          : record.status,
    summary: record.summary ?? "",
  };
}

function replyFrom(
  executionID: string,
  records: StudioInvocation[],
  decision: StudioDecision,
): StudioTurnReply {
  const results = records.map(receiptOf);
  const effects = [
    ...new Set(records.flatMap((record) => record.effects ?? [])),
  ] as StudioEffect[];
  if (decision === "cancel")
    return {
      executionID,
      message: "Kept it. Nothing was deleted.",
      tone: "answer",
      notes: [],
      results,
      effects: [],
    };
  const failed = records.find((record) => record.status === "failed");
  return {
    executionID,
    message: failed ? (failed.summary ?? "That didn’t go through.") : "Done.",
    tone: failed ? "trouble" : "done",
    notes: records
      .filter((record) => record.status === "done")
      .map((record) => record.summary ?? "")
      .filter(Boolean),
    results,
    effects,
  };
}

/**
 * Answer a turn's confirmation: run its waiting actions or drop them. No model
 * call and no credit. Runs each action once even when the creator clicks
 * twice or the Mac retries; a later call reports what already happened.
 */
export async function resolveConfirmation(
  context: StudioActionContext,
  executionID: string,
  decision: StudioDecision,
): Promise<StudioTurnReply | null> {
  const taken = await takePending(
    context.userId,
    executionID,
    decision === "confirm" ? "running" : "canceled",
  );
  if (!taken.length) {
    // Already answered (or never existed): report what happened, if anything.
    const earlier = (await turnInvocations(context.userId, executionID)).filter(
      (record) => record.label !== undefined,
    );
    if (
      !earlier.length ||
      earlier.some((record) => record.status === "pending")
    )
      return null;
    const canceled = earlier.every((record) => record.status === "canceled");
    return replyFrom(executionID, earlier, canceled ? "cancel" : "confirm");
  }
  if (decision === "cancel") {
    const canceled = taken.map((record) => ({
      ...record,
      status: "canceled" as const,
      summary: "Kept.",
    }));
    return replyFrom(executionID, canceled, "cancel");
  }
  const finished: StudioInvocation[] = [];
  for (const record of taken) {
    // Stop after a failure, like a turn does, and say the rest never ran.
    if (finished.some((item) => item.status === "failed")) {
      const skipped = { ...record, status: "skipped" as const, summary: "" };
      await finishInvocation(context.userId, skipped);
      finished.push(skipped);
      continue;
    }
    finished.push(
      await runInvocation(context, { ...record, status: "running" }),
    );
  }
  return replyFrom(executionID, finished, "confirm");
}
