"use client";

import { useRef } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

/**
 * Pick a custom thumbnail/cover image for a post. Presentational: the parent
 * owns the upload (useThumbnailUpload) and passes the resulting preview + state.
 */
export default function ThumbnailPicker({
  previewUrl,
  uploading,
  error,
  onPick,
  onClear,
}: {
  previewUrl: string | null;
  uploading: boolean;
  error: "not_image" | "failed" | null;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs font-bold">
        Custom thumbnail
      </span>
      {previewUrl ? (
        <div className="relative w-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Thumbnail preview"
            className="bg-muted aspect-[9/16] w-20 rounded-lg object-cover"
          />
          <button
            type="button"
            onClick={onClear}
            className="bg-foreground text-background absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full shadow"
            aria-label="Remove thumbnail"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="border-border text-foreground hover:bg-muted inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          {uploading ? "Uploading…" : "Add thumbnail"}
        </button>
      )}
      {error && (
        <span className="text-destructive text-[11px] font-bold">
          {error === "not_image"
            ? "Pick an image file."
            : "Upload failed, try again."}
        </span>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
