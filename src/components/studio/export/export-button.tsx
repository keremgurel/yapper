"use client";

import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ExportOptionsMenu from "@/components/studio/export/export-options-menu";
import { useTimelineExport } from "@/hooks/use-timeline-export";

/** Primary "Export" action for the studio: opens a resolution/captions picker,
 * then renders the timeline to an MP4 (plus optional .srt) and downloads it,
 * showing progress and any error inline. */
export default function ExportButton() {
  const {
    source,
    canExport,
    hasCaptions,
    exporting,
    status,
    error,
    run,
    cancel,
  } = useTimelineExport();

  if (exporting) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <Button asChild size="sm">
          <span>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {status ?? "Exporting…"}
          </span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={cancel}
          title="Cancel export"
          aria-label="Cancel export"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      {source ? (
        <ExportOptionsMenu
          source={source}
          hasCaptions={hasCaptions}
          disabled={!canExport}
          onExport={(request) => void run(request)}
        />
      ) : (
        <Button type="button" size="sm" disabled>
          Export
        </Button>
      )}
      {error && (
        <span
          className="max-w-[16rem] truncate text-xs font-medium text-red-500"
          title={error}
        >
          {error}
        </span>
      )}
    </div>
  );
}
