"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  FeedbackError,
  FeedbackSkeleton,
  TrainingFeedbackResult,
} from "@/components/training/feedback";
import type {
  TrainingFeedbackRecord,
  TranscriptWord,
} from "@/lib/training-feedback/types";

type Loaded =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      record: TrainingFeedbackRecord;
      transcript: TranscriptWord[];
    };

interface SubmissionRow {
  status: string;
  surface: string;
  feedback: TrainingFeedbackRecord | null;
  transcript: TranscriptWord[] | null;
  error: string | null;
}

/** The stored blob is ours, but it is still JSON out of a database, so the
 * shape is checked before it reaches components that assume it. */
function isTrainingRecord(value: unknown): value is TrainingFeedbackRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<TrainingFeedbackRecord>;
  return (
    typeof record.coaching === "object" &&
    record.coaching !== null &&
    typeof record.metrics === "object" &&
    record.metrics !== null
  );
}

export default function SessionReport({ id }: { id: string }) {
  const [state, setState] = useState<Loaded>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/submissions/${id}`)
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) {
          setState({ kind: "signed-out" });
          return;
        }
        if (response.status === 404) {
          setState({ kind: "error", message: "That session does not exist." });
          return;
        }
        if (!response.ok) {
          setState({ kind: "error", message: "Could not load that session." });
          return;
        }

        const body = (await response.json()) as { submission?: SubmissionRow };
        const row = body.submission;
        if (!row) {
          setState({ kind: "error", message: "Could not load that session." });
          return;
        }
        // Studio coaching is stored in the same table with a similar-looking
        // blob, so the surface is checked before the shape.
        if (row.surface !== "training") {
          setState({
            kind: "error",
            message: "That session is not a training rep.",
          });
          return;
        }
        if (row.status === "processing" || row.status === "pending") {
          setState({
            kind: "error",
            message:
              "This rep is still being scored, or scoring was interrupted. Try again in a moment.",
          });
          return;
        }
        if (row.status === "failed" || !isTrainingRecord(row.feedback)) {
          setState({
            kind: "error",
            message:
              row.error === "too_short"
                ? "That rep was too short to coach."
                : "This session has no feedback attached.",
          });
          return;
        }

        setState({
          kind: "ready",
          record: row.feedback,
          transcript: row.transcript ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ kind: "error", message: "Could not load that session." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="marketing-container py-10">
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
        <Link href="/progress" className="no-underline">
          <ArrowLeft className="h-4 w-4" />
          All sessions
        </Link>
      </Button>

      {state.kind === "loading" && <FeedbackSkeleton />}

      {state.kind === "signed-out" && (
        <div className="border-border bg-card rounded-2xl border p-6">
          <h1 className="font-display text-foreground text-[22px] font-bold tracking-[-0.01em]">
            Sign in to see this session
          </h1>
          <p className="text-muted-foreground mt-2 max-w-[52ch] text-sm">
            Feedback is private to the account that recorded it.
          </p>
          <div className="mt-5">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button type="button">Sign in</Button>
              </SignInButton>
            </Show>
          </div>
        </div>
      )}

      {state.kind === "error" && <FeedbackError description={state.message} />}

      {state.kind === "ready" && (
        <TrainingFeedbackResult
          coaching={state.record.coaching}
          metrics={state.record.metrics}
          transcript={state.transcript}
          context={state.record.context}
        />
      )}
    </div>
  );
}
