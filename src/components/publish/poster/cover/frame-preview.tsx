"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Loader2 } from "lucide-react";

/** Native seeking stays responsive independently of full-resolution extraction. */
export default function FramePreview({
  mediaUrl,
  time,
  image,
  capturing,
}: {
  mediaUrl: string | null;
  time: number;
  image: string | null;
  capturing: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const target = useRef(time);
  const scheduleSeek = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaUrl) return;
    let animation: number | undefined;
    let requested: number | undefined;
    const seek = () => {
      animation = undefined;
      // Finish each seek so continuous dragging cannot starve frame presentation.
      // On completion, skip straight to the most recent pointer position.
      if (video.readyState < 1 || video.seeking) return;
      // Some media servers clamp a seek; never retry the same target forever.
      if (requested === target.current) return;
      requested = target.current;
      if (Math.abs(video.currentTime - requested) > 0.00001)
        video.currentTime = requested;
    };
    const schedule = () => {
      if (animation === undefined) animation = requestAnimationFrame(seek);
    };
    scheduleSeek.current = schedule;
    video.addEventListener("loadedmetadata", schedule);
    video.addEventListener("seeked", schedule);
    schedule();
    return () => {
      if (animation !== undefined) cancelAnimationFrame(animation);
      scheduleSeek.current = null;
      video.removeEventListener("loadedmetadata", schedule);
      video.removeEventListener("seeked", schedule);
    };
  }, [mediaUrl]);

  useEffect(() => {
    target.current = time;
    scheduleSeek.current?.();
  }, [time]);

  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[270px] overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
      {mediaUrl ? (
        <video
          ref={videoRef}
          src={mediaUrl}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-label="Live frame preview"
          onLoadedData={() => setReady(true)}
          onError={() => setReady(false)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      {image && (!capturing || !ready) ? (
        // Once extracted, show the same exact pixels as the saved thumbnail.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt="Selected video frame"
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : null}
      {!image && !ready ? (
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
      ) : null}
    </div>
  );
}
