import {
  claimDueSchedules,
  reconcileScheduleOutcomes,
  scheduleAttemptKey,
  settlePublishingSchedule,
  type PublishingSchedule,
} from "@/lib/db/publishing-schedules";
import { findPublishJobClaim, getConnectionRow } from "@/lib/db/publish";
import { getContentItem } from "@/lib/db/content";
import { publishInstagram } from "./server/instagram";
import { publishTikTok } from "./server/tiktok";
import { publishYouTube } from "./server/youtube";
import { createPublishWorkflow } from "./workflow";

const publishers = {
  youtube: publishYouTube,
  instagram: publishInstagram,
  tiktok: publishTikTok,
};
type Outcome = Parameters<typeof settlePublishingSchedule>[1];

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
    const response = await dependencies.publishers[row.platform](
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
    };
    if (response.ok)
      return {
        status: result.draft ? "draft" : "published",
        publishJobId: result.jobId,
        externalUrl: result.url,
      };
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
        status: row.platform === "tiktok" ? "draft" : "published",
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
      await settlePublishingSchedule(row, outcome);
      return { id: row.id, status: outcome.status };
    }),
  );
  return {
    reconciled: reconciled.length,
    claimed: rows.length,
    settled: results.filter((result) => result.status === "fulfilled").length,
    deferred: results.filter((result) => result.status === "rejected").length,
  };
}
