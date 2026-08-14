import { describe, expect, it, vi } from "vitest";
import { OutboundHttpError } from "@/lib/http/outbound";
import {
  createPublishWorkflow,
  PUBLISH_WORKFLOW_MS,
  persistPublishCompletion,
  remainingPublishMs,
} from "./workflow";

describe("publish workflow budget", () => {
  it("starts one absolute budget and exposes only the remaining stage time", () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValueOnce(2_500);
    const workflow = createPublishWorkflow(new AbortController().signal, 1_000);

    expect(workflow.deadlineAt).toBe(1_000 + PUBLISH_WORKFLOW_MS);
    expect(remainingPublishMs(workflow, 20_000)).toBe(20_000);
    vi.restoreAllMocks();
  });

  it("rejects an expired workflow before another provider call starts", () => {
    const workflow = {
      deadlineAt: 1_000,
      requestSignal: new AbortController().signal,
      signal: new AbortController().signal,
    };
    vi.spyOn(Date, "now").mockReturnValue(1_001);

    expect(() => remainingPublishMs(workflow)).toThrowError(OutboundHttpError);
    vi.restoreAllMocks();
  });

  it("propagates caller cancellation", () => {
    const controller = new AbortController();
    const workflow = createPublishWorkflow(controller.signal, Date.now());
    controller.abort(new DOMException("aborted", "AbortError"));

    expect(() => remainingPublishMs(workflow)).toThrowError(
      expect.objectContaining({ code: "aborted" }),
    );
  });

  it("retries the idempotent completion write without a request signal", async () => {
    vi.useFakeTimers();
    const write = vi
      .fn()
      .mockRejectedValueOnce(new Error("db unavailable"))
      .mockRejectedValueOnce(new Error("db unavailable"))
      .mockResolvedValueOnce(undefined);

    const completion = persistPublishCompletion(write);
    await vi.runAllTimersAsync();

    await expect(completion).resolves.toBeUndefined();
    expect(write).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
