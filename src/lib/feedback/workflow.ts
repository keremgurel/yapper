import { OutboundHttpError } from "@/lib/http/outbound";

export const FEEDBACK_WORKFLOW_MS = 270_000;

export interface FeedbackWorkflow {
  deadlineAt: number;
  requestSignal: AbortSignal;
  signal: AbortSignal;
}

/** One absolute budget for ingress, entitlement, provider work, and the final
 * database transaction. It deliberately leaves 30 seconds under the route's
 * 300-second platform ceiling for failure bookkeeping and the response. */
export function createFeedbackWorkflow(
  requestSignal: AbortSignal,
  now = Date.now(),
): FeedbackWorkflow {
  const timeout = AbortSignal.timeout(FEEDBACK_WORKFLOW_MS);
  return {
    deadlineAt: now + FEEDBACK_WORKFLOW_MS,
    requestSignal,
    signal: AbortSignal.any([requestSignal, timeout]),
  };
}

export function remainingFeedbackMs(
  workflow: FeedbackWorkflow,
  stageCapMs = FEEDBACK_WORKFLOW_MS,
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

export function feedbackFailureStatus(
  error: unknown,
  workflow: FeedbackWorkflow,
): number {
  if (workflow.requestSignal.aborted) return 499;
  if (workflow.signal.aborted || Date.now() >= workflow.deadlineAt) return 504;
  if (error instanceof OutboundHttpError) {
    if (error.code === "aborted") return 499;
    if (error.code === "timeout") return 504;
  }
  return 502;
}
