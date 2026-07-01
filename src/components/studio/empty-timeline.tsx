"use client";

/**
 * Placeholder shown in the timeline area before any video is loaded, so the
 * editor always presents its full layout. Renders a couple of empty track lanes
 * for a sense of the timeline to come.
 */
export default function EmptyTimeline() {
  return (
    <div className="flex h-full min-h-0 flex-col select-none">
      <div className="border-border/70 bg-muted/30 relative flex-1 overflow-hidden rounded-md border border-dashed">
        <div className="space-y-1 p-1">
          <div className="border-border/50 h-16 rounded-md border border-dashed" />
          <div className="border-border/50 h-20 rounded-md border border-dashed" />
        </div>
        <div className="text-foreground/40 pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-medium">
          Upload a video to start editing
        </div>
      </div>
    </div>
  );
}
