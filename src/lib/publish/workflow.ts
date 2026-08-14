import { OutboundHttpError } from "@/lib/http/outbound";

export const PUBLISH_WORKFLOW_MS = 270_000;

export interface PublishWorkflow {
  deadlineAt: number;
  requestSignal: AbortSignal;
  signal: AbortSignal;
}

/** The provider may have accepted an irreversible operation, but its response
 * could not be proven. Callers must preserve the idempotency claim as pending. */
export class PublishOutcomeUnknownError extends Error {
  constructor(provider: string, cause?: unknown) {
    super(`${provider}_publish_outcome_unknown`, { cause });
    this.name = "PublishOutcomeUnknownError";
  }
}

export function createPublishWorkflow(
  requestSignal: AbortSignal,
  now = Date.now(),
): PublishWorkflow {
  const timeout = AbortSignal.timeout(PUBLISH_WORKFLOW_MS);
  return {
    deadlineAt: now + PUBLISH_WORKFLOW_MS,
    requestSignal,
    signal: AbortSignal.any([requestSignal, timeout]),
  };
}

export function remainingPublishMs(
  workflow: PublishWorkflow,
  stageCapMs = PUBLISH_WORKFLOW_MS,
): number {
  if (workflow.requestSignal.aborted) {
    throw new OutboundHttpError("aborted", {
      cause: workflow.requestSignal.reason,
    });
  }
  const remaining = workflow.deadlineAt - Date.now();
  if (remaining <= 0) throw new OutboundHttpError("timeout");
  if (workflow.signal.aborted) throw new OutboundHttpError("timeout");
  return Math.min(stageCapMs, remaining);
}

export function publishFailureStatus(
  error: unknown,
  workflow?: PublishWorkflow,
): number {
  if (workflow?.requestSignal.aborted) return 499;
  if (
    workflow?.signal.aborted ||
    (workflow && Date.now() >= workflow.deadlineAt)
  ) {
    return 504;
  }
  if (error instanceof OutboundHttpError) {
    if (error.code === "aborted") return 499;
    if (error.code === "timeout") return 504;
  }
  return 502;
}

/** Retry the small idempotent database write after an irreversible provider
 * success. This deliberately ignores the client signal: disconnecting cannot
 * make an accepted platform post look failed or invite a duplicate. */
export async function persistPublishCompletion(
  write: () => Promise<void>,
): Promise<void> {
  let lastError: unknown;
  for (const delay of [0, 100, 300]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      await write();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
