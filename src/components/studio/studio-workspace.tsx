"use client";

import { useEffect, useRef } from "react";
import { useStudio } from "@/components/studio/studio-context";
import StudioTimeline from "@/components/studio/studio-timeline";
import StudioTranscript from "@/components/studio/studio-transcript";
import StudioTransport from "@/components/studio/studio-transport";
import VideoUploader from "@/components/studio/video-uploader";
import { sourceToTimeline, totalDuration } from "@/lib/studio/clips";
import { useStudioPlayback } from "@/hooks/use-studio-playback";
import { useResizablePanel } from "@/hooks/use-resizable-panel";

export default function StudioWorkspace() {
  const {
    source,
    clips,
    selectedClipId,
    selectClip,
    splitAt,
    deleteSelected,
    undo,
    redo,
  } = useStudio();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { currentTime, playing, play, pause, seekToSource } = useStudioPlayback(
    videoRef,
    clips,
  );
  const { width, onPointerDown } = useResizablePanel();

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
        e.preventDefault();
        const v = videoRef.current;
        if (v?.paused) play();
        else if (v) pause();
      } else if (e.key.toLowerCase() === "s" && !mod) {
        e.preventDefault();
        splitAt(videoRef.current?.currentTime ?? 0);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedClipId) {
          e.preventDefault();
          deleteSelected();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, play, pause, splitAt, deleteSelected, selectedClipId]);

  if (!source) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <VideoUploader />
      </div>
    );
  }

  const total = totalDuration(clips);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Main: preview + transport + timeline */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black p-3">
          <video
            ref={videoRef}
            src={source.url}
            className="max-h-full max-w-full rounded-lg"
            playsInline
            onClick={() => (playing ? pause() : play())}
          />
        </div>

        <div className="border-border shrink-0 border-t px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-foreground/55 truncate text-xs">{source.name}</p>
          </div>
          <StudioTransport
            playing={playing}
            currentTimelineTime={sourceToTimeline(clips, currentTime)}
            totalTimelineTime={total}
            onPlay={play}
            onPause={pause}
            onSplit={() => splitAt(currentTime)}
          />
          <div className="mt-4">
            <StudioTimeline
              clips={clips}
              sourceUrl={source.url}
              sourceDuration={source.duration}
              currentSourceTime={currentTime}
              selectedClipId={selectedClipId}
              onSelect={selectClip}
              onSeekSource={seekToSource}
            />
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

      {/* Transcript panel (resizable on desktop, stacked on mobile) */}
      <aside
        style={{ width }}
        className="border-border flex min-h-0 shrink-0 flex-col border-t max-lg:!h-[44vh] max-lg:!w-full lg:border-t-0"
      >
        <StudioTranscript
          currentSourceTime={currentTime}
          onSeek={seekToSource}
        />
      </aside>
    </div>
  );
}
