"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStudio } from "@/components/studio/studio-context";
import {
  sourceToTimeline,
  timelineToSource,
  totalDuration,
} from "@/lib/studio/clips";
import { useFilmstrip, type Frame } from "@/hooks/use-filmstrip";
import type { Clip } from "@/lib/studio/types";

const MIN_PX = 12;
const MAX_PX = 800;
const MIN_CLIP = 0.2;

function framesForClip(frames: Frame[], clip: Clip): Frame[] {
  return frames.filter((f) => f.time >= clip.start && f.time <= clip.end);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

interface TrimDrag {
  id: string;
  edge: "start" | "end";
  startX: number;
  origStart: number;
  origEnd: number;
}

export default function StudioTimeline({
  clips,
  sourceUrl,
  sourceDuration,
  currentSourceTime,
  selectedClipId,
  onSelect,
  onSeekSource,
}: {
  clips: Clip[];
  sourceUrl: string;
  sourceDuration: number;
  currentSourceTime: number;
  selectedClipId: string | null;
  onSelect: (id: string) => void;
  onSeekSource: (t: number) => void;
}) {
  const { setClipRange } = useStudio();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pxPerSec, setPxPerSec] = useState(80);
  const [scrubbing, setScrubbing] = useState(false);
  const [trim, setTrim] = useState<TrimDrag | null>(null);
  const [live, setLive] = useState<{ start: number; end: number } | null>(null);
  const frames = useFilmstrip(sourceUrl, sourceDuration);

  const total = totalDuration(clips);
  const trackWidth = Math.max(total * pxPerSec, 1);
  const playheadX = sourceToTimeline(clips, currentSourceTime) * pxPerSec;

  /* ---- scrub ---- */
  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = scrollRef.current;
      if (!el || total <= 0) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left + el.scrollLeft;
      onSeekSource(timelineToSource(clips, clamp(x / pxPerSec, 0, total)));
    },
    [clips, total, pxPerSec, onSeekSource],
  );

  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (e: PointerEvent) => seekFromClientX(e.clientX);
    const onUp = () => setScrubbing(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [scrubbing, seekFromClientX]);

  /* ---- trim ---- */
  useEffect(() => {
    if (!trim) return;
    const idx = clips.findIndex((c) => c.id === trim.id);
    const clip = clips[idx];
    if (!clip) return;
    const prevEnd = clips[idx - 1]?.end ?? 0;
    const nextStart = clips[idx + 1]?.start ?? sourceDuration;

    const onMove = (e: PointerEvent) => {
      const deltaSec = (e.clientX - trim.startX) / pxPerSec;
      if (trim.edge === "start") {
        const start = clamp(
          trim.origStart + deltaSec,
          prevEnd,
          trim.origEnd - MIN_CLIP,
        );
        setLive({ start, end: trim.origEnd });
      } else {
        const end = clamp(
          trim.origEnd + deltaSec,
          trim.origStart + MIN_CLIP,
          nextStart,
        );
        setLive({ start: trim.origStart, end });
      }
    };
    const onUp = () => {
      setLive((l) => {
        if (l) setClipRange(trim.id, l.start, l.end);
        return null;
      });
      setTrim(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [trim, clips, sourceDuration, pxPerSec, setClipRange]);

  /* ---- wheel zoom ---- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // let horizontal scroll pass
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left + el.scrollLeft;
      const timeAtCursor = cursorX / pxPerSec;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const next = clamp(pxPerSec * factor, MIN_PX, MAX_PX);
      setPxPerSec(next);
      requestAnimationFrame(() => {
        el.scrollLeft = timeAtCursor * next - (e.clientX - rect.left);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [pxPerSec]);

  const ticks = buildTicks(total, pxPerSec);

  return (
    <div className="flex h-full min-h-0 flex-col select-none">
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
        <div className="relative min-h-full" style={{ width: trackWidth }}>
          {/* Ruler */}
          <div
            onPointerDown={(e) => {
              e.preventDefault();
              setScrubbing(true);
              seekFromClientX(e.clientX);
            }}
            className="bg-muted hover:bg-foreground/10 sticky top-0 z-20 h-5 cursor-pointer transition-colors"
          >
            {ticks.map((t) => (
              <span
                key={t.sec}
                className="text-foreground/40 absolute top-0 flex h-full items-center pl-1 font-mono text-[9px]"
                style={{ left: t.x }}
              >
                <span className="bg-foreground/20 absolute top-0 left-0 h-1.5 w-px" />
                {t.label}
              </span>
            ))}
          </div>

          {/* Tracks (fixed-height rows; extra panel height is room for more) */}
          <div className="space-y-1 p-1">
            {/* Main video track */}
            <div className="flex h-20 gap-0.5">
              {clips.map((clip) => {
                const isTrimming = trim?.id === clip.id && live;
                const start = isTrimming ? live.start : clip.start;
                const end = isTrimming ? live.end : clip.end;
                const width = Math.max((end - start) * pxPerSec, 4);
                const selected = clip.id === selectedClipId;
                const clipFrames = framesForClip(frames, clip);
                return (
                  <div
                    key={clip.id}
                    style={{ width }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(clip.id);
                    }}
                    className={`group relative h-full shrink-0 cursor-pointer overflow-hidden rounded-md ${
                      selected
                        ? "ring-2 ring-cyan-500"
                        : "ring-1 ring-white/10 hover:ring-white/25"
                    }`}
                    title={`${start.toFixed(2)}s – ${end.toFixed(2)}s`}
                  >
                    {clipFrames.length > 0 ? (
                      <span className="pointer-events-none flex h-full w-full">
                        {clipFrames.map((f) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={f.time}
                            src={f.src}
                            alt=""
                            draggable={false}
                            className="h-full min-w-0 flex-1 object-cover"
                          />
                        ))}
                      </span>
                    ) : (
                      <span className="bg-foreground/15 block h-full w-full" />
                    )}

                    {/* Trim handles */}
                    <span
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelect(clip.id);
                        setTrim({
                          id: clip.id,
                          edge: "start",
                          startX: e.clientX,
                          origStart: clip.start,
                          origEnd: clip.end,
                        });
                      }}
                      className={`absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l-md bg-cyan-400/80 transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-70"}`}
                    />
                    <span
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelect(clip.id);
                        setTrim({
                          id: clip.id,
                          edge: "end",
                          startX: e.clientX,
                          origStart: clip.start,
                          origEnd: clip.end,
                        });
                      }}
                      className={`absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-md bg-cyan-400/80 transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-70"}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Playhead */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-red-500"
            style={{ left: playheadX }}
          >
            <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-red-500" />
          </div>
        </div>
      </div>
      <p className="text-foreground/45 mt-1.5 shrink-0 text-xs">
        {clips.length} {clips.length === 1 ? "clip" : "clips"} · scroll to zoom
        · drag clip edges to trim · drag the ruler to scrub
      </p>
    </div>
  );
}

function buildTicks(total: number, pxPerSec: number) {
  if (total <= 0) return [] as { sec: number; x: number; label: string }[];
  const targetPx = 90;
  const raw = targetPx / pxPerSec;
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  const step = steps.find((s) => s >= raw) ?? 600;
  const out: { sec: number; x: number; label: string }[] = [];
  for (let s = 0; s <= total + 0.001; s += step) {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    out.push({
      sec: s,
      x: s * pxPerSec,
      label: `${m}:${String(sec).padStart(2, "0")}`,
    });
  }
  return out;
}
