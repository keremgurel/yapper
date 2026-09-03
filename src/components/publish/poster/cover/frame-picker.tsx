"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Filmstrip from "./filmstrip";
import { FRAME_SECONDS, formatTimecode, frameIndex } from "./frame-time";
import type { FilmstripTile } from "./use-filmstrip";

/**
 * Finding the exact frame. The frame under the playhead is the thumbnail:
 * there is nothing to confirm. The filmstrip gets you to the right second,
 * the slider to the right moment, and the step buttons (or arrow keys on the
 * slider) to the frame.
 */
export default function FramePicker({
  videoRef,
  mediaUrl,
  duration,
  time,
  tiles,
  tilesLoading,
  capturing,
  error,
  onLoadedMetadata,
  onSeek,
  onStep,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mediaUrl: string | null;
  duration: number;
  time: number;
  tiles: FilmstripTile[];
  tilesLoading: boolean;
  capturing: boolean;
  error: string;
  onLoadedMetadata: (duration: number) => void;
  onSeek: (time: number) => void;
  onStep: (frames: number) => void;
}) {
  const ready = Boolean(mediaUrl && duration);
  const stepButton = (frames: number, label: string, text: string) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!ready}
      aria-label={label}
      onClick={() => onStep(frames)}
      className="min-w-11 px-2 font-mono text-[11px] tabular-nums"
    >
      {frames < 0 ? <ChevronLeft className="h-3.5 w-3.5" /> : null}
      {text}
      {frames > 0 ? <ChevronRight className="h-3.5 w-3.5" /> : null}
    </Button>
  );

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[230px] overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
        {mediaUrl ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            crossOrigin="anonymous"
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={(event) =>
              onLoadedMetadata(event.currentTarget.duration || 0)
            }
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin motion-reduce:animate-none" />
          </div>
        )}
        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2 py-1 font-mono text-[11px] text-white tabular-nums backdrop-blur">
          {capturing ? (
            <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
          ) : null}
          {formatTimecode(time)}
        </span>
      </div>

      <Filmstrip
        tiles={tiles}
        loading={tilesLoading}
        duration={duration}
        time={time}
        onPick={onSeek}
      />

      <input
        type="range"
        min={0}
        max={Math.max(duration, FRAME_SECONDS)}
        step={FRAME_SECONDS}
        value={Math.min(time, Math.max(duration, FRAME_SECONDS))}
        disabled={!ready}
        onChange={(event) => onSeek(Number(event.target.value))}
        className="w-full accent-[color:var(--sg-accent)]"
        aria-label="Frame position"
        aria-valuetext={formatTimecode(time)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {stepButton(-30, "Back one second", "1s")}
          {stepButton(-1, "Back one frame", "1f")}
          {stepButton(1, "Forward one frame", "1f")}
          {stepButton(30, "Forward one second", "1s")}
        </div>
        <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
          frame {frameIndex(time)} of {frameIndex(duration)}
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-[11px] text-amber-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
