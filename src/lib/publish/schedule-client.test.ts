import { describe, expect, it } from "vitest";
import {
  scheduleErrorMessage,
  scheduleRowErrorMessage,
} from "./schedule-client";

describe("scheduleRowErrorMessage", () => {
  it("uses the copy for a known error", () => {
    expect(
      scheduleRowErrorMessage({ status: "failed", error: "upload_failed" }),
    ).toBe(scheduleErrorMessage(new Error("upload_failed")));
  });

  it("falls back by state for a provider's raw error text", () => {
    expect(
      scheduleRowErrorMessage({
        status: "failed",
        error: "connect ECONNREFUSED 127.0.0.1:9",
      }),
    ).toBe(scheduleErrorMessage(new Error("publish_failed")));
    expect(
      scheduleRowErrorMessage({ status: "needs_attention", error: null }),
    ).toBe(scheduleErrorMessage(new Error("publish_state_pending")));
  });
});
