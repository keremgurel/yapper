"use client";

import { useEffect, useRef } from "react";
import { useStudio } from "@/components/studio/studio-context";
import StudioTimeline from "@/components/studio/studio-timeline";
import StudioTranscript from "@/components/studio/studio-transcript";
import StudioTransport from "@/components/studio/studio-transport";
import VideoUploader from "@/components/studio/video-uploader";
import { sourceToTimeline, totalDuration } from "@/lib/studio/clips";
import { useStudioPlayback } from "@/hooks/use-studio-playback";

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

  if (!source) return <VideoUploader />;

  const total = totalDuration(clips);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="border-border bg-card overflow-hidden rounded-2xl border">
          <video
            ref={videoRef}
            src={source.url}
            className="aspect-video w-full bg-black"
            playsInline
            onClick={() => (playing ? pause() : play())}
          />
        </div>

        <p className="text-foreground/55 mt-3 truncate text-xs">
          {source.name}
        </p>

        <div className="mt-4">
          <StudioTransport
            playing={playing}
            currentTimelineTime={sourceToTimeline(clips, currentTime)}
            totalTimelineTime={total}
            onPlay={play}
            onPause={pause}
            onSplit={() => splitAt(currentTime)}
          />
        </div>

        <div className="mt-5">
          <StudioTimeline
            clips={clips}
            currentSourceTime={currentTime}
            selectedClipId={selectedClipId}
            onSelect={selectClip}
            onSeekSource={seekToSource}
          />
        </div>
      </div>

      <StudioTranscript currentSourceTime={currentTime} onSeek={seekToSource} />
    </div>
  );
}
