"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  automationErrorMessage,
  retryAutomation,
} from "@/lib/publish/automation-client";
import type { AutomationRunSummary } from "@/lib/publish/automation-types";
import { PLATFORMS } from "@/lib/publish/platforms";
const states = {
  pending: "Waiting to import",
  importing: "Importing video",
  queued: "Prepared for sending",
  failed: "Import needs attention",
  cancelled: "Cancelled",
};
const delivery = {
  scheduled: "Waiting to send",
  running: "Sending",
  published: "Published",
  draft: "In TikTok drafts",
  failed: "Needs a retry",
  needs_attention: "Check the platform",
  cancelled: "Cancelled",
};
function Run({
  run,
  canRetry,
  onRefresh,
}: {
  run: AutomationRunSummary;
  canRetry: boolean;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const retry = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      await retryAutomation(run.id);
      onRefresh();
    } catch (cause) {
      setError(automationErrorMessage(cause));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return (
    <li className="border-border space-y-2 border-t py-4 first:border-0">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="text-sm font-bold">{run.title}</p>
        <span className="text-muted-foreground text-xs">
          {states[run.status]}
        </span>
      </div>
      {run.sourceUrl.startsWith("https://") && (
        <a
          href={run.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground text-xs underline underline-offset-4"
        >
          View Instagram post
        </a>
      )}
      {run.schedules.length > 0 && (
        <ul className="space-y-1">
          {run.schedules.map((schedule) => (
            <li key={schedule.id} className="text-muted-foreground text-xs">
              {PLATFORMS[schedule.platform].label} · {schedule.accountLabel} ·{" "}
              {delivery[schedule.status]}
            </li>
          ))}
        </ul>
      )}
      {run.error && (
        <p className="text-destructive text-xs">
          {automationErrorMessage(new Error(run.error))}
        </p>
      )}
      {run.status === "failed" && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !canRetry}
          onClick={() => void retry()}
        >
          {busy ? "Requesting retry…" : "Retry import"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </li>
  );
}
export default function AutomationHistory({
  runs,
  canRetry,
  onRefresh,
}: {
  runs: AutomationRunSummary[];
  canRetry: boolean;
  onRefresh: () => void;
}) {
  return (
    <section
      className="border-border bg-card rounded-2xl border p-5"
      aria-label="Automation activity"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Recent activity</h2>
        <Button size="sm" variant="ghost" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
      {!runs.length ? (
        <p className="text-muted-foreground mt-3 text-sm">
          New Instagram videos will appear here after the rule is enabled and
          checked.
        </p>
      ) : (
        <ul>
          {runs.map((run) => (
            <Run
              key={run.id}
              run={run}
              canRetry={canRetry}
              onRefresh={onRefresh}
            />
          ))}
        </ul>
      )}
      {runs.length > 0 && (
        <Link
          href="/studio/calendar"
          className="text-sm underline underline-offset-4"
        >
          Manage deliveries and retries in Calendar
        </Link>
      )}
    </section>
  );
}
