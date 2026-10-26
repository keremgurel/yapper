import {
  claimDueSchedules,
  deferPublishingSchedule,
  nextScheduleWake,
  reconcileScheduleOutcomes,
  scheduleAttemptKey,
  settlePublishingSchedule,
  type PublishingSchedule,
} from "@/lib/db/publishing-schedules";
import { findPublishJobClaim, getConnectionRow } from "@/lib/db/publish";
import { getContentItem } from "@/lib/db/content";
import { publishFacebook } from "./server/facebook";
import { publishInstagram } from "./server/instagram";
import { publishTikTok } from "./server/tiktok";
import { publishTikTokDirect } from "./server/tiktok-direct";
import { publishYouTube } from "./server/youtube";
import { sendsTikTokDraft } from "./schedule-types";
import { createPublishWorkflow } from "./workflow";

const publishers = {
  youtube: publishYouTube,
  facebook: publishFacebook,
  instagram: publishInstagram,
  tiktok: publishTikTok,
  tiktokDirect: publishTikTokDirect,
};
/** How soon to ask a platform again about a post it is still processing. */
export const RECHECK_MS = 45_000;
/** After this long a still-processing post stops being rechecked and asks the
 * creator to look at the platform instead. */
export const RECHECK_WINDOW_MS = 60 * 60_000;
/** A post that never started sending and is this late is not sent at all: a
 * Tuesday 9am post going out on Wednesday is worse than asking again. Only an
 * outage of the clock can make a post this late. */
export const MISSED_AFTER_MS = 24 * 60 * 60_000;
type Outcome =
  | Parameters<typeof settlePublishingSchedule>[1]
  | { status: "processing"; publishJobId?: string };

/** Shares the manual publish boundary, including ownership, streaming, account
 * refresh and the durable per-platform claim. This is never a synthetic login. */
export async function runScheduledDestination(
  row: PublishingSchedule,
  signal: AbortSignal,
  dependencies = {
    prior: findPublishJobClaim,
    connection: getConnectionRow,
    content: getContentItem,
    publishers,
  },
): Promise<Outcome> {
  const key = scheduleAttemptKey(row);
  try {
    const prior = await dependencies.prior(row.userId, row.platform, key);
    if (!prior) {
      if (Date.now() - row.scheduledFor.getTime() > MISSED_AFTER_MS)
        return { status: "failed", error: "schedule_missed" };
      const connection = await dependencies.connection(
        row.userId,
        row.platform,
      );
      if (
        !connection ||
        connection.status !== "active" ||
        connection.externalAccountId !== row.externalAccountId
      ) {
        return { status: "failed", error: "destination_account_changed" };
      }
      if (
        row.input.contentItemId &&
        !(await dependencies.content(row.userId, row.input.contentItemId))
      ) {
        return { status: "failed", error: "content_item_unavailable" };
      }
    }
    const request = new Request(`https://scheduled.internal/${row.platform}`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(row.input),
    });
    const publisher =
      row.platform === "tiktok" && !sendsTikTokDraft(row.platform, row.input)
        ? dependencies.publishers.tiktokDirect
        : dependencies.publishers[row.platform];
    const response = await publisher(
      request,
      row.userId,
      createPublishWorkflow(signal),
      row.externalAccountId,
    );
    const result = (await response.json()) as {
      jobId?: string;
      url?: string;
      draft?: boolean;
      error?: string;
      reconcilable?: boolean;
    };
    if (response.ok)
      return {
        status: result.draft ? "draft" : "published",
        publishJobId: result.jobId,
        externalUrl: result.url,
      };
    // The platform took the post and is still processing it. Asking again
    // with the same key checks its status rather than posting again.
    if (
      result.error === "publish_state_pending" &&
      result.reconcilable &&
      Date.now() - row.scheduledFor.getTime() < RECHECK_WINDOW_MS
    )
      return { status: "processing", publishJobId: result.jobId };
    const uncertain =
      result.error === "publish_state_pending" ||
      result.error === "publish_in_progress";
    return {
      status: uncertain ? "needs_attention" : "failed",
      publishJobId: result.jobId,
      error: result.error ?? "publish_failed",
    };
  } catch {
    // The process may have crossed a provider boundary before it threw. A
    // durable platform claim is authoritative about whether retry is safe.
    const prior = await dependencies.prior(row.userId, row.platform, key);
    if (prior?.status === "published")
      return {
        status: sendsTikTokDraft(row.platform, row.input)
          ? "draft"
          : "published",
        publishJobId: prior.jobId,
        externalUrl: prior.externalUrl ?? undefined,
      };
    return {
      status: prior && prior.status !== "failed" ? "needs_attention" : "failed",
      publishJobId: prior?.jobId,
      error:
        prior && prior.status !== "failed"
          ? "publish_state_pending"
          : "publish_failed",
    };
  }
}

export async function runDuePublishing(signal: AbortSignal) {
  const reconciled = await reconcileScheduleOutcomes();
  const rows = await claimDueSchedules();
  const results = await Promise.allSettled(
    rows.map(async (row) => {
      const outcome = await runScheduledDestination(row, signal);
      if (outcome.status === "processing")
        await deferPublishingSchedule(
          row,
          new Date(Date.now() + RECHECK_MS),
          outcome.publishJobId,
        );
      else await settlePublishingSchedule(row, outcome);
      return { id: row.id, status: outcome.status };
    }),
  );
  const nextDueAt = await nextScheduleWake();
  return {
    reconciled: reconciled.length,
    claimed: rows.length,
    settled: results.filter((result) => result.status === "fulfilled").length,
    deferred: results.filter((result) => result.status === "rejected").length,
    nextDueAt: nextDueAt?.toISOString() ?? null,
  };
}
