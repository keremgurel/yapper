"use client";

import { PracticeSessionProvider } from "@/contexts/practice-session";
import {
  ErrorBoundary,
  PracticeErrorFallback,
} from "@/components/ErrorBoundary";
import PracticeStage from "@/components/practice-stage";
import type { TrainingMode } from "@/data/training-modes";
import topics from "@/data/topics";

export default function TrainingWorkspace({ mode }: { mode: TrainingMode }) {
  return (
    <PracticeSessionProvider
      initialTopic={mode.pool?.[0] ?? topics[0]}
      mode={mode.kind === "freestyle" ? "freestyle" : "topic"}
      drillSlug={mode.slug}
      drillTitle={mode.title}
      topicPool={mode.pool}
      initialSeconds={mode.seconds}
    >
      <ErrorBoundary
        fallback={({ reset }) => <PracticeErrorFallback reset={reset} />}
      >
        <PracticeStage embedded />
      </ErrorBoundary>
    </PracticeSessionProvider>
  );
}
