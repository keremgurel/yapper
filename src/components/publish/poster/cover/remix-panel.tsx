"use client";

import { ImagePlus, Loader2, RotateCcw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_THUMBNAIL_PROMPT } from "@/components/publish/poster/cover-draft";

/**
 * The AI step, after the frame is chosen. It always starts from the selected
 * frame unless the creator unticks it; a reference thumbnail is an optional
 * second input, not a mode switch.
 */
export default function RemixPanel({
  prompt,
  hasFrame,
  useFrame,
  reference,
  referenceName,
  referenceError,
  generating,
  error,
  onPrompt,
  onUseFrame,
  onReference,
  onClearReference,
  onGenerate,
}: {
  prompt: string;
  hasFrame: boolean;
  useFrame: boolean;
  reference: string | null;
  referenceName: string;
  referenceError: string;
  generating: boolean;
  error: string;
  onPrompt: (value: string) => void;
  onUseFrame: (value: boolean) => void;
  onReference: (file: File) => void;
  onClearReference: () => void;
  onGenerate: () => void;
}) {
  return (
    <div
      className="space-y-3 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)]"
      tabIndex={0}
      onPaste={(event) => {
        const image = [...event.clipboardData.items].find((item) =>
          item.type.startsWith("image/"),
        );
        const file = image?.getAsFile();
        if (file) {
          event.preventDefault();
          onReference(file);
        }
      }}
    >
      <label className="block">
        <span className="text-muted-foreground mb-1 block text-xs">
          What should change
        </span>
        <textarea
          value={prompt}
          rows={4}
          maxLength={2000}
          disabled={generating}
          onChange={(event) => onPrompt(event.target.value)}
          className="border-border bg-background text-foreground w-full resize-y rounded-lg border px-3 py-2 text-[13px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)]"
          aria-label="Thumbnail generation prompt"
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <label
          className={`border-border inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${
            hasFrame ? "cursor-pointer" : "opacity-60"
          }`}
        >
          <input
            type="checkbox"
            checked={useFrame && hasFrame}
            disabled={!hasFrame || generating}
            onChange={(event) => onUseFrame(event.target.checked)}
            className="accent-[color:var(--sg-accent)]"
          />
          Use selected frame
        </label>

        {reference ? (
          <div className="border-border flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[13px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={reference}
              alt="Reference thumbnail"
              className="h-7 w-7 rounded object-cover ring-1 ring-white/15"
            />
            <span className="min-w-0 flex-1 truncate">{referenceName}</span>
            <button
              type="button"
              onClick={onClearReference}
              aria-label="Remove reference thumbnail"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <label className="border-border hover:bg-muted inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px]">
            <Upload className="h-3.5 w-3.5" />
            Upload reference thumbnail
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={generating}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onReference(file);
                event.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        You can also paste an image here. 2 credits per generation.
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={generating || !prompt.trim()}
          onClick={onGenerate}
          className="flex-1"
        >
          {generating ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" />
          ) : (
            <ImagePlus />
          )}
          {generating ? "Generating…" : "Generate thumbnail"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Reset prompt"
          disabled={generating || prompt === DEFAULT_THUMBNAIL_PROMPT}
          onClick={() => onPrompt(DEFAULT_THUMBNAIL_PROMPT)}
        >
          <RotateCcw />
        </Button>
      </div>
      {referenceError || error ? (
        <p role="alert" className="text-[11px] text-amber-400">
          {referenceError || error}
        </p>
      ) : null}
    </div>
  );
}
