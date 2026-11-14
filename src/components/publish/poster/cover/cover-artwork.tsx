"use client";

import { useEffect, useRef, useState } from "react";
import type { CoverDraft } from "../cover-draft";
import {
  COVER_HEIGHT,
  COVER_WIDTH,
  loadCoverImage,
  paintCover,
} from "../render-cover";

export default function CoverArtwork({
  draft,
  small = false,
}: {
  draft: CoverDraft;
  small?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<{
    source: string;
    image: HTMLImageElement | null;
  }>();
  const source = draft.image;
  useEffect(() => {
    if (!source) return;
    let live = true;
    void loadCoverImage(source).then(
      (image) => {
        if (live) setLoaded({ source, image });
      },
      () => {
        if (live) setLoaded({ source, image: null });
      },
    );
    return () => {
      live = false;
    };
  }, [source]);
  const image = loaded?.source === source ? loaded?.image : undefined;
  useEffect(() => {
    const node = canvas.current;
    const context = node?.getContext("2d");
    if (!node || !context || !image) return;
    context.setTransform(
      node.width / COVER_WIDTH,
      0,
      0,
      node.height / COVER_HEIGHT,
      0,
      0,
    );
    paintCover(context, image, draft);
  }, [draft, image]);
  return (
    <div className="bg-muted relative grid aspect-[9/16] w-full place-items-center overflow-hidden rounded-[inherit]">
      {source && image !== null ? (
        <canvas
          ref={canvas}
          width={small ? 108 : 540}
          height={small ? 192 : 960}
          className="absolute inset-0 size-full"
          role={small ? undefined : "img"}
          aria-label={small ? undefined : "Cover preview"}
        />
      ) : !small ? (
        <p className="text-muted-foreground px-4 text-center text-sm">
          {source
            ? "Couldn’t load this image"
            : "Pick a frame or upload an image"}
        </p>
      ) : null}
    </div>
  );
}
