"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Music2,
  Trash2,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import {
  sourceToTimeline,
  timelineToSource,
  totalDuration,
} from "@/lib/studio/clips";
import { useFilmstrip } from "@/hooks/use-filmstrip";
import { useWaveform } from "@/hooks/use-waveform";
import WaveformCanvas from "@/components/studio/waveform-canvas";
import ClipFilmstrip from "@/components/studio/clip-filmstrip";
import type { Clip } from "@/lib/studio/types";

const MIN_PX = 12;
const MAX_PX = 800;
const MIN_CLIP = 0.2;

interface ClipSpan {
  leftPx: number;
  widthPx: number;
  srcA: number;
  srcB: number;
}

/**
 * Intersect a clip with the visible window and map back to source seconds, so
 * the track only renders frames/waveform for what's on screen. Returns null
 * when the clip is fully off-screen.
 */
function visibleSpan(
  clipLeftSec: number,
  clipDur: number,
  srcStart: number,
  srcEnd: number,
  visStartSec: number,
  visEndSec: number,
  pxPerSec: number,
): ClipSpan | null {
  if (clipDur <= 0) return null;
  const a = Math.max(clipLeftSec, visStartSec);
  const b = Math.min(clipLeftSec + clipDur, visEndSec);
  if (b <= a) return null;
  const fracA = (a - clipLeftSec) / clipDur;
  const fracB = (b - clipLeftSec) / clipDur;
  return {
    leftPx: (a - clipLeftSec) * pxPerSec,
    widthPx: (b - a) * pxPerSec,
    srcA: srcStart + fracA * (srcEnd - srcStart),
    srcB: srcStart + fracB * (srcEnd - srcStart),
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function snapValue(v: number, points: number[], threshold: number): number {
  let best = v;
  let bestD = threshold;
  for (const p of points) {
    const d = Math.abs(p - v);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
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
  const {
    setClipRange,
    audioTracks,
    moveAudio,
    toggleAudioMuted,
    removeAudio,
    overlays,
    moveOverlay,
    removeOverlay,
    snapping,
  } = useStudio();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pxPerSec, setPxPerSec] = useState(80);
  const [scrubbing, setScrubbing] = useState(false);
  const [trim, setTrim] = useState<TrimDrag | null>(null);
  const [live, setLive] = useState<{ start: number; end: number } | null>(null);
  const [audioDrag, setAudioDrag] = useState<{
    id: string;
    startX: number;
    origStart: number;
  } | null>(null);
  const [overlayDrag, setOverlayDrag] = useState<{
    id: string;
    startX: number;
    origStart: number;
  } | null>(null);
  const { frames, aspect } = useFilmstrip(sourceUrl, sourceDuration);
  const peaks = useWaveform(sourceUrl, sourceDuration);
  const [view, setView] = useState({ start: 0, width: 0 });

  const total = totalDuration(clips);
  const trackWidth = Math.max(total * pxPerSec, 1);
  const playheadX = sourceToTimeline(clips, currentSourceTime) * pxPerSec;

  // Snap a clip's start (or its end) to nearby edges when magnet mode is on.
  const snapStart = useCallback(
    (start: number, dur: number): number => {
      if (!snapping) return Math.max(0, start);
      const threshold = 8 / pxPerSec;
      const points = [
        0,
        total,
        sourceToTimeline(clips, currentSourceTime),
        ...clips.map((_, i) =>
          clips.slice(0, i + 1).reduce((s, c) => s + (c.end - c.start), 0),
        ),
      ];
      const ss = snapValue(start, points, threshold);
      if (ss !== start) return Math.max(0, ss);
      const se = snapValue(start + dur, points, threshold);
      if (se !== start + dur) return Math.max(0, se - dur);
      return Math.max(0, start);
    },
    [snapping, pxPerSec, total, clips, currentSourceTime],
  );

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

  /* ---- audio clip drag ---- */
  useEffect(() => {
    if (!audioDrag) return;
    const dur = audioTracks.find((t) => t.id === audioDrag.id)?.duration ?? 0;
    const onMove = (e: PointerEvent) => {
      const delta = (e.clientX - audioDrag.startX) / pxPerSec;
      moveAudio(audioDrag.id, snapStart(audioDrag.origStart + delta, dur));
    };
    const onUp = () => setAudioDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [audioDrag, pxPerSec, moveAudio, audioTracks, snapStart]);

  /* ---- overlay clip drag ---- */
  useEffect(() => {
    if (!overlayDrag) return;
    const dur = overlays.find((o) => o.id === overlayDrag.id)?.duration ?? 0;
    const onMove = (e: PointerEvent) => {
      const delta = (e.clientX - overlayDrag.startX) / pxPerSec;
      moveOverlay(
        overlayDrag.id,
        snapStart(overlayDrag.origStart + delta, dur),
      );
    };
    const onUp = () => setOverlayDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [overlayDrag, pxPerSec, moveOverlay, overlays, snapStart]);

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

  /* ---- track the visible window so we only render on-screen frames ---- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () =>
      setView({ start: el.scrollLeft, width: el.clientWidth });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  // Visible time range (+ one screen of margin each side) for windowed render.
  const measured = view.width > 0;
  const visStartSec = measured ? (view.start - view.width) / pxPerSec : 0;
  const visEndSec = measured ? (view.start + view.width * 2) / pxPerSec : total;

  const ticks = buildTicks(total, pxPerSec);

  // Cumulative timeline offset (seconds) for each clip, from committed durations.
  const offsets = clips.map((_, i) =>
    clips.slice(0, i).reduce((s, c) => s + (c.end - c.start), 0),
  );

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
            <div className="relative h-20">
              {clips.map((clip, i) => {
                const isTrimming = trim?.id === clip.id && live;
                const cStart = isTrimming ? live.start : clip.start;
                const cEnd = isTrimming ? live.end : clip.end;
                const dur = cEnd - cStart;
                const origDur = clip.end - clip.start;
                // Left-trim keeps the right edge fixed so the dragged edge tracks
                // the cursor; right-trim keeps the left edge fixed.
                const leftSec =
                  isTrimming && trim?.edge === "start"
                    ? offsets[i] + (origDur - dur)
                    : offsets[i];
                const width = Math.max(dur * pxPerSec, 4);
                const selected = clip.id === selectedClipId;
                const span = visibleSpan(
                  leftSec,
                  dur,
                  cStart,
                  cEnd,
                  visStartSec,
                  visEndSec,
                  pxPerSec,
                );
                return (
                  <div
                    key={clip.id}
                    style={{
                      left: leftSec * pxPerSec,
                      width,
                      transition: trim
                        ? "none"
                        : "left 90ms ease, width 90ms ease",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(clip.id);
                    }}
                    className={`group absolute top-0 bottom-0 cursor-pointer overflow-hidden rounded-md ${
                      selected
                        ? "z-10 ring-2 ring-cyan-500"
                        : "ring-1 ring-white/10 hover:ring-white/25"
                    }`}
                    title={`${cStart.toFixed(2)}s – ${cEnd.toFixed(2)}s`}
                  >
                    <span className="bg-foreground/15 absolute inset-0" />
                    {span && frames.length > 0 && (
                      <ClipFilmstrip
                        frames={frames}
                        aspect={aspect}
                        leftPx={span.leftPx}
                        widthPx={span.widthPx}
                        srcStart={span.srcA}
                        srcEnd={span.srcB}
                        height={80}
                      />
                    )}

                    {span && peaks.length > 0 && (
                      <span
                        className="pointer-events-none absolute bottom-0 bg-black/50"
                        style={{ left: span.leftPx, width: span.widthPx }}
                      >
                        <WaveformCanvas
                          peaks={peaks}
                          sourceDuration={sourceDuration}
                          clipStart={span.srcA}
                          clipEnd={span.srcB}
                          width={span.widthPx}
                          height={28}
                        />
                      </span>
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

            {/* Overlay tracks (image / video) */}
            {overlays.map((o) => {
              const left = o.start * pxPerSec;
              const width = Math.max(o.duration * pxPerSec, 8);
              return (
                <div key={o.id} className="relative h-12">
                  <div
                    style={{ left, width }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setOverlayDrag({
                        id: o.id,
                        startX: e.clientX,
                        origStart: o.start,
                      });
                    }}
                    className="absolute inset-y-0 flex cursor-grab items-center gap-1.5 overflow-hidden rounded-md bg-fuchsia-500/25 px-2 ring-1 ring-fuchsia-500/50 active:cursor-grabbing"
                  >
                    {o.kind === "image" ? (
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 text-fuchsia-300" />
                    ) : (
                      <Video className="h-3.5 w-3.5 shrink-0 text-fuchsia-300" />
                    )}
                    <span className="text-foreground/80 min-w-0 flex-1 truncate text-[11px] font-bold">
                      {o.name}
                    </span>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => removeOverlay(o.id)}
                      className="text-foreground/60 shrink-0 hover:text-red-400"
                      aria-label="Remove overlay"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Audio tracks */}
            {audioTracks.map((a) => {
              const left = a.start * pxPerSec;
              const width = Math.max(a.duration * pxPerSec, 8);
              return (
                <div key={a.id} className="relative h-12">
                  <div
                    style={{ left, width }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setAudioDrag({
                        id: a.id,
                        startX: e.clientX,
                        origStart: a.start,
                      });
                    }}
                    className="absolute inset-y-0 flex cursor-grab items-center gap-1.5 overflow-hidden rounded-md bg-emerald-500/25 px-2 ring-1 ring-emerald-500/50 active:cursor-grabbing"
                  >
                    <Music2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                    <span className="text-foreground/80 min-w-0 flex-1 truncate text-[11px] font-bold">
                      {a.name}
                    </span>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => toggleAudioMuted(a.id)}
                      className="text-foreground/60 hover:text-foreground shrink-0"
                      aria-label={a.muted ? "Unmute" : "Mute"}
                    >
                      {a.muted ? (
                        <VolumeX className="h-3.5 w-3.5" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => removeAudio(a.id)}
                      className="text-foreground/60 shrink-0 hover:text-red-400"
                      aria-label="Remove audio"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
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
