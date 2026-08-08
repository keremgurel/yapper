"use client";

import { Check, ChevronDown } from "lucide-react";
import { CHIP_TONES, Chip, statusTone } from "@/components/studio-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { contentStatuses, type ContentStatus } from "@/lib/db/schema";

const LABEL: Record<ContentStatus, string> = {
  drafted: "Drafted",
  planned: "Planned",
  scheduled: "Scheduled",
  posted: "Posted",
};

/** Inline pipeline-status control (Drafted / Planned / Scheduled / Posted).
 * Renders the shared status chip (tint + pill, toned by `statusTone`).
 * Render-only: the parent persists the change. */
export default function StatusSelect({
  value,
  onChange,
}: {
  value: ContentStatus;
  onChange: (status: ContentStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Status: ${LABEL[value]}`}
          className="inline-flex items-center gap-1 rounded-full transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
        >
          <Chip tone={statusTone(value)} pill>
            {LABEL[value]}
          </Chip>
          <ChevronDown
            aria-hidden
            className="text-muted-foreground/70 h-3 w-3"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="border-border bg-popover w-40 rounded-xl p-1"
      >
        {contentStatuses.map((status) => (
          <DropdownMenuItem
            key={status}
            onSelect={(e) => {
              e.stopPropagation();
              if (status !== value) onChange(status);
            }}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium"
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${CHIP_TONES[statusTone(status)].dot}`}
            />
            {LABEL[status]}
            {status === value && <Check className="ml-auto h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
