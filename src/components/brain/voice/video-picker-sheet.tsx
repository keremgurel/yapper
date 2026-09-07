"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import ImportProgressNote from "@/components/brain/voice/import-progress";
import { PLATFORM_LABEL } from "@/components/brain/voice/platform-copy";
import VideoTile from "@/components/brain/voice/video-tile";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useChannelVideos } from "@/hooks/use-channel-videos";
import { useSampleImport } from "@/hooks/use-sample-import";
import type { PublishPlatform } from "@/lib/db/schema";
import type { PlatformVideo } from "@/lib/publish/client";
import type { VoiceSample } from "@/lib/voice/client";
import { sampleCredits, tooLong } from "@/lib/voice/units";

const MAX_PICK = 8;

/**
 * Pick published videos from a connected channel to teach the brain a voice.
 *
 * The cost is on every tile and totalled in the footer before anything is
 * charged. Videos go one at a time; when at least one lands, the voice is
 * rewritten and the sheet closes.
 */
export default function VideoPickerSheet({
  open,
  onOpenChange,
  platforms,
  sampled,
  onSample,
  onDone,
  deriving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platforms: PublishPlatform[];
  sampled: VoiceSample[];
  onSample: (sample: VoiceSample) => void;
  /** Called with how many videos landed; the parent derives and closes. */
  onDone: (added: number) => Promise<void>;
  deriving: boolean;
}) {
  const [platform, setPlatform] = useState<PublishPlatform | null>(
    platforms[0] ?? null,
  );
  const active =
    platform && platforms.includes(platform)
      ? platform
      : (platforms[0] ?? null);
  const { videos, loading, error } = useChannelVideos(open ? active : null);
  const [picked, setPicked] = useState<Map<string, PlatformVideo>>(new Map());
  const { run, progress, failures, busy, reset } = useSampleImport(onSample);

  const sampledIds = useMemo(
    () =>
      new Set(
        sampled
          .filter((s) => s.platform === active)
          .map((s) => s.externalPostId),
      ),
    [sampled, active],
  );
  const selection = [...picked.values()];
  const total = active
    ? selection.reduce(
        (sum, video) => sum + sampleCredits(active, video.durationSec ?? null),
        0,
      )
    : 0;

  const toggle = (video: PlatformVideo) => {
    if (tooLong(video.durationSec ?? null)) return;
    setPicked((current) => {
      const next = new Map(current);
      if (next.has(video.id)) next.delete(video.id);
      else if (next.size < MAX_PICK) next.set(video.id, video);
      return next;
    });
  };

  const switchPlatform = (next: PublishPlatform) => {
    setPlatform(next);
    setPicked(new Map());
  };

  const confirm = async () => {
    if (!active || selection.length === 0) return;
    const added = await run(active, selection);
    setPicked(new Map());
    await onDone(added);
  };

  const close = (next: boolean) => {
    if (!next) {
      if (busy) return;
      reset();
      setPicked(new Map());
    }
    onOpenChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle>Add videos to your voice</SheetTitle>
          <SheetDescription>
            Pick videos you actually talk in. Each is transcribed once and kept
            word for word. One credit covers three minutes; YouTube captions are
            free.
          </SheetDescription>
        </SheetHeader>

        {platforms.length > 1 ? (
          <div className="flex gap-1 px-4 pb-3" role="tablist">
            {platforms.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={active === p}
                onClick={() => switchPlatform(p)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  active === p
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {PLATFORM_LABEL[p]}
              </button>
            ))}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <p className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading your videos…
            </p>
          ) : error ? (
            <p className="text-muted-foreground py-8 text-sm">
              {error === "not_connected"
                ? "This channel is not connected any more."
                : "Your videos could not be listed right now. Try again in a moment."}
            </p>
          ) : videos.length === 0 ? (
            <p className="text-muted-foreground py-8 text-sm">
              No videos on this channel yet.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {videos.map((video) => (
                <VideoTile
                  key={video.id}
                  platform={active as PublishPlatform}
                  video={video}
                  selected={picked.has(video.id)}
                  sampled={sampledIds.has(video.id)}
                  onToggle={() => toggle(video)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-border space-y-3 border-t px-4 py-3">
          <ImportProgressNote
            progress={progress}
            failures={failures}
            deriving={deriving}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              {selection.length === 0
                ? `Pick up to ${MAX_PICK} videos`
                : total === 0
                  ? `${selection.length} selected · free`
                  : `${selection.length} selected · ${total} credit${total === 1 ? "" : "s"}`}
            </p>
            <Button
              type="button"
              disabled={selection.length === 0 || busy || deriving}
              onClick={() => void confirm()}
            >
              {busy ? "Listening…" : "Transcribe and learn"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
