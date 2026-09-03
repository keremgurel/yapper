"use client";

import { Download, Film } from "lucide-react";
import type { CoverDraft } from "@/components/publish/poster/cover-draft";

/** What every destination will show: the chosen image with its overlay. */
export default function CoverPreview({
  draft,
  onDownload,
  onUseFrame,
}: {
  draft: CoverDraft;
  onDownload: () => void;
  onUseFrame: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[230px] overflow-hidden rounded-2xl bg-[linear-gradient(145deg,#202020,#080808)] ring-1 ring-white/10">
        {draft.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={draft.image}
            alt="Thumbnail preview"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div>
              <Film className="mx-auto h-7 w-7 text-white/55" />
              <p className="mt-2 text-xs font-semibold text-white/70">
                Scrub the video to pick a frame
              </p>
            </div>
          </div>
        )}
        {draft.showHeadline && draft.headline.trim() ? (
          <div
            className={`absolute inset-x-0 flex p-[8%] ${
              draft.position === "top"
                ? "top-0 items-start"
                : draft.position === "center"
                  ? "top-1/2 -translate-y-1/2 items-center"
                  : "bottom-0 items-end bg-gradient-to-t from-black/80 via-black/20 to-transparent pt-[35%]"
            }`}
          >
            <p
              className={`w-full text-center text-xl leading-[1.02] font-black tracking-[-0.04em] uppercase ${
                draft.textStyle === "label"
                  ? "rounded-md bg-[#f5d90a] px-2.5 py-2 text-black"
                  : "text-white [text-shadow:0_2px_0_#000,2px_0_0_#000,-2px_0_0_#000,0_-2px_0_#000,0_5px_18px_rgba(0,0,0,.9)]"
              }`}
            >
              {draft.headline}
            </p>
          </div>
        ) : null}
        {draft.image ? (
          <>
            <span className="absolute top-2.5 left-2.5 rounded-full bg-black/65 px-2 py-1 text-[11px] font-bold tracking-[.12em] text-white uppercase backdrop-blur">
              {draft.source === "generated" ? "AI remix" : "Video frame"}
            </span>
            <button
              type="button"
              onClick={onDownload}
              aria-label="Download thumbnail, 1080 by 1920"
              title="Download 1080 × 1920"
              className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/65 text-white backdrop-blur transition-colors hover:bg-black/85 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}
      </div>
      {draft.source === "generated" && draft.frameImage ? (
        <button
          type="button"
          onClick={onUseFrame}
          className="text-muted-foreground hover:text-foreground mx-auto block text-xs underline underline-offset-4"
        >
          Use the video frame instead
        </button>
      ) : null}
    </div>
  );
}
