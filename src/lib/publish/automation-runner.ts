import {
  claimAutomationRules,
  claimAutomationRuns,
  enqueueAutomationRun,
  failAutomationRun,
  finishAutomationScan,
  type AutomationRule,
  type AutomationRun,
} from "@/lib/db/automations";
import { getConnectionRow } from "@/lib/db/publish";
import { canUsePremium } from "@/lib/billing/gate";
import { getFreshAccessToken } from "./connection";
import { listAutomationSourcePage } from "./automation-source";
import { importInstagramVideo } from "./server/instagram-import";

/** Revisit the head on every poll and advance a persisted cursor through the
 * rest. We do not rely on timestamp ordering or lose page 2 behind a limit. */
export async function discoverAutomationPosts(
  rule: AutomationRule,
  signal: AbortSignal,
) {
  try {
    if (!(await canUsePremium(rule.userId))) throw new Error("not_entitled");
    const token = await getFreshAccessToken(
      rule.userId,
      "instagram",
      rule.sourceAccountId ?? undefined,
    );
    const head = await listAutomationSourcePage(token, null, signal);
    const tail = rule.scanCursor
      ? await listAutomationSourcePage(token, rule.scanCursor, signal)
      : null;
    return finishAutomationScan(rule, {
      posts: [...head.posts, ...(tail?.posts ?? [])],
      cursor: tail ? tail.cursor : head.cursor,
    });
  } catch (cause) {
    const error =
      cause instanceof Error ? cause.message : "instagram_check_failed";
    return finishAutomationScan(rule, {
      posts: [],
      cursor: error === "instagram_cursor_expired" ? null : rule.scanCursor,
      error,
    });
  }
}

export async function prepareAutomationRun(
  run: AutomationRun,
  signal: AbortSignal,
) {
  try {
    // Check the whole reviewed account set before importing, and check again
    // in each destination publisher when its durable queue operation starts.
    const source = await getConnectionRow(run.userId, "instagram");
    if (
      source?.status !== "active" ||
      source.externalAccountId !== run.sourceAccountId
    )
      throw new Error("source_account_changed");
    for (const account of run.accounts) {
      const current = await getConnectionRow(run.userId, account.platform);
      if (
        current?.status !== "active" ||
        current.externalAccountId !== account.id
      )
        throw new Error("destination_account_changed");
    }
    const response = await importInstagramVideo(
      new Request("https://automation.internal/import", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: run.sourcePostId }),
      }),
      run.userId,
      run.sourceAccountId,
      true,
    );
    const result = (await response.json()) as {
      mediaKey?: string;
      error?: string;
    };
    if (!response.ok || !result.mediaKey)
      throw new Error(result.error ?? "import_failed");
    return await enqueueAutomationRun(run, result.mediaKey);
  } catch (cause) {
    await failAutomationRun(
      run,
      cause instanceof Error ? cause.message : "import_failed",
    );
    return false;
  }
}

export async function runAutomations(signal: AbortSignal) {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(165_000)]);
  const rules = await claimAutomationRules();
  const scans = await Promise.allSettled(
    rules.map((rule) => discoverAutomationPosts(rule, deadline)),
  );
  const runs = await claimAutomationRuns();
  const prepared = await Promise.allSettled(
    runs.map((run) => prepareAutomationRun(run, deadline)),
  );
  return {
    checked: scans.filter((result) => result.status === "fulfilled").length,
    imported: prepared.filter(
      (result) => result.status === "fulfilled" && result.value,
    ).length,
    deferred: [...scans, ...prepared].filter(
      (result) => result.status === "rejected",
    ).length,
  };
}
