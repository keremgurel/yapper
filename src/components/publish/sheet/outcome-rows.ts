import type { PublishPlatform } from "@/lib/db/schema";
import type {
  CrossPostOutcome,
  CrossPostStatus,
} from "@/lib/publish/run-cross-post";

export interface SourceOutcome extends CrossPostOutcome {
  sourceId: string;
  sourceTitle: string;
}

/** A destination is `sending` from the press until its own result lands. */
export type OutcomeRowStatus = CrossPostStatus | "sending";

export interface OutcomeRow extends Omit<SourceOutcome, "status"> {
  status: OutcomeRowStatus;
}

/**
 * One row per video and destination, in the order they were chosen. Every
 * destination goes out at once, so while a publish is running each one
 * without a result yet shows as sending instead of being absent.
 */
export function outcomeRows(
  sources: { id: string; title: string }[],
  platforms: PublishPlatform[],
  outcomes: SourceOutcome[],
  posting: boolean,
): OutcomeRow[] {
  const expected = sources.flatMap((source) =>
    platforms.flatMap((platform): OutcomeRow[] => {
      const outcome = outcomes.find(
        (item) => item.sourceId === source.id && item.platform === platform,
      );
      if (outcome) return [outcome];
      return posting
        ? [
            {
              sourceId: source.id,
              sourceTitle: source.title,
              platform,
              status: "sending",
            },
          ]
        : [];
    }),
  );
  // A result is never dropped, even for a destination no longer chosen.
  const stray = outcomes.filter(
    (outcome) =>
      !expected.some(
        (row) =>
          row.sourceId === outcome.sourceId &&
          row.platform === outcome.platform,
      ),
  );
  return [...expected, ...stray];
}
