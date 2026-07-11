"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportRequest } from "@/hooks/use-timeline-export";
import { resolutionChoices } from "@/lib/studio/export/resolutions";
import type { StudioSource } from "@/lib/studio/types";

interface ExportOptionsMenuProps {
  /** Sets the native detail level. Null once the recording has been removed. */
  source: StudioSource | null;
  /** Project frame width / height, which fixes the shape of every choice. */
  aspect: number;
  hasCaptions: boolean;
  disabled?: boolean;
  onExport: (request: ExportRequest) => void;
}

/**
 * The pre-export picker: pick an output resolution and optionally grab a
 * matching .srt, then confirm. Presentational and self-contained — it owns only
 * the transient form choices and hands the final request up via onExport.
 */
export default function ExportOptionsMenu({
  source,
  aspect,
  hasCaptions,
  disabled,
  onExport,
}: ExportOptionsMenuProps) {
  const choices = useMemo(
    () => resolutionChoices(source, aspect),
    [source, aspect],
  );
  const [resolutionId, setResolutionId] = useState(
    choices[0]?.id ?? "original",
  );
  const [downloadSrt, setDownloadSrt] = useState(false);
  const [open, setOpen] = useState(false);

  const confirm = () => {
    const choice = choices.find((c) => c.id === resolutionId) ?? choices[0];
    setOpen(false);
    onExport({ shortSide: choice?.shortSide, downloadSrt });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          title="Export the edited video as an MP4"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Resolution</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={resolutionId}
          onValueChange={setResolutionId}
        >
          {choices.map((c) => (
            <DropdownMenuRadioItem
              key={c.id}
              value={c.id}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span className="font-medium">{c.label}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {c.hint}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {hasCaptions && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={downloadSrt}
              onCheckedChange={setDownloadSrt}
              onSelect={(e) => e.preventDefault()}
            >
              Also download captions (.srt)
            </DropdownMenuCheckboxItem>
          </>
        )}

        <DropdownMenuSeparator />
        <div className="p-1">
          <Button type="button" size="sm" className="w-full" onClick={confirm}>
            <Download className="h-3.5 w-3.5" />
            Export video
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
