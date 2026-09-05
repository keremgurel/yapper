"use client";

import { useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Film,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Filmstrip from "./filmstrip";
import { formatFrameTime } from "./frame-timeline";
import type { FilmstripTile } from "./use-filmstrip";

export function FramePreview({
  image,
  capturing,
}: {
  image: string | null;
  capturing: boolean;
}) {
  return (
    <div
      aria-busy={capturing}
      className="relative mx-auto aspect-[9/16] w-full max-w-[270px] overflow-hidden rounded-xl bg-black ring-1 ring-white/10"
    >
      {image ? (
        // The preview and saved cover share these exact decoded pixels.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt="Selected video frame"
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/45">
          {capturing ? (
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          ) : (
            <Film className="h-6 w-6" />
          )}
          <span className="text-xs">
            {capturing ? "Opening your video…" : "No frame selected"}
          </span>
        </div>
      )}
      {capturing && image ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-4 text-xs text-white">
          <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
          Finding your frame…
        </div>
      ) : null}
    </div>
  );
}

/** A full-width timeline for finding the moment, then stepping to its exact frame. */
export default function FramePicker({
  index,
  frameCount,
  duration,
  time,
  tiles,
  tilesLoading,
  capturing,
  error,
  onSelect,
  onJump,
  onRetry,
  onSeek,
  onStep,
}: {
  index: number;
  frameCount: number;
  duration: number;
  time: number;
  tiles: FilmstripTile[];
  tilesLoading: boolean;
  capturing: boolean;
  error: string;
  onSelect: (index: number) => void;
  onJump: (seconds: number) => void;
  onRetry: () => void;
  onSeek: (time: number) => void;
  onStep: (frames: number) => void;
}) {
  const ready = frameCount > 0;
  const [enteredFrame, setEnteredFrame] = useState<string | null>(null);
  const progress =
    duration > 0 ? Math.min(100, Math.max(0, (time / duration) * 100)) : 0;
  const commitFrame = () => {
    if (enteredFrame?.trim() && Number.isFinite(Number(enteredFrame)))
      onSelect(Number(enteredFrame) - 1);
    setEnteredFrame(null);
  };

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-medium tracking-tight tabular-nums">
            {formatFrameTime(time)}
          </span>
          <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
            / {formatFrameTime(duration)}
          </span>
        </div>
        <span
          role="status"
          className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px]"
        >
          {error ? (
            "Frame unavailable"
          ) : capturing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
              {ready ? "Finding frame…" : "Loading frames…"}
            </>
          ) : ready ? (
            <>
              <Check className="h-3 w-3 text-[color:var(--sg-green-500)]" />
              Frame selected
            </>
          ) : (
            "Choose a video"
          )}
        </span>
      </div>

      <div className="px-4">
        <div className="relative rounded-md focus-within:ring-2 focus-within:ring-[color:var(--sg-accent)] focus-within:ring-offset-2 focus-within:ring-offset-[color:var(--card)]">
          <Filmstrip
            tiles={tiles}
            loading={tilesLoading}
            duration={duration}
            time={time}
            onPick={onSeek}
          />
          {!tilesLoading && !tiles.length ? (
            <div className="bg-muted h-16 rounded-md" />
          ) : null}
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.001)}
            step="any"
            value={time}
            disabled={!ready}
            onChange={(event) => onSeek(Number(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                const direction = event.key === "ArrowLeft" ? -1 : 1;
                if (event.shiftKey) onJump(direction);
                else onStep(direction);
              } else if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                onSelect(event.key === "Home" ? 0 : frameCount - 1);
              }
            }}
            className="absolute inset-0 z-10 m-0 h-full w-full cursor-ew-resize opacity-0 disabled:cursor-wait"
            aria-label="Frame position"
            aria-valuetext={`Frame ${ready ? index + 1 : 0} of ${frameCount}, ${formatFrameTime(time)}`}
          />
          {ready ? (
            <div
              className="pointer-events-none absolute -top-1 -bottom-1 z-20 w-0.5 bg-[color:var(--sg-accent)] shadow-[0_0_0_1px_rgba(0,0,0,.4)]"
              style={{ left: `${progress}%` }}
            >
              <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-[2px] bg-[color:var(--sg-accent)]" />
            </div>
          ) : null}
        </div>
        <div
          aria-hidden
          className="text-muted-foreground mt-2 flex justify-between font-mono text-[10px] tabular-nums"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
            <span key={fraction}>{formatFrameTime(duration * fraction)}</span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!ready || index === 0}
            aria-label="Back one second"
            title="Back one second · Shift + ←"
            onClick={() => onJump(-1)}
            className="text-muted-foreground gap-1 px-2 font-mono text-xs"
          >
            <ChevronsLeft className="h-4 w-4" />
            1s
          </Button>
          <div className="border-border inline-flex overflow-hidden rounded-lg border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!ready || index === 0}
              aria-label="Back one frame"
              title="Back one frame · ←"
              onClick={() => onStep(-1)}
              className="rounded-none px-3 font-mono text-xs"
            >
              <ChevronLeft className="h-4 w-4" />
              1f
            </Button>
            <span className="bg-border my-2 w-px" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!ready || index === frameCount - 1}
              aria-label="Forward one frame"
              title="Forward one frame · →"
              onClick={() => onStep(1)}
              className="rounded-none px-3 font-mono text-xs"
            >
              1f
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!ready || index === frameCount - 1}
            aria-label="Forward one second"
            title="Forward one second · Shift + →"
            onClick={() => onJump(1)}
            className="text-muted-foreground gap-1 px-2 font-mono text-xs"
          >
            1s
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          Frame
          <input
            type="number"
            min={1}
            max={frameCount || 1}
            step={1}
            disabled={!ready}
            value={enteredFrame ?? (ready ? index + 1 : "")}
            onChange={(event) => setEnteredFrame(event.target.value)}
            onBlur={commitFrame}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitFrame();
              }
              if (event.key === "Escape") {
                setEnteredFrame(null);
              }
            }}
            aria-label="Go to frame"
            className="border-border bg-background text-foreground h-8 w-[4.5rem] rounded-md border px-2 text-center font-mono text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)]"
          />
          <span className="font-mono text-[11px] tabular-nums">
            / {frameCount}
          </span>
        </label>
      </div>
      <div className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-[11px]">
        <span>Drag to find the moment. Step to get it exact.</span>
        <span className="hidden sm:inline">
          <kbd className="font-mono">← →</kbd> frame{" "}
          <span className="mx-1 opacity-40">/</span>{" "}
          <kbd className="font-mono">Shift + ← →</kbd> second
        </span>
      </div>
      {error ? (
        <div
          role="alert"
          className="border-border flex items-center justify-between gap-3 border-t px-4 py-3 text-xs text-amber-500"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded px-2 py-1 font-medium underline underline-offset-4 focus-visible:ring-2"
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}
