"use client";

import { useRef } from "react";
import { useStudio } from "@/components/studio/studio-context";
import StudioTimeline from "@/components/studio/studio-timeline";
import StudioTransport from "@/components/studio/studio-transport";
import VideoUploader from "@/components/studio/video-uploader";
import { sourceToTimeline, totalDuration } from "@/lib/studio/clips";
import { useStudioPlayback } from "@/hooks/use-studio-playback";

export default function StudioWorkspace() {
  const { source, clips, selectedClipId, selectClip, splitAt } = useStudio();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { currentTime, playing, play, pause, seekToSource } = useStudioPlayback(
    videoRef,
    clips,
  );

  if (!source) return <VideoUploader />;

  const total = totalDuration(clips);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="border-border bg-card overflow-hidden rounded-2xl border">
        <video
          ref={videoRef}
          src={source.url}
          className="aspect-video w-full bg-black"
          playsInline
          onClick={() => (playing ? pause() : play())}
        />
      </div>

      <p className="text-foreground/55 mt-3 truncate text-xs">{source.name}</p>

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
  );
}
