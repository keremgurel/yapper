"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Music2, Video } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { clipDuration, totalDuration } from "@/lib/studio/clips";
import { useFilmstrip } from "@/hooks/use-filmstrip";
import { useWaveform } from "@/hooks/use-waveform";
import WaveformCanvas from "@/components/studio/waveform-canvas";
import ClipFilmstrip from "@/components/studio/clip-filmstrip";
import UpperTrackLane from "@/components/studio/upper-track-lane";
import TrackHeaderRail from "@/components/studio/track-header-rail";
import { visibleSpan } from "@/lib/studio/window";
import type { Clip } from "@/lib/studio/types";

const MIN_PX = 12;
const MAX_PX = 800;
const MIN_CLIP = 0.2;
const LIFT_THRESHOLD = 40; // drag a clip up this far to spawn a new upper track

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
  sourceKind = "video",
  sourceDuration,
  currentTimelineTime,
  selectedClipId,
  onSelect,
  onSeek,
}: {
  clips: Clip[];
  sourceUrl: string;
  sourceKind?: "video" | "image";
  sourceDuration: number;
  currentTimelineTime: number;
  selectedClipId: string | null;
  onSelect: (id: string) => void;
  onSeek: (timelineTime: number) => void;
}) {
  const isImage = sourceKind === "image";
  const {
    setClipRange,
    moveClip,
    audioTracks,
    moveAudio,
    toggleAudioMuted,
    removeAudio,
    overlays,
    moveOverlay,
    toggleOverlayHidden,
    toggleOverlayMuted,
    removeOverlay,
    liftClipToTrack,
    snapping,
  } = useStudio();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pxPerSec, setPxPerSec] = useState(80);
  // Live mirror of pxPerSec so rapid pinch events accumulate off the latest
  // value, and the pending zoom anchor to apply after the width re-renders.
  const pxRef = useRef(80);
  const pendingZoomRef = useRef<{ time: number; offsetX: number } | null>(null);
  const zoomRafRef = useRef(false);
  // scrollLeft at which the current render window was committed; we only
  // re-window after drifting past ~half a screen, so panning within the buffer
  // is pure native scroll (no re-render).
  const viewStartRef = useRef(0);
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
  // Reorder drag for main-track clips: origLeft is the clip's resting left (px),
  // clipLive is its current dragged left (px, null until the pointer moves).
  const [clipDrag, setClipDrag] = useState<{
    id: string;
    startX: number;
    startY: number;
    origLeft: number;
  } | null>(null);
  const [clipLive, setClipLive] = useState<number | null>(null);
  // Vertical drag distance (px, negative = up). Past LIFT_THRESHOLD the clip
  // lifts onto a new upper video track instead of reordering.
  const [clipLiftY, setClipLiftY] = useState(0);
  const { frames, aspect } = useFilmstrip(sourceUrl, sourceDuration);
  const peaks = useWaveform(sourceUrl, sourceDuration);
  const [view, setView] = useState({ start: 0, width: 0 });

  const total = totalDuration(clips);
  const trackWidth = Math.max(total * pxPerSec, 1);
  const playheadX = currentTimelineTime * pxPerSec;

  // Empty gutter on each side so the start (or end) can be scrolled to center,
  // giving room to drag. Content lives at x = padLeft; nothing sits before it.
  const measured = view.width > 0;
  const padLeft = measured ? Math.round(view.width / 2) : 240;

  // Snap a clip's start (or its end) to nearby edges when magnet mode is on.
  const snapStart = useCallback(
    (start: number, dur: number): number => {
      if (!snapping) return Math.max(0, start);
      const threshold = 8 / pxPerSec;
      const points = [
        0,
        total,
        currentTimelineTime,
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
    [snapping, pxPerSec, total, clips, currentTimelineTime],
  );

  /* ---- scrub ---- */
  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = scrollRef.current;
      if (!el || total <= 0) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left + el.scrollLeft - padLeft;
      onSeek(clamp(x / pxPerSec, 0, total));
    },
    [total, pxPerSec, padLeft, onSeek],
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
    // Magnet targets (in source seconds): neighbor edges and the playhead.
    const offset = clips
      .slice(0, idx)
      .reduce((s, c) => s + (c.end - c.start), 0);
    const clipDur = clip.end - clip.start;
    const playheadInClip =
      currentTimelineTime >= offset && currentTimelineTime <= offset + clipDur;
    const playheadSource = clip.start + (currentTimelineTime - offset);
    const snapEdge = (t: number) => {
      if (!snapping) return t;
      const th = 8 / pxPerSec;
      const points = playheadInClip
        ? [prevEnd, nextStart, playheadSource]
        : [prevEnd, nextStart];
      for (const p of points) if (Math.abs(p - t) < th) return p;
      return t;
    };

    let current: { start: number; end: number } | null = null;
    const onMove = (e: PointerEvent) => {
      const deltaSec = (e.clientX - trim.startX) / pxPerSec;
      if (trim.edge === "start") {
        const start = clamp(
          snapEdge(trim.origStart + deltaSec),
          prevEnd,
          trim.origEnd - MIN_CLIP,
        );
        current = { start, end: trim.origEnd };
      } else {
        const end = clamp(
          snapEdge(trim.origEnd + deltaSec),
          trim.origStart + MIN_CLIP,
          nextStart,
        );
        current = { start: trim.origStart, end };
      }
      setLive(current);
    };
    const onUp = () => {
      if (current) setClipRange(trim.id, current.start, current.end);
      setLive(null);
      setTrim(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [
    trim,
    clips,
    sourceDuration,
    pxPerSec,
    setClipRange,
    snapping,
    currentTimelineTime,
  ]);

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

  /* ---- main-clip drag: reorder, or lift up to a new upper track ---- */
  useEffect(() => {
    if (!clipDrag) return;
    const dragged = clips.find((c) => c.id === clipDrag.id);
    const dur = dragged ? clipDuration(dragged) : 0;
    // Track the drag in closure vars so the drop can read the final position
    // directly (no setState-inside-setState, which React warns about).
    let live: number | null = null;
    let liftY = 0;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - clipDrag.startX;
      const dy = e.clientY - clipDrag.startY;
      if (live == null && Math.hypot(dx, dy) < 4) return; // ignore a click's jitter
      live = clipDrag.origLeft + dx;
      liftY = dy;
      setClipLive(live);
      setClipLiftY(dy);
    };
    const onUp = () => {
      if (live != null && liftY < -LIFT_THRESHOLD) {
        // Lifted up: move this segment onto a new upper video track.
        liftClipToTrack(clipDrag.id, Math.max(0, live / pxPerSec));
      } else if (live != null) {
        // Drop where the dragged clip's center lands among the others.
        const center = live / pxPerSec + dur / 2;
        let acc = 0;
        let target = 0;
        for (const c of clips) {
          const d = clipDuration(c);
          const mid = acc + d / 2;
          if (c.id !== clipDrag.id && mid < center) target++;
          acc += d;
        }
        moveClip(clipDrag.id, target);
      }
      setClipLive(null);
      setClipLiftY(0);
      setClipDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [clipDrag, clips, pxPerSec, moveClip, liftClipToTrack]);

  /* ---- wheel: pan by default, zoom-at-cursor on pinch / ⌘-scroll ---- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const lineUnit = e.deltaMode === 1 ? 16 : 1; // normalize mouse "line" deltas
      // Trackpad pinch reports ctrlKey; ⌘/Ctrl+wheel is the explicit zoom.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const current = pxRef.current;
        const timeAtCursor = (offsetX + el.scrollLeft - padLeft) / current;
        const next = clamp(
          current * Math.exp(-e.deltaY * lineUnit * 0.0025),
          MIN_PX,
          MAX_PX,
        );
        if (next === current) return;
        pxRef.current = next;
        // Applied in a layout effect once the new width has rendered — no flash.
        pendingZoomRef.current = { time: timeAtCursor, offsetX };
        // Coalesce rapid pinch events into one render per frame.
        if (!zoomRafRef.current) {
          zoomRafRef.current = true;
          requestAnimationFrame(() => {
            zoomRafRef.current = false;
            setPxPerSec(pxRef.current);
          });
        }
        return;
      }
      // Horizontal-intent gestures scroll natively (smooth, compositor-threaded).
      // Only convert vertical intent (mouse wheel) into horizontal panning.
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY * lineUnit;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [padLeft]);

  // Keep pxRef in sync and anchor the cursor point after a zoom re-render.
  useLayoutEffect(() => {
    pxRef.current = pxPerSec;
    const pending = pendingZoomRef.current;
    if (!pending) return;
    const el = scrollRef.current;
    if (el) {
      el.scrollLeft = pending.time * pxPerSec + padLeft - pending.offsetX;
      // Re-anchor the render window to the new scale/position.
      viewStartRef.current = el.scrollLeft;
      setView({ start: el.scrollLeft, width: el.clientWidth });
    }
    pendingZoomRef.current = null;
  }, [pxPerSec, padLeft]);

  /* ---- track the visible window (buffered) so panning stays native/smooth ---- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const commit = () => {
      viewStartRef.current = el.scrollLeft;
      setView({ start: el.scrollLeft, width: el.clientWidth });
    };
    // Start with 0:00 at the left edge; the gutter is scrollable to its left.
    if (el.clientWidth > 0) el.scrollLeft = el.clientWidth / 2;
    commit();
    const onScroll = () => {
      // Re-window only after drifting past ~half a screen; the ±1-screen buffer
      // covers everything in between, so scrolling doesn't re-render each frame.
      if (
        Math.abs(el.scrollLeft - viewStartRef.current) >
        el.clientWidth * 0.5
      ) {
        commit();
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(commit);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  // Visible time range (+ one screen of margin each side) for windowed render.
  const visStartSec = measured
    ? (view.start - padLeft - view.width) / pxPerSec
    : 0;
  const visEndSec = measured
    ? (view.start - padLeft + view.width * 2) / pxPerSec
    : total;

  const ticks = buildTicks(total, pxPerSec);

  // Cumulative timeline offset (seconds) for each clip, from committed durations.
  const offsets = clips.map((_, i) =>
    clips.slice(0, i).reduce((s, c) => s + (c.end - c.start), 0),
  );

  return (
    <div className="flex h-full min-h-0 flex-col select-none">
      <div className="flex min-h-0 flex-1">
        <TrackHeaderRail
          overlays={overlays}
          audioTracks={audioTracks}
          placeholderTrack={overlays.length === 0}
          onToggleOverlayHidden={toggleOverlayHidden}
          onToggleOverlayMuted={toggleOverlayMuted}
          onRemoveOverlay={removeOverlay}
          onToggleAudioMuted={toggleAudioMuted}
          onRemoveAudio={removeAudio}
        />
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
          <div
            className="relative min-h-full"
            style={{ width: trackWidth + padLeft * 2 }}
          >
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
                  style={{ left: t.x + padLeft }}
                >
                  <span className="bg-foreground/20 absolute top-0 left-0 h-1.5 w-px" />
                  {t.label}
                </span>
              ))}
            </div>

            {/* Start boundary — nothing can be placed before 0:00 */}
            <div
              className="bg-foreground/15 pointer-events-none absolute top-5 bottom-0 z-0 w-px"
              style={{ left: padLeft }}
            />

            {/* Tracks (fixed-height rows; extra panel height is room for more) */}
            <div
              className="space-y-1 py-1"
              style={{ paddingLeft: padLeft, paddingRight: padLeft }}
            >
              {/* Empty upper-track drop zone so the timeline always shows room
                for at least a second track. */}
              {overlays.length === 0 && (
                <div className="relative h-16">
                  <div className="border-foreground/10 absolute inset-y-0 right-0 left-0 rounded-md border border-dashed" />
                </div>
              )}

              {/* Upper video tracks — stacked above the base, topmost composites
                on top (last in the overlays array renders highest). */}
              {[...overlays].reverse().map((o) => (
                <UpperTrackLane
                  key={o.id}
                  overlay={o}
                  pxPerSec={pxPerSec}
                  visStartSec={visStartSec}
                  visEndSec={visEndSec}
                  frames={frames}
                  aspect={aspect}
                  peaks={peaks}
                  sourceUrl={sourceUrl}
                  sourceDuration={sourceDuration}
                  onDragStart={(id, clientX, origStart) =>
                    setOverlayDrag({ id, startX: clientX, origStart })
                  }
                />
              ))}

              {/* Main (base) video track */}
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
                  const isGhost = clipDrag?.id === clip.id && clipLive != null;
                  const containerLeftPx = isGhost
                    ? (clipLive as number)
                    : leftSec * pxPerSec;
                  // While trimming, draw frames/waveform against the FULL extent the
                  // edge can be dragged across (down to the previous clip's end / up
                  // to the next clip's start) and let the container's overflow mask
                  // reveal/hide it. The content's source range and absolute position
                  // stay fixed for the whole drag, so the untrimmed side never moves
                  // and extending the edge back out reveals real frames (not gray).
                  const edgeStart = isTrimming && trim?.edge === "start";
                  const edgeEnd = isTrimming && trim?.edge === "end";
                  const prevEnd = clips[i - 1]?.end ?? 0;
                  const nextStart = clips[i + 1]?.start ?? sourceDuration;
                  const contentStartSrc = edgeStart ? prevEnd : cStart;
                  const contentEndSrc = edgeEnd ? nextStart : cEnd;
                  const contentLeftSec = edgeStart
                    ? offsets[i] - (clip.start - prevEnd)
                    : containerLeftPx / pxPerSec;
                  const span = visibleSpan(
                    contentLeftSec,
                    contentEndSrc - contentStartSrc,
                    contentStartSrc,
                    contentEndSrc,
                    visStartSec,
                    visEndSec,
                    pxPerSec,
                  );
                  // Content x in container-local coords (absolute position stays
                  // fixed even as the container's left edge moves during a trim).
                  const contentX = span
                    ? contentLeftSec * pxPerSec - containerLeftPx + span.leftPx
                    : 0;
                  const isLifting = isGhost && clipLiftY < -LIFT_THRESHOLD;
                  return (
                    <div
                      key={clip.id}
                      style={{
                        left: isGhost
                          ? (clipLive as number)
                          : leftSec * pxPerSec,
                        width,
                        transform: isGhost
                          ? `translateY(${clipLiftY}px)`
                          : undefined,
                        transition:
                          trim || isGhost
                            ? "none"
                            : "left 90ms ease, width 90ms ease",
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        onSelect(clip.id);
                        setClipDrag({
                          id: clip.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          origLeft: offsets[i] * pxPerSec,
                        });
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(clip.id);
                      }}
                      className={`group absolute top-0 bottom-0 cursor-grab overflow-hidden rounded-md active:cursor-grabbing ${
                        isLifting
                          ? "z-30 opacity-90 ring-2 ring-fuchsia-400"
                          : isGhost
                            ? "z-30 opacity-90 ring-2 ring-cyan-400"
                            : selected
                              ? "z-10 ring-2 ring-cyan-500"
                              : "ring-1 ring-white/10 hover:ring-white/25"
                      }`}
                      title={`${cStart.toFixed(2)}s – ${cEnd.toFixed(2)}s`}
                    >
                      <span className="bg-foreground/15 absolute inset-0" />
                      {clip.src ? (
                        <span className="absolute inset-0 flex items-center gap-1.5 bg-sky-500/25 px-2 ring-1 ring-sky-500/40">
                          <Video className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                          <span className="text-foreground/80 min-w-0 flex-1 truncate text-[11px] font-bold">
                            {clip.src.name}
                          </span>
                        </span>
                      ) : isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sourceUrl}
                          alt=""
                          draggable={false}
                          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        span &&
                        frames.length > 0 && (
                          <ClipFilmstrip
                            frames={frames}
                            aspect={aspect}
                            leftPx={contentX}
                            widthPx={span.widthPx}
                            srcStart={span.srcA}
                            srcEnd={span.srcB}
                            height={80}
                          />
                        )
                      )}

                      {!clip.src && span && peaks.length > 0 && (
                        <span
                          className="pointer-events-none absolute bottom-0 bg-black/50"
                          style={{ left: contentX, width: span.widthPx }}
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

                      {/* Trim handles — wide invisible grab area, thin visible
                        line so you can see exactly where the edge lands. */}
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
                        className="absolute inset-y-0 left-0 z-20 flex w-3 cursor-ew-resize justify-start"
                      >
                        <span
                          className={`h-full rounded-full bg-cyan-300 transition-[width,opacity] ${
                            trim?.id === clip.id && trim.edge === "start"
                              ? "w-0.5"
                              : "w-1.5"
                          } ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-80"}`}
                        />
                      </span>
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
                        className="absolute inset-y-0 right-0 z-20 flex w-3 cursor-ew-resize justify-end"
                      >
                        <span
                          className={`h-full rounded-full bg-cyan-300 transition-[width,opacity] ${
                            trim?.id === clip.id && trim.edge === "end"
                              ? "w-0.5"
                              : "w-1.5"
                          } ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-80"}`}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>

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
                      className={`absolute inset-y-0 flex cursor-grab items-center gap-1.5 overflow-hidden rounded-md bg-emerald-500/25 px-2 ring-1 ring-emerald-500/50 active:cursor-grabbing ${a.muted ? "opacity-40" : ""}`}
                    >
                      <Music2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                      <span className="text-foreground/80 min-w-0 flex-1 truncate text-[11px] font-bold">
                        {a.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Playhead */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-red-500"
              style={{ left: playheadX + padLeft }}
            >
              <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-red-500" />
            </div>
          </div>
        </div>
      </div>
      <p className="text-foreground/45 mt-1.5 shrink-0 text-xs">
        {clips.length} {clips.length === 1 ? "clip" : "clips"} · scroll to pan ·
        ⌘/pinch-scroll to zoom · drag a clip to reorder · drag it up for a new
        track · drag its edges to trim
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
