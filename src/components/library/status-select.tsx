"use client";

import { Check, ChevronDown } from "lucide-react";
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

/** Status chip colors: neutral draft → cool planning → warm scheduled → done. */
const CHIP: Record<ContentStatus, string> = {
  drafted: "bg-muted text-foreground/70",
  planned: "bg-cyan-500/15 text-cyan-500",
  scheduled: "bg-amber-500/15 text-amber-500",
  posted: "bg-emerald-500/15 text-emerald-500",
};

/** Inline pipeline-status control (Drafted / Planned / Scheduled / Posted).
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
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-opacity hover:opacity-80 ${CHIP[value]}`}
        >
          {LABEL[value]}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="border-border bg-card w-40 rounded-xl p-1"
      >
        {contentStatuses.map((status) => (
          <DropdownMenuItem
            key={status}
            onSelect={(e) => {
              e.stopPropagation();
              if (status !== value) onChange(status);
            }}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-bold"
          >
            <span
              className={`h-2 w-2 rounded-full ${CHIP[status].split(" ")[0]}`}
            />
            {LABEL[status]}
            {status === value && <Check className="ml-auto h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
