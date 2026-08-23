"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Chip } from "@/components/studio-ui";
import { USAGE_LEVELS, usageMeta } from "@/components/brain/usage";
import type { BrainBlockUsage } from "@/lib/db/schema";

/**
 * Choosing how much of a section reaches a prompt.
 *
 * A menu rather than a toggle because there are four answers, and the one line
 * of help under each is doing real work: the difference between "always" and
 * "when relevant" is the difference between a section that costs budget on
 * every call and one that costs a line.
 */
export default function UsageSelect({
  usage,
  onChange,
}: {
  usage: BrainBlockUsage;
  onChange: (next: BrainBlockUsage) => void;
}) {
  const current = usageMeta(usage);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        aria-label={`How this is read: ${current.label}`}
      >
        <Chip tone={current.tone}>{current.label}</Chip>
        <ChevronDown aria-hidden className="text-muted-foreground h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-[300px]">
        {USAGE_LEVELS.map((level) => (
          <DropdownMenuItem
            key={level.value}
            onSelect={() => onChange(level.value)}
            className="items-start gap-2"
          >
            <Check
              aria-hidden
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                level.value === usage ? "opacity-100" : "opacity-0"
              }`}
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">
                {level.label}
              </span>
              <span className="text-muted-foreground block text-xs leading-snug">
                {level.help}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
