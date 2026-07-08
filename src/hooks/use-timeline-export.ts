import { useCallback, useRef, useState } from "react";
import { useStudio } from "@/components/studio/studio-context";
import { downloadBlob } from "@/lib/studio/export/download-blob";
import { exportTimeline } from "@/lib/studio/export/export-timeline";
import { captionsToSrt } from "@/lib/studio/export/srt";
import {
  DEFAULT_EXPORT_OPTIONS,
  ExportUnsupportedError,
  type ExportProgress,
} from "@/lib/studio/export/types";

/** What the export dialog collects before a run starts. */
export interface ExportRequest {
  /** Target for the frame's shorter side; undefined keeps native resolution. */
  shortSide?: number;
  /** Also download a matching .srt caption file. */
  downloadSrt?: boolean;
}

function phaseLabel(p: ExportProgress): string {
  switch (p.phase) {
    case "preparing":
      return "Preparing…";
    case "audio":
      return "Mixing audio…";
    case "video":
      return `Rendering ${Math.round(p.ratio * 100)}%`;
    case "finalizing":
      return "Finalizing…";
    case "done":
      return "Done";
  }
}

function safeBaseName(name: string | undefined): string {
  const base = (name ?? "yapper").replace(/\.[^.]+$/, "").trim();
  return base || "yapper";
}

/** Drives a full-timeline MP4 export: run/cancel plus progress and error state. */
export function useTimelineExport() {
  const { source, clips, overlays, captions, captionStyle, audioTracks } =
    useStudio();
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canExport = !!source && clips.length > 0;

  const run = useCallback(
    async (request: ExportRequest = {}) => {
      if (!source || exporting) return;
      setError(null);
      setExporting(true);
      setStatus("Preparing…");
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const blob = await exportTimeline(
          { source, clips, overlays, captions, captionStyle, audioTracks },
          {
            options: {
              ...DEFAULT_EXPORT_OPTIONS,
              shortSide: request.shortSide,
            },
            onProgress: (p) => setStatus(phaseLabel(p)),
            signal: controller.signal,
          },
        );
        const base = safeBaseName(source.name);
        downloadBlob(blob, `${base}-export.mp4`);
        // Optional sidecar captions, timed to the exported (cut) video.
        if (request.downloadSrt && captions.length > 0) {
          const srt = captionsToSrt(captions, clips, captionStyle.textCase);
          if (srt.trim().length > 0) {
            downloadBlob(
              new Blob([srt], { type: "application/x-subrip" }),
              `${base}-export.srt`,
            );
          }
        }
        setStatus(null);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          setStatus(null);
        } else if (e instanceof ExportUnsupportedError) {
          setError(e.message);
        } else {
          setError(e instanceof Error ? e.message : "Export failed.");
        }
      } finally {
        setExporting(false);
        abortRef.current = null;
      }
    },
    [source, clips, overlays, captions, captionStyle, audioTracks, exporting],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  return {
    source,
    canExport,
    hasCaptions: captions.length > 0,
    exporting,
    status,
    error,
    run,
    cancel,
  };
}
