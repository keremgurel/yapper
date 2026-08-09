"use client";

import { AlertTriangle } from "lucide-react";
import CaptionDelivery from "@/components/publish/captions/caption-delivery";
import CaptionPreview from "@/components/publish/captions/caption-preview";
import HashtagChips from "@/components/publish/captions/hashtag-chips";
import { captionOverBy } from "@/components/publish/captions/caption-draft";
import type { PlatformCaption } from "@/lib/publish/caption";
import { captionSpec } from "@/lib/publish/caption-specs";

const FIELD =
  "bg-muted text-foreground placeholder:text-muted-foreground w-full rounded-lg px-3 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)]";

/**
 * One platform's caption. Every constraint on screen comes from that
 * platform's spec, so adding a platform is a data change rather than a UI one.
 */
export default function CaptionEditor({
  caption,
  disabled,
  onChange,
}: {
  caption: PlatformCaption;
  disabled?: boolean;
  onChange: (caption: PlatformCaption) => void;
}) {
  const spec = captionSpec(caption.platform);
  const over = captionOverBy(caption);

  return (
    <div className="flex flex-col gap-4">
      {spec.hasTitle && (
        <label className="block">
          <span className="text-muted-foreground mb-1.5 flex items-baseline justify-between gap-2 text-xs font-semibold">
            Title
            <span className="font-mono tabular-nums">
              {caption.title.length}/{spec.titleMax}
            </span>
          </span>
          <input
            value={caption.title}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...caption, title: event.target.value })
            }
            placeholder={`What someone searching ${spec.label} would click`}
            className={FIELD}
          />
        </label>
      )}

      <label className="block">
        <span className="text-muted-foreground mb-1.5 block text-xs font-semibold">
          {spec.hasTitle ? "Description" : "Caption"}
        </span>
        <textarea
          value={caption.body}
          disabled={disabled}
          rows={6}
          onChange={(event) =>
            onChange({ ...caption, body: event.target.value })
          }
          placeholder={`Write for ${spec.label}, or generate a draft from the video's script.`}
          className={`${FIELD} max-w-[68ch] resize-none`}
        />
      </label>

      <HashtagChips
        tags={caption.hashtags}
        min={spec.hashtags.min}
        max={spec.hashtags.max}
        disabled={disabled}
        onChange={(hashtags) => onChange({ ...caption, hashtags })}
      />

      <CaptionPreview caption={caption} />

      {(over.title > 0 || over.body > 0) && (
        <p className="flex items-start gap-1.5 text-xs font-semibold text-[color:var(--sg-yellow-500)]">
          <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {spec.label} will reject this.{" "}
            {over.title > 0 &&
              `The title is ${over.title} character${over.title === 1 ? "" : "s"} too long. `}
            {over.body > 0 &&
              `The caption is ${over.body} character${over.body === 1 ? "" : "s"} over its ${spec.bodyMax} limit, hashtags included.`}
          </span>
        </p>
      )}

      <CaptionDelivery caption={caption} />
    </div>
  );
}
