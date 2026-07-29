"use client";

import { useEffect, useRef, useState } from "react";
import { Captions, FileText, Film } from "lucide-react";
import MediaTab from "@/components/studio/media-tab";
import CaptionsTab from "@/components/studio/captions-tab";
import StudioTranscript from "@/components/studio/studio-transcript";
import type { LayoutId } from "@/lib/studio/layout";

type Tab = "media" | "transcript" | "captions";

const TABS: { id: Tab; label: string; Icon: typeof Film }[] = [
  { id: "media", label: "Media", Icon: Film },
  { id: "transcript", label: "Transcript", Icon: FileText },
  { id: "captions", label: "Captions", Icon: Captions },
];

// Below this the three Cinema columns get crushed (see the media rail's fixed
// 300px alone eating most of it) — narrower than this, fall back to Classic's
// tabbed panel instead of three squeezed columns.
const CINEMA_MIN_WIDTH = 760;

export default function RightPanel({
  currentTimelineTime,
  onSeek,
  onSeekTimeline,
  layout,
}: {
  currentTimelineTime: number;
  onSeek: (t: number) => void;
  onSeekTimeline: (t: number) => void;
  layout?: LayoutId;
}) {
  const [tab, setTab] = useState<Tab>("media");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure the panel itself (a container query), not the viewport — Cinema
  // can be cramped on a perfectly wide screen if the window is split.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setContainerWidth(entry.contentRect.width),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Open a specific tab when linked (?tab=transcript). Read after mount to
  // avoid the useSearchParams prerender constraint and hydration mismatch.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from a browser-only source (URL) on mount
    if (t === "transcript" || t === "captions") setTab(t);
  }, []);

  const media = <MediaTab />;
  const transcript = (
    <StudioTranscript
      currentTimelineTime={currentTimelineTime}
      onSeek={onSeek}
    />
  );
  const captions = (
    <CaptionsTab
      onSeek={onSeekTimeline}
      currentTimelineTime={currentTimelineTime}
    />
  );

  // Cinema leaves the whole left side free, so show all three panels at once as
  // columns instead of making you tap between tabs. Media is the narrow rail
  // (upload + clips); transcript and captions get the room. Once the panel
  // itself is too narrow for that (a small window, or a split screen), fall
  // back to Classic's tabbed single panel rather than crushing three columns.
  const showColumns =
    layout === "cinema" &&
    (containerWidth === 0 || containerWidth >= CINEMA_MIN_WIDTH);

  return (
    <div ref={containerRef} className="h-full min-h-0 min-w-0">
      {showColumns ? (
        <div className="bg-card flex h-full min-h-0">
          <ColShell
            label="Media"
            className="border-border w-[300px] shrink-0 border-r"
          >
            {media}
          </ColShell>
          {/* Transcript brings its own matching header. */}
          <div className="border-border min-w-0 flex-1 overflow-hidden border-r">
            {transcript}
          </div>
          <ColShell label="Captions" className="flex-1">
            {captions}
          </ColShell>
        </div>
      ) : (
        // Classic (or Cinema squeezed too narrow): a narrow panel, so tab
        // between the three.
        <div className="bg-card flex h-full min-h-0 flex-col">
          <div className="border-border flex shrink-0 gap-1.5 overflow-x-auto border-b px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                    active
                      ? "text-foreground bg-[color:var(--sg-accent-2)]/15"
                      : "text-foreground/55 hover:bg-muted hover:text-foreground/85"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1">
            {tab === "media"
              ? media
              : tab === "captions"
                ? captions
                : transcript}
          </div>
        </div>
      )}
    </div>
  );
}

/** A titled column for the Cinema layout, so all three panels read consistently. */
function ColShell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex min-w-0 flex-col overflow-hidden ${className ?? ""}`}>
      <div className="border-border flex shrink-0 items-center border-b px-4 py-3">
        <p className="text-foreground text-sm font-black">{label}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
