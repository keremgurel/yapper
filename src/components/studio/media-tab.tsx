"use client";

import { useRef } from "react";
import { ImagePlus, Layers, Trash2, Upload } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";

export default function MediaTab() {
  const { mediaAssets, addMediaAsset, removeMediaAsset, addOverlayFromAsset } =
    useStudio();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border shrink-0 border-b p-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="bg-foreground text-background flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-opacity hover:opacity-90"
        >
          <Upload className="h-4 w-4" />
          Upload media
        </button>
        <p className="text-foreground/45 mt-2 text-center text-xs">
          Photos &amp; videos · used as overlays on top of your video
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            files.forEach((f) => void addMediaAsset(f));
            e.target.value = "";
          }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {mediaAssets.length === 0 ? (
          <div className="text-foreground/50 flex flex-col items-center gap-2 py-12 text-center">
            <ImagePlus className="text-foreground/30 h-7 w-7" />
            <p className="text-sm">No media yet</p>
            <p className="max-w-[200px] text-xs">
              Upload photos or B-roll to overlay on your talking-head video.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {mediaAssets.map((asset) => (
              <div
                key={asset.id}
                className="border-border bg-card group overflow-hidden rounded-xl border"
              >
                <div className="bg-muted relative aspect-video">
                  {asset.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <video
                      src={asset.url}
                      muted
                      className="h-full w-full object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMediaAsset(asset.id)}
                    className="absolute top-1 right-1 rounded-md bg-black/50 p-1 text-white/80 opacity-0 transition-opacity group-hover:opacity-100 hover:text-white"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-foreground/80 truncate text-[11px] font-bold">
                    {asset.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => addOverlayFromAsset(asset.id)}
                    className="border-border text-foreground/80 hover:bg-muted hover:text-foreground mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] font-bold"
                  >
                    <Layers className="h-3 w-3" />
                    Add as overlay
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
