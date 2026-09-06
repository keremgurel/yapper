"use client";

import Link from "next/link";
import { ArrowLeft, Video } from "lucide-react";
import StatusSelect from "@/components/library/status-select";
import SaveIndicator from "@/components/workbench/save-indicator";
import { Button } from "@/components/ui/button";
import type { SaveState } from "@/hooks/use-autosave";
import type { ContentStatus } from "@/lib/db/schema";

/**
 * The top of the canvas: where you came from, the title, and the two things
 * you do to a piece besides writing it: set its status and record it.
 */
export default function CanvasHeader({
  title,
  onTitle,
  status,
  onStatus,
  saveState,
  busy,
  hasRecording,
  onRecord,
  menu,
}: {
  title: string;
  onTitle: (title: string) => void;
  status: ContentStatus;
  onStatus: (status: ContentStatus) => void;
  saveState: SaveState;
  busy: boolean;
  hasRecording: boolean;
  onRecord: () => void;
  menu: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground -ml-2"
        >
          <Link href="/studio/ideas">
            <ArrowLeft className="h-4 w-4" />
            Ideas
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <SaveIndicator state={saveState} />
          <StatusSelect value={status} onChange={onStatus} />
          <Button type="button" size="sm" disabled={busy} onClick={onRecord}>
            <Video className="h-4 w-4" />
            {hasRecording ? "Record again" : "Record"}
          </Button>
          {menu}
        </div>
      </div>
      <input
        value={title}
        onChange={(event) => onTitle(event.target.value)}
        placeholder="Untitled"
        aria-label="Title"
        className="text-foreground placeholder:text-muted-foreground/50 w-full bg-transparent text-[28px] leading-tight font-bold tracking-[-0.02em] outline-none"
      />
    </header>
  );
}
