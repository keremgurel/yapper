"use client";

import { X } from "lucide-react";
import PlatformMark from "@/components/ideas/platform-mark";
import { detectPlatform } from "@/lib/inspiration/platform";

/**
 * The one reference a capture can carry, shown as an attachment row instead of
 * a raw URL polluting the writing surface. Submit still preserves the exact
 * URL for the idea pipeline.
 */
export default function CaptureLinkAttachment({
  link,
  onRemove,
}: {
  link: string;
  onRemove: () => void;
}) {
  return (
    <div className="group/link animate-in fade-in slide-in-from-bottom-1 mx-3 mb-2 flex min-w-0 items-center gap-2 duration-150">
      <PlatformMark platform={detectPlatform(link)} />
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 truncate text-[16px] leading-6 font-medium text-[color:var(--sg-cyan-500)] underline-offset-2 hover:underline"
      >
        {link}
      </a>
      <button
        type="button"
        aria-label="Remove link"
        title="Remove link"
        onClick={onRemove}
        className="text-muted-foreground hover:bg-muted hover:text-foreground ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full opacity-0 transition-[opacity,color,background-color] duration-150 group-hover/link:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
