import { afterEach, describe, expect, it, vi } from "vitest";
import { OutboundHttpError } from "@/lib/http/outbound";
import {
  createFeedbackWorkflow,
  FEEDBACK_WORKFLOW_MS,
  feedbackFailureStatus,
  remainingFeedbackMs,
} from "./workflow";

afterEach(() => vi.restoreAllMocks());

describe("feedback workflow budget", () => {
  it("uses one absolute deadline and shrinks later stage budgets", () => {
    const workflow = createFeedbackWorkflow(
      new AbortController().signal,
      1_000,
    );
    vi.spyOn(Date, "now").mockReturnValue(101_000);

    expect(workflow.deadlineAt).toBe(1_000 + FEEDBACK_WORKFLOW_MS);
    expect(remainingFeedbackMs(workflow)).toBe(FEEDBACK_WORKFLOW_MS - 100_000);
    expect(remainingFeedbackMs(workflow, 20_000)).toBe(20_000);
  });

  it("rejects expiry before another provider stage starts", () => {
    const workflow = createFeedbackWorkflow(
      new AbortController().signal,
      1_000,
    );
    vi.spyOn(Date, "now").mockReturnValue(1_000 + FEEDBACK_WORKFLOW_MS);

    expect(() => remainingFeedbackMs(workflow)).toThrowError(
      expect.objectContaining({ code: "timeout" }),
    );
    expect(feedbackFailureStatus(new Error("provider"), workflow)).toBe(504);
  });

  it("classifies caller cancellation separately from deadline expiry", () => {
    const controller = new AbortController();
    const workflow = createFeedbackWorkflow(controller.signal);
    controller.abort(new DOMException("gone", "AbortError"));

    expect(() => remainingFeedbackMs(workflow)).toThrowError(OutboundHttpError);
    expect(feedbackFailureStatus(new Error("provider"), workflow)).toBe(499);
  });
});
