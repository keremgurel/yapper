import type { ProjectPayload } from "@/lib/project/client";

export type SetupStepId = "brain" | "channel" | "idea";

export interface SetupStep {
  id: SetupStepId;
  title: string;
  detail: string;
  done: boolean;
  /** Where the step is finished. The idea step has none: the composer is
   * right above it. */
  action?: { label: string; href: string };
}

/** The Brain counts as started once the creator has said anything about what
 * they make, who it is for, or how they sound, or has a pillar. */
export function brainStarted(payload: ProjectPayload): boolean {
  const { whatIMake, audience, voice } = payload.project;
  return (
    [whatIMake, audience, voice].some((field) => field?.trim()) ||
    payload.pillars.length > 0
  );
}

/** The three things a new creator does once. Home shows them until all three
 * are done, then never again. */
export function setupSteps(state: {
  brain: boolean;
  channel: boolean;
  idea: boolean;
}): SetupStep[] {
  return [
    {
      id: "idea",
      title: "Capture your first idea",
      detail: "Type it or say it above. Yapper turns it into a script.",
      done: state.idea,
    },
    {
      id: "brain",
      title: "Teach Yapper your voice",
      detail: "Tell it what you make and who it’s for.",
      done: state.brain,
      action: { label: "Open Brain", href: "/studio/brain" },
    },
    {
      id: "channel",
      title: "Connect a channel",
      detail: "Publish from Studio and see which posts land.",
      done: state.channel,
      action: { label: "Connect", href: "/studio/connections" },
    },
  ];
}
