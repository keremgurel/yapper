"use client";

import { useUser } from "@clerk/nextjs";
import { PageHeader, Section } from "@/components/studio-ui";
import DimensionProgress from "@/components/progress/dimension-progress";
import ScoreTrendCard from "@/components/progress/score-trend-card";
import SessionsTable from "@/components/progress/sessions-table";
import StatBand from "@/components/progress/stat-band";
import { useTrainingProgress } from "@/hooks/use-training-progress";
import { stateOfPlay } from "@/lib/progress/state-of-play";

/**
 * The signed-in dashboard, in argument order: where you are (stat band),
 * whether you are improving (trend, then per-dimension movement), what you
 * did (recent sessions). Data arrives through one stale-while-revalidate
 * hook; every section renders its own skeleton until it does.
 */
export default function ProgressView() {
  const { user } = useUser();
  const { progress } = useTrainingProgress();

  const stats = progress?.stats ?? null;
  const sessions = progress?.sessions ?? null;

  return (
    <div className="marketing-container py-8">
      <PageHeader
        title={
          user?.firstName ? `${user.firstName}'s progress` : "Your progress"
        }
        description={stats ? stateOfPlay(stats) : undefined}
      />
      <div className="space-y-8">
        <StatBand stats={stats} />
        <Section title="Score trend">
          <ScoreTrendCard stats={stats} sessions={sessions} />
        </Section>
        <Section title="Skill by skill">
          <DimensionProgress dimensions={progress?.dimensions ?? null} />
        </Section>
        <Section title="Recent sessions">
          <SessionsTable sessions={sessions} />
        </Section>
      </div>
    </div>
  );
}
