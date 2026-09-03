"use client";

import { AudioLines, CheckCircle2, Loader2, Sparkles } from "lucide-react";

import DestinationCard from "@/components/publish/poster/destination-card";
import DestinationToggles from "@/components/publish/poster/destination-toggles";
import { Button } from "@/components/ui/button";
import {
  captionFor,
  type CaptionSet,
} from "@/components/publish/captions/caption-draft";
import type { PublishPlatform } from "@/lib/db/schema";
import type { PlatformCaption } from "@/lib/publish/caption";
import {
  evaluateDestination,
  publishSummary,
} from "@/lib/publish/destination-readiness";

/**
 * Everywhere this one video is going, and whether each place can actually take
 * it. One row of destinations at the top, one card per chosen destination, and
 * one publish button that counts them, because a cross-post is several posts.
 */
export default function DestinationColumn({
  captions,
  chosen,
  connected,
  hasCover,
  generating,
  captionError,
  publishing,
  transcriptStatus,
  onToggle,
  onConnect,
  onCaptionChange,
  onGenerate,
  onPublish,
}: {
  captions: CaptionSet | undefined;
  chosen: Set<PublishPlatform>;
  connected: PublishPlatform[];
  hasCover: boolean;
  generating: boolean;
  captionError: string;
  publishing: boolean;
  transcriptStatus: "ready" | "pending" | "needs_media" | "unavailable" | null;
  onToggle: (platform: PublishPlatform) => void;
  onConnect: (platform: PublishPlatform) => void;
  onCaptionChange: (caption: PlatformCaption) => void;
  onGenerate: () => void;
  onPublish: () => void;
}) {
  const readiness = [...chosen].map((platform) =>
    evaluateDestination({
      platform,
      connected: connected.includes(platform),
      caption: captionFor(captions, platform),
      hasCover,
    }),
  );
  const summary = publishSummary(readiness);
  const readingVideo = transcriptStatus === "pending";

  return (
    <div className="space-y-4">
      <DestinationToggles
        chosen={chosen}
        connected={connected}
        onToggle={onToggle}
        onConnect={onConnect}
      />

      {chosen.size > 0 ? (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onGenerate}
            disabled={generating || readingVideo}
            className="w-full"
          >
            {generating || readingVideo ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {readingVideo
              ? "Reading what the video says…"
              : generating
                ? "Writing…"
                : "Write the captions"}
          </Button>
          <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
            {transcriptStatus === "ready" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--sg-green-500)]" />
            ) : (
              <AudioLines className="h-3.5 w-3.5" />
            )}
            {transcriptStatus === "ready"
              ? "From the video's transcript, one per platform"
              : transcriptStatus === "pending"
                ? "Transcript is being prepared"
                : "From the title and your caption prompt"}
          </p>
          {captionError && (
            <p
              role="alert"
              className="text-[13px] text-[color:var(--sg-yellow-500)]"
            >
              {captionError}
            </p>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-center text-[13px]">
          Choose at least one destination.
        </p>
      )}

      {readiness.map((r) => (
        <DestinationCard
          key={r.platform}
          readiness={r}
          caption={captionFor(captions, r.platform)}
          onCaptionChange={onCaptionChange}
          onRemove={() => onToggle(r.platform)}
          busy={publishing && r.state === "ready"}
        />
      ))}

      {chosen.size > 0 && (
        <div className="border-border bg-card sticky bottom-4 rounded-xl border p-3">
          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={!summary.canPublish || publishing}
            onClick={onPublish}
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : null}
            {publishing ? "Publishing…" : summary.label}
          </Button>
          {summary.blocked > 0 && (
            <p className="text-muted-foreground mt-2 text-center text-xs">
              {summary.blocked} {summary.blocked === 1 ? "needs" : "need"} a fix
              first
            </p>
          )}
        </div>
      )}
    </div>
  );
}
