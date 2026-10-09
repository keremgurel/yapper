import { describe, expect, it } from "vitest";
import { brainStarted, setupSteps } from "@/components/studio-home/setup-steps";
import type { ProjectPayload } from "@/lib/project/client";

function payload(fields: Partial<ProjectPayload["project"]>, pillars = 0) {
  return {
    project: {
      whatIMake: "",
      audience: "",
      voice: "",
      ...fields,
    },
    pillars: Array.from({ length: pillars }, (_, index) => ({
      id: String(index),
    })),
  } as unknown as ProjectPayload;
}

describe("brainStarted", () => {
  it("is false for an untouched Brain", () => {
    expect(brainStarted(payload({}))).toBe(false);
    expect(brainStarted(payload({ voice: "   " }))).toBe(false);
  });

  it("is true once any essential or pillar exists", () => {
    expect(brainStarted(payload({ audience: "Founders" }))).toBe(true);
    expect(brainStarted(payload({}, 1))).toBe(true);
  });
});

describe("setupSteps", () => {
  it("marks each step from the creator's state", () => {
    const steps = setupSteps({ brain: true, channel: false, idea: true });
    expect(steps.map((step) => [step.id, step.done])).toEqual([
      ["idea", true],
      ["brain", true],
      ["channel", false],
    ]);
  });
});
