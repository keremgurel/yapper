"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStudio } from "@/components/studio/studio-context";
import AspectPicker from "@/components/studio/aspect-picker";
import AudioTracksPlayer from "@/components/studio/audio-tracks-player";
import AutoEditProgress from "@/components/studio/auto-edit-progress";
import OverlayLayer from "@/components/studio/overlay-layer";
import CaptionLayer from "@/components/studio/caption-layer";
import RightPanel from "@/components/studio/right-panel";
import StudioTimeline from "@/components/studio/studio-timeline";
import StudioTransport from "@/components/studio/studio-transport";
import EmptyTimeline from "@/components/studio/empty-timeline";
import { MEDIA_DND_TYPE } from "@/components/studio/media-tab";
import VideoUploader from "@/components/studio/video-uploader";
import { totalDuration } from "@/lib/studio/clips";
import { useStudioPlayback } from "@/hooks/use-studio-playback";
import { useResizablePanel } from "@/hooks/use-resizable-panel";

export default function StudioWorkspace() {
  const {
    source,
    clips,
    duration,
    aspect,
    baseHidden,
    baseMuted,
    selectedClipIds,
    selectedCaptionIds,
    selectedOverlayIds,
    splitSelected,
    deleteSelected,
    audioTracks,
    overlays,
    addAssetToTimeline,
    undo,
    redo,
  } = useStudio();
  const [dropActive, setDropActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  // The bottom track can drive a <video> clock only when it has clips and isn't
  // a still. Otherwise playback falls back to its synthetic clock.
  const hasVideo = clips.length > 0 && (source?.kind ?? "video") !== "image";
  const isImageBase = clips.length > 0 && source?.kind === "image";
  // Anything on any layer means there's a project to show a stage for.
  const hasProject =
    !!source ||
    clips.length > 0 ||
    overlays.length > 0 ||
    audioTracks.length > 0;
  const {
    timelineTime,
    sourceTime,
    playing,
    play,
    pause,
    seekToTimeline,
    seekToSource,
  } = useStudioPlayback(videoRef, {
    clips,
    total: duration,
    hasVideo,
    baseUrl: source?.url ?? "",
  });
  const { width, onPointerDown } = useResizablePanel();

  // Measure the preview area so we can size a fixed-aspect project stage.
  const previewRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setBox({ w: el.clientWidth, h: el.clientHeight }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [source]);

  // Vertical resize of the timeline panel (takes height from the preview).
  const [bottomH, setBottomH] = useState(380);
  const [resizingH, setResizingH] = useState(false);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startH: bottomH };
      setResizingH(true);
    },
    [bottomH],
  );

  useEffect(() => {
    if (!resizingH) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const next = d.startH + (d.startY - e.clientY);
      setBottomH(Math.max(280, Math.min(window.innerHeight * 0.75, next)));
    };
    const onUp = () => setResizingH(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizingH]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === " ") {
        // Key off playback state, not the <video> element — image-base projects
        // have no <video>, so an element check would make Space a no-op there.
        e.preventDefault();
        if (playing) pause();
        else play();
      } else if (e.key.toLowerCase() === "s" && !mod) {
        // Timeline seconds, not the <video>'s own clock: the playhead is the one
        // position every layer shares, and only the bottom track has a <video>.
        e.preventDefault();
        splitSelected(timelineTime);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // One delete for everything selected — base clips, overlays, captions,
        // or any mix of them.
        if (
          selectedClipIds.length ||
          selectedOverlayIds.length ||
          selectedCaptionIds.length
        ) {
          e.preventDefault();
          deleteSelected();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    undo,
    redo,
    play,
    pause,
    playing,
    timelineTime,
    splitSelected,
    deleteSelected,
    selectedClipIds,
    selectedCaptionIds,
    selectedOverlayIds,
  ]);

  // The bottom track only occupies the timeline up to its own end; past that
  // (or when it's hidden) the stage shows the layers above it over black. When
  // nothing outlasts it, the playhead resting on its final frame still shows
  // that frame rather than blacking out the moment playback stops.
  const baseTotal = totalDuration(clips);
  const baseOutlasted =
    duration > baseTotal + 0.03 && timelineTime >= baseTotal;
  const baseVisible = !baseHidden && !baseOutlasted;
  let stageW = box.w;
  let stageH = box.w / aspect;
  if (stageH > box.h) {
    stageH = box.h;
    stageW = box.h * aspect;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Main: preview + transport + timeline */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          ref={previewRef}
          style={{ background: "var(--sg-bg-2)" }}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4"
        >
          <AutoEditProgress />
          {hasProject ? (
            <>
              {/* Not `overflow-hidden`: an overlay's corner handles sit on its
                  edges, so a full-frame overlay's handles must be able to
                  overhang the stage. Every layer clips its own media instead,
                  and none of them can extend past the frame anyway. */}
              <div
                className="relative rounded-lg bg-black shadow-2xl"
                style={{ width: stageW || 0, height: stageH || 0 }}
              >
                {isImageBase && source && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={source.url}
                    alt=""
                    className="absolute inset-0 h-full w-full rounded-lg object-cover"
                    style={{ visibility: baseVisible ? "visible" : "hidden" }}
                    onClick={() => (playing ? pause() : play())}
                  />
                )}
                {hasVideo && (
                  // src is managed imperatively by the playback hook so it can
                  // switch between the bottom track's appended sources. Kept
                  // mounted even while hidden — it's the clock.
                  <video
                    ref={videoRef}
                    className="absolute inset-0 h-full w-full rounded-lg object-cover"
                    playsInline
                    muted={baseMuted}
                    style={{ visibility: baseVisible ? "visible" : "hidden" }}
                    onClick={() => (playing ? pause() : play())}
                  />
                )}
                <OverlayLayer
                  overlays={overlays}
                  masterTime={timelineTime}
                  playing={playing}
                />
                <CaptionLayer masterTime={timelineTime} />
              </div>
              <AudioTracksPlayer
                tracks={audioTracks}
                masterTime={timelineTime}
                playing={playing}
              />
            </>
          ) : (
            <VideoUploader />
          )}
        </div>

        {/* Vertical resize handle */}
        <div
          onPointerDown={onResizeDown}
          className="border-border bg-card hover:bg-muted flex h-2 shrink-0 cursor-row-resize items-center justify-center border-t"
        >
          <span className="bg-foreground/25 h-0.5 w-10 rounded-full" />
        </div>

        <div
          style={{ height: bottomH }}
          className="bg-card flex shrink-0 flex-col px-4 pt-2 pb-3"
        >
          <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
            <p className="text-foreground/55 truncate text-xs">
              {source?.name ?? "No video yet"}
            </p>
            <AspectPicker />
          </div>
          <div className="shrink-0">
            <StudioTransport
              playing={playing}
              currentTimelineTime={timelineTime}
              totalTimelineTime={duration}
              onPlay={play}
              onPause={pause}
              onSplit={() => splitSelected(timelineTime)}
            />
          </div>
          <div
            className={`mt-3 min-h-0 flex-1 rounded-md transition-shadow ${
              dropActive ? "ring-2 ring-cyan-500/70" : ""
            }`}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes(MEDIA_DND_TYPE)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setDropActive(true);
              }
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => {
              const id = e.dataTransfer.getData(MEDIA_DND_TYPE);
              setDropActive(false);
              if (id) {
                e.preventDefault();
                addAssetToTimeline(id, timelineTime);
              }
            }}
          >
            {hasProject ? (
              <StudioTimeline
                clips={clips}
                source={source}
                currentTimelineTime={timelineTime}
                onSeek={seekToTimeline}
              />
            ) : (
              <EmptyTimeline />
            )}
          </div>
        </div>
      </div>

      {/* Drag handle (desktop) */}
      <div
        onPointerDown={onPointerDown}
        className="bg-border hover:bg-foreground/30 hidden w-1 shrink-0 cursor-col-resize transition-colors lg:block"
        role="separator"
        aria-orientation="vertical"
      />

      {/* Right panel: Media + Transcript tabs (resizable / stacks on mobile) */}
      <aside
        style={{ width }}
        className="border-border flex min-h-0 shrink-0 flex-col border-t max-lg:!h-[44vh] max-lg:!w-full lg:border-t-0 lg:border-l"
      >
        <RightPanel
          currentSourceTime={sourceTime}
          onSeek={seekToSource}
          onSeekTimeline={seekToTimeline}
        />
      </aside>
    </div>
  );
}
