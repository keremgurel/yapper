/**
 * The dashboard's personalization brain: from a few booleans about what the
 * creator has done so far, decide which setup steps are complete and what to
 * nudge next. Pure and UI-free, so the home dashboard can adapt (a fresh user
 * sees a getting-started checklist, a set-up user sees their numbers) without
 * this logic knowing anything about React or the network.
 */

/** What the creator has accomplished, each derived from data the app already
 * has (saved inspiration, library items, a recorded take, a connection, a
 * posted video). */
export interface StudioSignals {
  hasInspiration: boolean;
  hasContent: boolean;
  hasRecording: boolean;
  hasConnection: boolean;
  hasPosted: boolean;
}

export type SetupStepId =
  | "inspiration"
  | "content"
  | "record"
  | "connect"
  | "post";

export interface SetupStep {
  id: SetupStepId;
  title: string;
  href: string;
  done: boolean;
}

/** The five setup steps in the order a creator moves through the studio, each
 * flagged done from the matching signal. Order is fixed so "what's next" is
 * always the earliest thing still undone. */
export function setupSteps(signals: StudioSignals): SetupStep[] {
  return [
    {
      id: "inspiration",
      title: "Save your first inspiration",
      href: "/studio/inspiration",
      done: signals.hasInspiration,
    },
    {
      id: "content",
      title: "Draft your first script",
      href: "/studio/library",
      done: signals.hasContent,
    },
    {
      id: "record",
      title: "Record a take",
      href: "/studio/recorder",
      done: signals.hasRecording,
    },
    {
      id: "connect",
      title: "Connect a platform",
      href: "/studio/connections",
      done: signals.hasConnection,
    },
    {
      id: "post",
      title: "Post your first video",
      href: "/studio/poster",
      done: signals.hasPosted,
    },
  ];
}

/** The earliest step still undone, the one to nudge next, or null when the
 * creator has finished setup (so the dashboard flips to its numbers view). */
export function nextSetupStep(steps: SetupStep[]): SetupStep | null {
  return steps.find((s) => !s.done) ?? null;
}

/** Progress across the setup steps, for a checklist header or a ring. */
export function setupProgress(steps: SetupStep[]): {
  done: number;
  total: number;
  complete: boolean;
} {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, complete: done === steps.length };
}
