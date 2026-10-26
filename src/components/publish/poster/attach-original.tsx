"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAddVideo } from "@/hooks/use-add-video";
import type { ContentDetail } from "@/lib/content/client";
import { PLATFORMS } from "@/lib/publish/platforms";
import type { PosterVideo } from "./poster-video";
import UploadProgress from "./upload-progress";

type ChannelVideo = Extract<PosterVideo, { kind: "platform" }>;

/** Attach one local original through the existing quota-checked upload path. */
export default function AttachOriginal({
  video,
  onAttached,
  onUpdated,
}: {
  video: ChannelVideo;
  onAttached: (video: ChannelVideo, item: ContentDetail) => void;
  onUpdated: (item: ContentDetail) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const { add, state, progress, error, notice } = useAddVideo(
    (item) => onAttached(video, item),
    onUpdated,
  );
  const busy = state === "uploading" || state === "preparing";
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Choose the original file for this {PLATFORMS[video.platform].label}{" "}
        post. Your title and caption stay in place. The file also appears in
        Uploads.
      </p>
      <input
        ref={input}
        type="file"
        accept="video/*"
        aria-label="Original video file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file || uploading.current) return;
          uploading.current = true;
          void add(file, {
            title: video.title,
            caption: video.caption,
          }).finally(() => {
            uploading.current = false;
          });
        }}
      />
      <Button disabled={busy} onClick={() => input.current?.click()}>
        <Upload aria-hidden />
        {busy ? "Attaching video…" : "Attach original video"}
      </Button>
      <p className="text-muted-foreground text-xs">
        Use a video file you own, such as an MP4 or MOV. Yapper does not
        download this post from {PLATFORMS[video.platform].label}.
      </p>
      <UploadProgress
        state={state}
        progress={progress}
        error={error}
        notice={notice}
      />
    </div>
  );
}
