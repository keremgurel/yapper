import { Chip } from "@/components/studio-ui";
import {
  SCORE_BAND_LABELS,
  scoreBand,
  type TrainingContext,
  type TrainingScores,
} from "@/lib/training-feedback/types";
import ScoreRing from "@/components/training/feedback/score-ring";

/**
 * The payoff surface: the overall score ring, the band it lands in, and the
 * coach's overview beside it. The band chip stays neutral for every band so
 * a rough rep never opens on an alarm color.
 */
export default function ScoreHero({
  scores,
  overview,
  context,
}: {
  scores: TrainingScores;
  overview: string;
  context?: TrainingContext | null;
}) {
  const band = scoreBand(scores.overall);

  return (
    <div className="bg-card border-border rounded-xl border p-5">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <ScoreRing value={scores.overall} />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <Chip tone="neutral" pill>
            {SCORE_BAND_LABELS[band]}
          </Chip>
          {overview && (
            <p className="text-foreground mt-3 max-w-[68ch] text-[15px] leading-relaxed">
              {overview}
            </p>
          )}
        </div>
      </div>
      {context?.prompt && (
        <div className="border-border/60 mt-5 border-t pt-3">
          <p className="text-muted-foreground text-xs">
            {context.drillTitle ? `${context.drillTitle} prompt` : "Prompt"}
          </p>
          <p className="text-foreground mt-0.5 max-w-[60ch] text-sm">
            {context.prompt}
          </p>
        </div>
      )}
    </div>
  );
}
