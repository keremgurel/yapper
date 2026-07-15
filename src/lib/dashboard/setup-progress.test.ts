import { describe, expect, it } from "vitest";
import {
  nextSetupStep,
  setupProgress,
  setupSteps,
  type StudioSignals,
} from "@/lib/dashboard/setup-progress";

const NONE: StudioSignals = {
  hasInspiration: false,
  hasContent: false,
  hasRecording: false,
  hasConnection: false,
  hasPosted: false,
};

describe("setupSteps", () => {
  it("lists the five steps in flow order", () => {
    expect(setupSteps(NONE).map((s) => s.id)).toEqual([
      "inspiration",
      "content",
      "record",
      "connect",
      "post",
    ]);
  });

  it("flags each step done from its matching signal", () => {
    const steps = setupSteps({ ...NONE, hasRecording: true });
    const byId = Object.fromEntries(steps.map((s) => [s.id, s.done]));
    expect(byId.record).toBe(true);
    expect(byId.inspiration).toBe(false);
    expect(byId.post).toBe(false);
  });
});

describe("nextSetupStep", () => {
  it("is the first step when nothing is done", () => {
    expect(nextSetupStep(setupSteps(NONE))?.id).toBe("inspiration");
  });

  it("skips completed steps to the earliest undone one", () => {
    // Inspiration + content done, but record is not: nudge record next, even
    // though a LATER step (connect) is also undone.
    const steps = setupSteps({
      ...NONE,
      hasInspiration: true,
      hasContent: true,
    });
    expect(nextSetupStep(steps)?.id).toBe("record");
  });

  it("is null once every step is done", () => {
    const all = setupSteps({
      hasInspiration: true,
      hasContent: true,
      hasRecording: true,
      hasConnection: true,
      hasPosted: true,
    });
    expect(nextSetupStep(all)).toBeNull();
  });
});

describe("setupProgress", () => {
  it("counts completed steps and reports completion", () => {
    expect(setupProgress(setupSteps(NONE))).toEqual({
      done: 0,
      total: 5,
      complete: false,
    });
    expect(
      setupProgress(setupSteps({ ...NONE, hasContent: true, hasPosted: true })),
    ).toEqual({ done: 2, total: 5, complete: false });
    const all = setupSteps({
      hasInspiration: true,
      hasContent: true,
      hasRecording: true,
      hasConnection: true,
      hasPosted: true,
    });
    expect(setupProgress(all).complete).toBe(true);
  });
});
