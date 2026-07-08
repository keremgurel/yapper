"use client";

import { useRef } from "react";
import { ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";

export const MEDIA_DND_TYPE = "application/x-yapper-asset";

export default function MediaTab() {
  const {
    source,
    clips,
    overlays,
    mediaAssets,
    addMediaAsset,
    removeMediaAsset,
    addAssetToTimeline,
  } = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);
  const isEmpty = !source && mediaAssets.length === 0;

  // How many times an asset is placed on the timeline (base + main clips + tracks).
  const usageCount = (url: string) =>
    (source?.url === url ? 1 : 0) +
    clips.filter((c) => c.src?.url === url).length +
    overlays.filter((o) => o.url === url).length;

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
          Photos &amp; videos · drag onto the timeline or press Add
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
        {isEmpty ? (
          <div className="text-foreground/50 flex flex-col items-center gap-2 py-12 text-center">
            <ImagePlus className="text-foreground/30 h-7 w-7" />
            <p className="text-sm">No media yet</p>
            <p className="max-w-[200px] text-xs">
              Upload a video to start, plus any photos or B-roll to layer in.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* Base loaded from the uploader (not in the library) — show it once. */}
            {source && !mediaAssets.some((m) => m.url === source.url) && (
              <div className="border-border bg-card overflow-hidden rounded-xl border ring-1 ring-[color:var(--sg-accent)]/40">
                <div className="bg-muted relative aspect-video">
                  <video
                    src={source.url}
                    muted
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute top-1 left-1 rounded-md bg-[color:var(--sg-accent)]/90 px-1.5 py-0.5 text-[10px] font-black text-white">
                    Added
                  </span>
                </div>
                <div className="p-2">
                  <p className="text-foreground/80 truncate text-[11px] font-bold">
                    {source.name}
                  </p>
                  <p className="text-foreground/40 text-[10px]">Main track</p>
                </div>
              </div>
            )}
            {mediaAssets.map((asset) => {
              const isBase = source?.url === asset.url;
              const count = usageCount(asset.url);
              return (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(MEDIA_DND_TYPE, asset.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className={`border-border bg-card group cursor-grab overflow-hidden rounded-xl border active:cursor-grabbing ${
                    count > 0 ? "ring-1 ring-[color:var(--sg-accent)]/40" : ""
                  }`}
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
                    {count > 0 && (
                      <span className="absolute top-1 left-1 rounded-md bg-[color:var(--sg-accent)]/90 px-1.5 py-0.5 text-[10px] font-black text-white">
                        Added{count > 1 ? ` ×${count}` : ""}
                      </span>
                    )}
                    {!isBase && (
                      <button
                        type="button"
                        onClick={() => removeMediaAsset(asset.id)}
                        className="absolute top-1 right-1 rounded-md bg-black/50 p-1 text-white/80 opacity-0 transition-opacity group-hover:opacity-100 hover:text-white"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-foreground/80 truncate text-[11px] font-bold">
                      {asset.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => addAssetToTimeline(asset.id)}
                      className="border-border text-foreground/80 hover:bg-muted hover:text-foreground mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] font-bold"
                    >
                      <Plus className="h-3 w-3" />
                      {count > 0 ? "Add again" : "Add to timeline"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
