"use client";

import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/components/studio/studio-context";
import AiCleanupNotice from "@/components/studio/ai-cleanup-notice";
import AudioTracksPlayer from "@/components/studio/audio-tracks-player";
import AutoEditProgress from "@/components/studio/auto-edit-progress";
import CaptionLayer from "@/components/studio/caption-layer";
import OverlayLayer from "@/components/studio/overlay-layer";
import { totalDuration } from "@/lib/studio/clips";
import { visualFilterCss } from "@/lib/studio/visual-filter";

/**
 * The project stage: the bottom track's picture, the layers over it, and the
 * audio that plays alongside. It fills whatever space the layout gives it and
 * sizes the frame to the project's ratio, so the same component serves a wide
 * pane above the timeline and a tall one beside it.
 */
export default function PreviewStage({
  videoRefs,
  timelineTime,
  playing,
  onTogglePlay,
  playbackPreparing,
  playbackFailed,
}: {
  /** The bottom track's element. It is the master clock, so the shell owns it. */
  videoRefs: React.RefObject<
    [HTMLVideoElement | null, HTMLVideoElement | null]
  >;
  timelineTime: number;
  playing: boolean;
  onTogglePlay: () => void;
  playbackPreparing?: boolean;
  playbackFailed?: boolean;
}) {
  const {
    source,
    clips,
    duration,
    aspect,
    baseHidden,
    overlays,
    audioTracks,
    visualFilter,
  } = useStudio();
  const pictureFilter = visualFilterCss(visualFilter);

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
      <AiCleanupNotice />
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
                style={{
                  visibility: baseVisible ? "visible" : "hidden",
                  filter: pictureFilter,
                }}
                onClick={onTogglePlay}
              />
            )}
            {hasVideo && (
              // Both decoders stay mounted. Playback prepares the hidden one
              // at the next clip and swaps their opacity synchronously at the
              // boundary, instead of making one decoder flush and seek.
              <div
                className="absolute inset-0"
                style={{
                  visibility: baseVisible ? "visible" : "hidden",
                  filter: pictureFilter,
                }}
              >
                {[0, 1].map((slot) => (
                  <video
                    key={slot}
                    ref={(element) => {
                      const index = slot as 0 | 1;
                      const firstMount =
                        element != null && videoRefs.current[index] !== element;
                      videoRefs.current[index] = element;
                      // React must not own this property: coarse playback state
                      // re-renders the stage several times per second and would
                      // otherwise reset every imperative decoder swap.
                      if (firstMount) {
                        element.style.opacity = index === 0 ? "1" : "0";
                      }
                    }}
                    className="absolute inset-0 h-full w-full rounded-lg object-cover"
                    playsInline
                    preload="auto"
                    onClick={onTogglePlay}
                  />
                ))}
              </div>
            )}
            <div className="absolute inset-0" style={{ filter: pictureFilter }}>
              <OverlayLayer
                overlays={overlays}
                masterTime={timelineTime}
                playing={playing}
              />
            </div>
            <CaptionLayer masterTime={timelineTime} />
          </div>
          <AudioTracksPlayer
            tracks={audioTracks}
            masterTime={timelineTime}
            playing={playing}
          />
          {playbackPreparing && (
            <div className="pointer-events-none absolute inset-x-4 bottom-4 z-40 flex justify-center">
              <span className="border-border/70 bg-background/90 text-foreground rounded-full border px-3 py-1.5 text-xs font-bold shadow-xl backdrop-blur">
                Preparing seamless playback…
              </span>
            </div>
          )}
          {playbackFailed && (
            <div className="pointer-events-none absolute inset-x-4 bottom-4 z-40 flex justify-center">
              <span className="rounded-full border border-red-500/30 bg-red-950/90 px-3 py-1.5 text-xs font-bold text-red-100 shadow-xl backdrop-blur">
                Seamless preview unavailable
              </span>
            </div>
          )}
        </>
      ) : (
        <div
          className="border-foreground/10 relative rounded-lg border bg-black shadow-2xl"
          style={{ width: stageW || 0, height: stageH || 0 }}
        >
          <span className="text-foreground/25 absolute inset-0 grid place-items-center text-[10px] font-bold tracking-[0.12em] uppercase">
            Preview
          </span>
        </div>
      )}
    </div>
  );
}
