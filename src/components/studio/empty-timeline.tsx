"use client";

/**
 * Placeholder shown in the timeline area before any video is loaded, so the
 * editor always presents its full layout. Renders a couple of empty track lanes
 * for a sense of the timeline to come.
 */
export default function EmptyTimeline() {
  return (
    <div className="flex h-full min-h-0 flex-col select-none">
      <div className="border-border/60 bg-background/30 relative flex-1 overflow-hidden border">
        <div className="space-y-1.5 p-1.5 opacity-50">
          <div className="border-border/60 h-12 border" />
          <div className="border-border/60 h-16 border" />
        </div>
        <div className="text-foreground/30 pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-medium">
          Import media from the Workbench
        </div>
      </div>
    </div>
  );
}
