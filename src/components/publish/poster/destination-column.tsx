"use client";

import {
  AudioLines,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";

import DestinationCard from "@/components/publish/poster/destination-card";
import PlatformIcon from "@/components/publish/platform-icon";
import { Button } from "@/components/ui/button";
import {
  captionFor,
  type CaptionSet,
} from "@/components/publish/captions/caption-draft";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";
import { PLATFORMS } from "@/lib/publish/platforms";
import type { PlatformCaption } from "@/lib/publish/caption";
import {
  evaluateDestination,
  publishSummary,
} from "@/lib/publish/destination-readiness";

/**
 * Everywhere this one video is going, and whether each place can actually take
 * it. The publish button counts destinations rather than pretending there is
 * one post, because there is not.
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
  const unchosen = publishPlatforms.filter((p) => !chosen.has(p));
  const readingVideo = transcriptStatus === "pending";

  return (
    <div className="space-y-4">
      {chosen.size === 0 ? (
        <div className="border-border rounded-xl border border-dashed p-6 text-center">
          <p className="text-foreground text-sm font-semibold">
            Where is this going?
          </p>
          <p className="text-muted-foreground mt-1 text-[13px]">
            Pick a destination and you will get a caption written for it.
          </p>
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
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
                ? "Writing platform copy…"
                : "Generate captions + YouTube title"}
          </Button>
          <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-[11px]">
            {transcriptStatus === "ready" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--sg-green-500)]" />
            ) : (
              <AudioLines className="h-3.5 w-3.5" />
            )}
            {transcriptStatus === "ready"
              ? "Grounded in the video's full transcript"
              : transcriptStatus === "pending"
                ? "Transcript is being prepared automatically"
                : "Uses the title and your writing brief"}
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

      {unchosen.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unchosen.map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => onToggle(platform)}
              className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
            >
              <Plus className="h-3.5 w-3.5" />
              <PlatformIcon platform={platform} className="h-3.5 w-3.5" />
              {PLATFORMS[platform].label}
            </button>
          ))}
        </div>
      )}

      {chosen.size > 0 && (
        <div className="border-border sticky bottom-4 rounded-xl border bg-[color:var(--sg-surface-raised)] p-3 shadow-[0_12px_32px_-18px_rgba(0,0,0,0.5)]">
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
            <p className="text-muted-foreground mt-2 text-center text-[12px]">
              {summary.blocked} {summary.blocked === 1 ? "needs" : "need"} a fix
              first
            </p>
          )}
        </div>
      )}
    </div>
  );
}
