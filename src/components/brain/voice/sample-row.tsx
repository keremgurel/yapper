"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import type { VoiceSample } from "@/lib/voice/client";
import { formatDate, formatDuration, PLATFORM_LABEL } from "./platform-copy";

/** One video in the voice set, with its transcript a click away. */
export default function SampleRow({
  sample,
  onRemove,
}: {
  sample: VoiceSample;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;
  const meta = [
    PLATFORM_LABEL[sample.platform],
    formatDate(sample.publishedAt),
    formatDuration(sample.durationSec),
    sample.creditsCharged === 0
      ? "free"
      : `${sample.creditsCharged} credit${sample.creditsCharged === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="group">
      <div className="flex items-start gap-3 py-2.5">
        <div className="bg-muted h-14 w-8 shrink-0 overflow-hidden rounded">
          {sample.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sample.thumbnail}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-foreground flex items-center gap-1 text-sm font-semibold">
            <Chevron
              className="text-muted-foreground h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">{sample.title || "Untitled"}</span>
          </p>
          <p className="text-muted-foreground mt-0.5 pl-[18px] text-xs">
            {meta}
          </p>
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${sample.title || "this video"} from your voice`}
          className="text-muted-foreground hover:text-foreground p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {open ? (
        <p className="text-muted-foreground mb-3 ml-11 max-h-48 overflow-y-auto pl-[18px] text-sm leading-relaxed whitespace-pre-wrap">
          {sample.transcript}
        </p>
      ) : null}
    </li>
  );
}
