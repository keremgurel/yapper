"use client";

import { Maximize2, Minimize2, Video } from "lucide-react";
import StatusSelect from "@/components/library/status-select";
import SaveIndicator from "@/components/workbench/save-indicator";
import { Button } from "@/components/ui/button";
import type { SaveState } from "@/hooks/use-autosave";
import type { ContentStatus } from "@/lib/db/schema";

/**
 * The document's title bar: its name, then what you do to it besides
 * writing: set its status, record it, and give it the whole window.
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
  maximized,
  onToggleMaximized,
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
  maximized: boolean;
  onToggleMaximized: () => void;
}) {
  return (
    <header className="border-border flex h-14 shrink-0 items-center gap-2 border-b px-4 lg:px-5">
      <input
        value={title}
        onChange={(event) => onTitle(event.target.value)}
        placeholder="Untitled"
        aria-label="Title"
        className="text-foreground placeholder:text-muted-foreground/50 min-w-0 flex-1 bg-transparent text-[15px] font-semibold tracking-[-0.01em] outline-none"
      />
      <SaveIndicator state={saveState} />
      <StatusSelect value={status} onChange={onStatus} />
      <Button type="button" size="sm" disabled={busy} onClick={onRecord}>
        <Video className="h-4 w-4" />
        {hasRecording ? "Record again" : "Record"}
      </Button>
      {menu}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onToggleMaximized}
        aria-pressed={maximized}
        aria-label={maximized ? "Show the chat" : "Give the canvas the window"}
        title={maximized ? "Show the chat (Esc)" : "Give the canvas the window"}
        className="text-muted-foreground hidden lg:inline-flex"
      >
        {maximized ? <Minimize2 /> : <Maximize2 />}
      </Button>
    </header>
  );
}
