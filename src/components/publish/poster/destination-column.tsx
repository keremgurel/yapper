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
import type { PlatformCaption } from "@/lib/publish/caption-format";
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
  noSpeech = false,
  description,
  onDescriptionChange,
  onGenerateOthers,
  onCopyOthers,
  hasOriginalCaption = false,
  onUseOriginalCaption,
  onGenerateTitle,
  reading = false,
  chosen,
  connected,
  hasCover,
  generating,
  captionError,
  publishing,
  mediaPending,
  transcriptStatus,
  onToggle,
  onConnect,
  onCaptionChange,
  onGenerate,
  onPublish,
}: {
  captions: CaptionSet | undefined;
  noSpeech?: boolean;
  description: string;
  onDescriptionChange: (value: string) => void;
  onGenerateOthers: (platform: PublishPlatform) => void;
  onCopyOthers: (platform: PublishPlatform) => void;
  hasOriginalCaption?: boolean;
  onUseOriginalCaption?: () => void;
  onGenerateTitle?: () => void;
  reading?: boolean;
  chosen: Set<PublishPlatform>;
  connected: PublishPlatform[];
  hasCover: boolean;
  generating: boolean;
  captionError: string;
  publishing: boolean;
  mediaPending: boolean;
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
  const readingVideo = reading;

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
          <label className="block space-y-1.5 text-sm">
            <span>
              What is this video about?{" "}
              <span className="text-muted-foreground">Optional</span>
            </span>
            <textarea
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Describe what happens or what you want to say."
              className="border-border bg-background focus-visible:ring-ring w-full resize-y rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>
          {noSpeech && (
            <p role="status" className="text-muted-foreground text-sm">
              No speech detected. Describe the video above for generated
              captions, or write a caption below.
            </p>
          )}
          {hasOriginalCaption ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">
                Starts with your original Instagram caption.
              </p>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={onUseOriginalCaption}
                disabled={generating}
              >
                Use original caption
              </Button>
              {chosen.has("youtube") ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={onGenerateTitle}
                  disabled={
                    generating ||
                    readingVideo ||
                    mediaPending ||
                    (noSpeech && !description.trim() && !hasOriginalCaption)
                  }
                >
                  <Sparkles className="h-4 w-4" />
                  Generate YouTube title
                </Button>
              ) : null}
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={onGenerate}
            disabled={
              generating ||
              readingVideo ||
              mediaPending ||
              (noSpeech && !description.trim() && !hasOriginalCaption)
            }
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
                : hasOriginalCaption
                  ? "Rewrite the captions"
                  : "Write the captions"}
          </Button>
          <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
            {transcriptStatus === "ready" && !noSpeech ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--sg-green-500)]" />
            ) : (
              <AudioLines className="h-3.5 w-3.5" />
            )}
            {description.trim()
              ? "Captions use your description of this video"
              : hasOriginalCaption
                ? "Captions use your original caption"
                : noSpeech
                  ? "Captions use your description or a caption you wrote"
                  : transcriptStatus === "ready"
                    ? "From the video's transcript, one per platform"
                    : readingVideo
                      ? "Transcript is being prepared"
                      : "Generation reads the video transcript first"}
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
          busy={false}
          onGenerateOthers={
            chosen.size > 1 ? () => onGenerateOthers(r.platform) : undefined
          }
          onCopyOthers={
            chosen.size > 1 ? () => onCopyOthers(r.platform) : undefined
          }
          generating={generating}
        />
      ))}

      {chosen.size > 0 && (
        <div className="border-border bg-card sticky bottom-4 rounded-xl border p-3">
          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={!summary.canPublish || publishing || mediaPending}
            onClick={onPublish}
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : null}
            {publishing
              ? "Preparing review…"
              : mediaPending
                ? "Preparing video…"
                : summary.label}
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
