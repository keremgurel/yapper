import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { submissions } from "@/lib/db/schema";
import {
  parseTrainingContext,
  parseTrainingScores,
} from "@/lib/progress/parse";
import { dayStreak, isValidTimeZone } from "@/lib/progress/streak";
import { scoreTrend } from "@/lib/progress/trend";
import type {
  ProgressSession,
  TrainingProgressResponse,
} from "@/lib/progress/types";
import { skillWindowAverages } from "@/lib/progress/skill-averages";
import { parsePronunciation } from "@/lib/pronunciation/parse";
import { SKILLS, skillScores } from "@/lib/training-feedback/skills";

export const runtime = "nodejs";

/** The recent-sessions table and the trend windows read at most this many
 * reps. */
const SESSION_CAP = 50;

/** The streak reads timestamps only, but still bounded: 400 rows covers more
 * than a year of daily practice, and a longer streak than that is a problem
 * this product would be delighted to have. */
const STREAK_ROW_CAP = 400;

/**
 * Everything the progress dashboard needs in one authenticated GET. Counts
 * and sums run in SQL; windowed math (streak, trend, per-dimension averages)
 * runs in the pure modules under src/lib/progress on a bounded set of rows.
 *
 * `?tz=` is the viewer's IANA timezone for the day-streak; invalid or missing
 * values fall back to UTC (see src/lib/progress/streak.ts for the reasoning).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const tzParam = req.nextUrl.searchParams.get("tz") ?? "";
  const timeZone = isValidTimeZone(tzParam) ? tzParam : "UTC";

  const db = getDb();
  const trainingOnly = and(
    eq(submissions.userId, userId),
    eq(submissions.surface, "training"),
  );

  const [rows, [totals], streakRows] = await Promise.all([
    db
      .select({
        id: submissions.id,
        createdAt: submissions.createdAt,
        durationSec: submissions.durationSec,
        status: submissions.status,
        context: submissions.context,
        scores: submissions.scores,
        // Only this one key: the full feedback blob is large and unused here.
        pronunciation: sql<unknown>`${submissions.feedback}->'pronunciation'`,
      })
      .from(submissions)
      .where(trainingOnly)
      .orderBy(desc(submissions.createdAt))
      .limit(SESSION_CAP),
    db
      .select({
        totalReps: sql<number>`count(*)::int`,
        coachedReps: sql<number>`count(${submissions.scores})::int`,
        totalSeconds: sql<number>`coalesce(sum(${submissions.durationSec}), 0)::float`,
        // jsonb_typeof guards the cast so one malformed payload cannot 500
        // the whole dashboard.
        bestOverall: sql<
          number | null
        >`max(case when jsonb_typeof(${submissions.scores}->'overall') = 'number' then (${submissions.scores}->>'overall')::float end)`,
      })
      .from(submissions)
      .where(trainingOnly),
    db
      .select({ createdAt: submissions.createdAt })
      .from(submissions)
      .where(trainingOnly)
      .orderBy(desc(submissions.createdAt))
      .limit(STREAK_ROW_CAP),
  ]);

  // Newest first, like `rows`. The skills are derived the same way the report
  // derives them, so the dashboard and a session's own page always agree.
  const skillsByRow = rows.map((row) => {
    const scores = parseTrainingScores(row.scores);
    return scores
      ? skillScores(scores, parsePronunciation(row.pronunciation))
      : null;
  });

  const sessions: ProgressSession[] = rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    durationSec: row.durationSec,
    status: row.status,
    context: parseTrainingContext(row.context),
    scores: parseTrainingScores(row.scores),
  }));

  // Chronological coached scores drive both windows. Bounded by SESSION_CAP,
  // which also keeps "earlier average" meaning "your recent past" rather than
  // reps from a year ago.
  const coachedScores = sessions
    .slice()
    .reverse()
    .flatMap((session) => (session.scores ? [session.scores] : []));
  const trend = scoreTrend(coachedScores.map((scores) => scores.overall));
  const bySkill = skillWindowAverages(
    skillsByRow
      .slice()
      .reverse()
      .flatMap((skills) => (skills ? [skills] : [])),
  );

  const body: TrainingProgressResponse = {
    sessions,
    stats: {
      totalReps: totals.totalReps,
      coachedReps: totals.coachedReps,
      minutesPracticed: Math.round(totals.totalSeconds / 60),
      dayStreak: dayStreak(
        streakRows.map((row) => row.createdAt),
        timeZone,
      ),
      bestOverall:
        totals.bestOverall === null ? null : Math.round(totals.bestOverall),
      latestOverall: trend.latest,
      earlierAverage: trend.earlierAverage,
      overallDelta: trend.delta,
    },
    dimensions: SKILLS.map((skill) => ({
      dimension: skill,
      average: bySkill[skill].average,
      delta: bySkill[skill].delta,
    })),
  };

  return Response.json(body);
}
