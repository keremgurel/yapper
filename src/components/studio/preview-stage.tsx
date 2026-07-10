"use client";

import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/components/studio/studio-context";
import AudioTracksPlayer from "@/components/studio/audio-tracks-player";
import AutoEditProgress from "@/components/studio/auto-edit-progress";
import CaptionLayer from "@/components/studio/caption-layer";
import OverlayLayer from "@/components/studio/overlay-layer";
import VideoUploader from "@/components/studio/video-uploader";
import { totalDuration } from "@/lib/studio/clips";

/**
 * The project stage: the bottom track's picture, the layers over it, and the
 * audio that plays alongside. It fills whatever space the layout gives it and
 * sizes the frame to the project's ratio, so the same component serves a wide
 * pane above the timeline and a tall one beside it.
 */
export default function PreviewStage({
  videoRef,
  timelineTime,
  playing,
  onTogglePlay,
}: {
  /** The bottom track's element. It is the master clock, so the shell owns it. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  timelineTime: number;
  playing: boolean;
  onTogglePlay: () => void;
}) {
  const {
    source,
    clips,
    duration,
    aspect,
    baseHidden,
    baseMuted,
    overlays,
    audioTracks,
  } = useStudio();

  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setBox({ w: el.clientWidth, h: el.clientHeight }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasVideo = clips.length > 0 && (source?.kind ?? "video") !== "image";
  const isImageBase = clips.length > 0 && source?.kind === "image";
  const hasProject =
    !!source ||
    clips.length > 0 ||
    overlays.length > 0 ||
    audioTracks.length > 0;

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
    <div
      ref={ref}
      style={{ background: "var(--sg-bg-2)" }}
      className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden p-4"
    >
      <AutoEditProgress />
      {hasProject ? (
        <>
          {/* Not `overflow-hidden`: an overlay's corner handles sit on its
              edges, so a full-frame overlay's handles must be able to overhang
              the stage. Every layer clips its own media instead, and none of
              them can extend past the frame anyway. */}
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
                onClick={onTogglePlay}
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
                onClick={onTogglePlay}
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
  );
}
