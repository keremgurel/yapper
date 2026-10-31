import { studioExecutor } from "./actions";
import type { StudioPlan } from "./catalog";
import {
  StudioActionFailure,
  type StudioActionContext,
  type StudioNames,
} from "./executor";
import {
  claimInvocation,
  finishInvocation,
  invocationID,
  type StudioInvocation,
} from "./receipts";
import { STUDIO_ACTIONS } from "./registry.generated";
import type { StudioActionReceipt, StudioEffect } from "./wire";

export interface StudioExecution {
  receipts: StudioActionReceipt[];
  /** Actions waiting for the creator, with their question subjects. */
  pending: { invocationID: string; action: string; label: string }[];
  effects: StudioEffect[];
  partial: boolean;
}

function receiptOf(record: StudioInvocation): StudioActionReceipt {
  return {
    invocationID: invocationID(record.executionID, record.index),
    action: record.action,
    status: record.status === "pending" ? "running" : record.status,
    summary: record.summary ?? "",
  };
}

/**
 * Run one claimed invocation and save its result. A failure is saved too, so
 * a retry reports it instead of trying an uncertain change again.
 */
export async function runInvocation(
  context: StudioActionContext,
  record: StudioInvocation,
): Promise<StudioInvocation> {
  let finished: StudioInvocation;
  try {
    const outcome = await studioExecutor(
      record.action as (typeof STUDIO_ACTIONS)[number]["id"],
    ).run(record.arguments, context);
    finished = { ...record, status: "done", ...outcome };
  } catch (error) {
    if (!(error instanceof StudioActionFailure))
      console.error(
        "[chirpy/studio] action failed",
        record.action,
        error instanceof Error ? error.message : "unknown",
      );
    finished = {
      ...record,
      status: "failed",
      summary:
        error instanceof StudioActionFailure
          ? error.sentence
          : "That change didn’t go through. Check your ideas before trying again.",
    };
  }
  await finishInvocation(context.userId, finished);
  return finished;
}

/**
 * Run a validated plan's server actions in order, each once per invocation
 * ID. Actions that ask first are saved as pending and wait for
 * /api/chirpy/confirm. After a failure the rest are skipped, so a later step
 * never acts on an earlier one that did not happen.
 */
export async function executeStudioPlan(
  context: StudioActionContext,
  projectID: string,
  executionID: string,
  plan: StudioPlan,
  names: StudioNames,
): Promise<StudioExecution> {
  const execution: StudioExecution = {
    receipts: [],
    pending: [],
    effects: [],
    partial: false,
  };
  let stopped = false;
  for (const [index, call] of plan.actions.entries()) {
    const descriptor = STUDIO_ACTIONS.find((item) => item.id === call.action)!;
    const definition = studioExecutor(descriptor.id);
    const base: StudioInvocation = {
      kind: "studio-action",
      executionID,
      index,
      action: call.action,
      arguments: call.arguments,
      status: descriptor.confirm ? "pending" : "running",
      ...(descriptor.confirm
        ? { label: definition.describe?.(call.arguments, names) ?? call.action }
        : {}),
    };
    if (stopped) {
      execution.receipts.push({
        invocationID: invocationID(executionID, index),
        action: call.action,
        status: "skipped",
        summary: "",
      });
      continue;
    }
    const existing = await claimInvocation(context.userId, projectID, base);
    let record = existing ?? base;
    if (!existing && !descriptor.confirm)
      record = await runInvocation(context, base);

    if (record.status === "pending") {
      execution.pending.push({
        invocationID: invocationID(executionID, index),
        action: record.action,
        label: record.label ?? record.action,
      });
      continue;
    }
    if (record.status === "running" && existing) {
      // Another request owns this run. It reports its own result; this one
      // says the change is still being made rather than starting it again.
      record = {
        ...record,
        summary: "Still working on that change. Check your ideas in a moment.",
      };
    }
    execution.receipts.push(receiptOf(record));
    for (const effect of record.effects ?? [])
      if (!execution.effects.includes(effect)) execution.effects.push(effect);
    if (record.partial) execution.partial = true;
    if (record.status === "failed") stopped = true;
  }
  return execution;
}
