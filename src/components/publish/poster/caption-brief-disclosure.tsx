"use client";

import { ChevronDown } from "lucide-react";
import GenerationBrief from "@/components/publish/poster/generation-brief";
import { DEFAULT_CAPTION_BRIEF } from "@/lib/publish/caption-prompt";

/**
 * The caption prompt, folded away. It is eight hundred characters of standing
 * instructions that most posts never touch; open it when this post needs a
 * different angle. A customized brief announces itself in the summary line so
 * it is never silently in effect.
 */
export default function CaptionBriefDisclosure({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const customized = value !== DEFAULT_CAPTION_BRIEF;
  return (
    <details className="group border-border rounded-xl border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
        <span>
          Caption prompt
          {customized ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              customized for this post
            </span>
          ) : null}
        </span>
        <ChevronDown className="text-muted-foreground h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-border border-t p-3">
        <GenerationBrief
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      </div>
    </details>
  );
}
