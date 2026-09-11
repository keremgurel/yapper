"use client";

import { useEffect, useRef, useState } from "react";
import { Film } from "lucide-react";
import { useCoverMedia } from "./cover/use-cover-media";

/** The library has no stored thumbnails. Load a paused frame from its authorized
 * master only when the card approaches the viewport. */
export default function SavedVideoThumbnail({
  submissionId,
}: {
  submissionId: string;
}) {
  const container = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <span ref={container} className="absolute inset-0" aria-hidden="true">
      {visible ? (
        <VideoFrame key={submissionId} submissionId={submissionId} />
      ) : null}
    </span>
  );
}

function VideoFrame({ submissionId }: { submissionId: string }) {
  const { url, error } = useCoverMedia({ submissionId });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      {!ready && (
        <span
          className="text-muted-foreground absolute inset-0 grid place-items-center"
          title={error || (failed ? "Preview unavailable" : "Loading preview")}
        >
          <Film className="h-5 max-h-full w-5 max-w-full" />
        </span>
      )}
      {url && !failed && (
        <video
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          src={url}
          className={`pointer-events-none h-full w-full object-cover ${ready ? "" : "opacity-0"}`}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            if (Number.isFinite(video.duration) && video.duration > 0) {
              video.currentTime = Math.min(1, video.duration / 2);
            }
          }}
          onLoadedData={(event) => {
            if (!event.currentTarget.seeking) setReady(true);
          }}
          onSeeked={() => setReady(true)}
          onError={() => {
            setReady(false);
            setFailed(true);
          }}
        />
      )}
    </>
  );
}
