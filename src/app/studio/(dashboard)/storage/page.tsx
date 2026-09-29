import Link from "next/link";
import { PageHeader } from "@/components/studio-ui";
import { lapsedMediaDeleteAt } from "@/lib/billing/entitlement";
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import {
  Brain,
  Clapperboard,
  Database,
  HardDrive,
  Images,
  Lightbulb,
  Library,
  Palette,
  Trash2,
} from "lucide-react";
import { getBillingState } from "@/lib/db/billing";
import { getStorageUsageDetails } from "@/lib/db/storage-usage";
import { getStorageBytes } from "@/lib/db/users";
import { storageQuotaFor } from "@/lib/billing/storage";
import { formatStorageBytes, storageUsagePercent } from "@/lib/storage/format";

export const metadata: Metadata = {
  title: "Storage",
  description: "See your Yapper storage usage and plan allowance.",
  robots: { index: false },
};

function BreakdownCard({
  icon: Icon,
  label,
  detail,
  value,
}: {
  icon: typeof HardDrive;
  label: string;
  detail: string;
  value: string;
}) {
  return (
    <div className="border-border bg-card rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="bg-muted text-foreground grid h-9 w-9 place-items-center rounded-xl">
          <Icon className="h-4 w-4" />
        </span>
        <span className="font-display text-foreground text-lg font-semibold">
          {value}
        </span>
      </div>
      <p className="text-foreground mt-4 text-sm font-semibold">{label}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-5">{detail}</p>
    </div>
  );
}

export default async function StoragePage() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <HardDrive className="text-muted-foreground mx-auto h-8 w-8" />
        <h1 className="font-display mt-4 text-2xl font-semibold">
          Your storage
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Sign in to see what your workspace is using.
        </p>
      </div>
    );
  }

  const [state, usedBytes, details] = await Promise.all([
    getBillingState(userId),
    getStorageBytes(userId),
    getStorageUsageDetails(userId),
  ]);
  const quotaBytes = storageQuotaFor(state);
  const committedBytes = usedBytes + details.reservedBytes;
  const percent = storageUsagePercent(committedBytes, quotaBytes);
  // A lapsed account keeps its videos for 30 days after access ends.
  const videosDeleteOn = usedBytes > 0 ? lapsedMediaDeleteAt(state) : null;
  const pressure =
    percent >= 90 ? "critical" : percent >= 70 ? "near" : "roomy";

  return (
    <div className="w-full space-y-6 pb-12">
      <PageHeader
        title="Storage"
        description="Temporary space for your current video and scheduled posts. Originals and editor projects stay on your device. Your Brain, ideas and scripts stay in your workspace."
      />

      {videosDeleteOn && (
        <p className="border-border bg-card rounded-2xl border px-5 py-4 text-sm">
          <span className="text-foreground font-semibold">
            Your stored videos will be deleted on{" "}
            {videosDeleteOn.toLocaleDateString("en", { dateStyle: "long" })}.
          </span>{" "}
          <span className="text-muted-foreground">
            Your subscription ended. Resubscribe before then to keep them. Your
            Brain, ideas and scripts stay either way.
          </span>
        </p>
      )}

      <section className="border-border bg-card relative rounded-2xl border p-6">
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs font-bold">
                Temporary publishing workspace
              </p>
              <p className="font-display text-foreground mt-1 text-3xl font-semibold tabular-nums">
                {formatStorageBytes(usedBytes)}
                <span className="text-muted-foreground text-lg font-bold">
                  {" "}
                  / {formatStorageBytes(quotaBytes)}
                </span>
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                pressure === "critical"
                  ? "bg-red-500/12 text-red-600 dark:text-red-400"
                  : pressure === "near"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {pressure === "critical"
                ? "Storage almost full"
                : pressure === "near"
                  ? "Getting full"
                  : "Plenty of room"}
            </span>
          </div>

          <div
            className="bg-muted mt-6 h-3 overflow-hidden rounded-full"
            role="meter"
            aria-label="Storage used"
            aria-valuemin={0}
            aria-valuemax={quotaBytes}
            aria-valuenow={Math.min(committedBytes, quotaBytes)}
          >
            <div
              className={`h-full rounded-full transition-[width] ${
                pressure === "critical"
                  ? "bg-red-500"
                  : pressure === "near"
                    ? "bg-amber-500"
                    : "bg-orange-500"
              }`}
              style={{
                width: `${Math.max(percent, committedBytes ? 0.5 : 0)}%`,
              }}
            />
          </div>
          <div className="text-muted-foreground mt-2 flex flex-wrap justify-between gap-2 text-xs">
            <span>{percent.toFixed(percent < 1 ? 2 : 1)}% committed</span>
            <span>
              {formatStorageBytes(Math.max(0, quotaBytes - committedBytes))}{" "}
              free
            </span>
          </div>
          {details.reservedBytes > 0 ? (
            <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-200">
              {formatStorageBytes(details.reservedBytes)} is temporarily
              reserved for {details.reservedCount} in-progress upload
              {details.reservedCount === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-foreground text-lg font-semibold">
              Video storage
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              One current video, plus files needed for scheduled posts and
              publishing retries.
            </p>
          </div>
          <Link
            href="/history"
            className="text-foreground inline-flex items-center gap-1.5 text-xs font-semibold no-underline hover:underline"
          >
            <Trash2 className="h-3.5 w-3.5" /> Manage videos
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <BreakdownCard
            icon={Clapperboard}
            label="Uploaded videos"
            detail={`${details.media.recording.count} upload${details.media.recording.count === 1 ? "" : "s"}`}
            value={formatStorageBytes(details.media.recording.bytes)}
          />
          <BreakdownCard
            icon={Database}
            label="Cross-post imports"
            detail={`${details.media.import.count} temporary import${details.media.import.count === 1 ? "" : "s"}`}
            value={formatStorageBytes(details.media.import.bytes)}
          />
          <BreakdownCard
            icon={Images}
            label="Thumbnail assets"
            detail={`${details.media.thumbnail.count} retained thumbnail${details.media.thumbnail.count === 1 ? "" : "s"}`}
            value={formatStorageBytes(details.media.thumbnail.bytes)}
          />
          <BreakdownCard
            icon={Palette}
            label="Brand logos"
            detail={`${details.media.brand_logo.count} saved logo${details.media.brand_logo.count === 1 ? "" : "s"}`}
            value={formatStorageBytes(details.media.brand_logo.bytes)}
          />
        </div>
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-foreground text-lg font-semibold">
              Written workspace
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-xs leading-5">
              About {formatStorageBytes(details.workspace.estimatedBytes)} of
              project, Brain, idea and library records. This is visible for
              transparency but does not consume your temporary storage limit.
            </p>
          </div>
          <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-[11px] font-semibold">
            Included
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Link
            href="/studio/brain"
            className="bg-muted/60 hover:bg-muted flex items-center gap-3 rounded-xl p-4 no-underline transition-colors"
          >
            <Brain className="text-muted-foreground h-5 w-5" />
            <span>
              <span className="text-foreground block text-sm font-semibold">
                {details.workspace.brainBlocks} Brain blocks
              </span>
              <span className="text-muted-foreground text-xs">
                {details.workspace.brainSkills} writing skills
              </span>
            </span>
          </Link>
          <Link
            href="/studio/ideas"
            className="bg-muted/60 hover:bg-muted flex items-center gap-3 rounded-xl p-4 no-underline transition-colors"
          >
            <Lightbulb className="text-muted-foreground h-5 w-5" />
            <span>
              <span className="text-foreground block text-sm font-semibold">
                {details.workspace.contentIdeas} ideas
              </span>
              <span className="text-muted-foreground text-xs">Idea bank</span>
            </span>
          </Link>
          <Link
            href="/studio/library"
            className="bg-muted/60 hover:bg-muted flex items-center gap-3 rounded-xl p-4 no-underline transition-colors"
          >
            <Library className="text-muted-foreground h-5 w-5" />
            <span>
              <span className="text-foreground block text-sm font-semibold">
                {details.workspace.contentLibrary} library items
              </span>
              <span className="text-muted-foreground text-xs">
                {details.workspace.savedViews} saved views
              </span>
            </span>
          </Link>
        </div>
      </section>

      <section className="border-border rounded-2xl border p-5 sm:p-6">
        <h2 className="font-display text-foreground text-lg font-semibold">
          How temporary storage works
        </h2>
        <div className="text-muted-foreground mt-3 space-y-3 text-sm leading-6">
          <p>
            Every membership has the same 5 GB limit at any one time. Weekly,
            monthly and yearly describe billing only. Storage never resets or
            accumulates.
          </p>
          <p>
            Yapper keeps one current video. Scheduled posts keep the files they
            need. After successful publishing, files are released after the
            24-hour retry window and the next cleanup run.
          </p>
          <p>
            This is publishing space, not a video archive. Keep originals on
            your device. Your scripts, transcripts and feedback remain after
            video files are removed.
          </p>
        </div>
      </section>
    </div>
  );
}
