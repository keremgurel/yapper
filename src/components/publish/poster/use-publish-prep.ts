"use client";

import { useCallback, useState } from "react";
import type { CaptionSet } from "@/components/publish/captions/caption-draft";
import type { CrossPostTarget } from "@/components/publish/compose/types";
import {
  defaultCover,
  type CoverDraft,
} from "@/components/publish/poster/cover-draft";
import { renderCover } from "@/components/publish/poster/render-cover";
import { uploadThumbnailFile } from "@/hooks/use-thumbnail-upload";
import type { PostableVideo } from "@/lib/publish/postable-videos";

/**
 * Turning prepared videos into what the cross-post sheet posts: the cover is
 * uploaded here, and each video carries its own per-platform captions so the
 * sheet never has to reconstruct them from a single string.
 */
export function usePublishPrep() {
  const [targets, setTargets] = useState<CrossPostTarget[] | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [warning, setWarning] = useState("");

  const prepare = useCallback(
    async (
      videos: PostableVideo[],
      covers: Record<string, CoverDraft>,
      captions: Record<string, CaptionSet>,
    ) => {
      if (!videos.length) return;
      setPreparing(true);
      setWarning("");
      const prepared = await Promise.all(
        videos.map(async (video) => {
          const cover = covers[video.id] ?? defaultCover(video.title);
          let thumbnail: { key: string; previewUrl: string } | undefined;
          if (cover.image) {
            try {
              thumbnail = await uploadThumbnailFile(await renderCover(cover));
            } catch {
              // A cover is optional. Keep preparing the remaining videos and show
              // one non-blocking warning after the batch is ready.
            }
          }
          return {
            id: video.id,
            title: video.title,
            initialTitle: cover.headline || video.title,
            captions: captions[video.id],
            submissionId: video.submissionId,
            contentItemId: video.id,
            thumbnailKey: thumbnail?.key,
            thumbnailPreviewUrl: thumbnail?.previewUrl,
          } satisfies CrossPostTarget;
        }),
      );
      if (
        videos.some((video) => covers[video.id]?.image) &&
        prepared.some((item) => !item.thumbnailKey)
      ) {
        setWarning(
          "One or more covers couldn't upload. The videos are still ready to publish.",
        );
      }
      setTargets(prepared);
      setPreparing(false);
    },
    [],
  );

  const clear = useCallback(() => setTargets(null), []);

  return { targets, preparing, warning, prepare, clear };
}
