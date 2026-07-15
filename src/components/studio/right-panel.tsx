"use client";

import { useEffect, useState } from "react";
import { Captions, FileText, Film, Sparkles } from "lucide-react";
import MediaTab from "@/components/studio/media-tab";
import CaptionsTab from "@/components/studio/captions-tab";
import StudioTranscript from "@/components/studio/studio-transcript";
import FeedbackTab from "@/components/studio/feedback/feedback-tab";

type Tab = "media" | "transcript" | "captions" | "feedback";

export default function RightPanel({
  currentSourceTime,
  currentTimelineTime,
  onSeek,
  onSeekTimeline,
}: {
  currentSourceTime: number;
  currentTimelineTime: number;
  onSeek: (t: number) => void;
  onSeekTimeline: (t: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("media");

  // Open a specific tab when linked (e.g. the practice screen sends
  // ?tab=feedback after "Get AI feedback"). Read after mount to avoid the
  // useSearchParams prerender/Suspense constraint and hydration mismatch.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from a browser-only source (URL) on mount
    if (t === "feedback" || t === "transcript" || t === "captions") setTab(t);
  }, []);

  const tabBtn = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-bold transition-colors ${
      active
        ? "text-foreground"
        : "text-foreground/50 hover:text-foreground/80 border-transparent"
    }`;
  const tabStyle = (active: boolean) =>
    active
      ? {
          borderColor: "var(--sg-accent-2)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--sg-accent-2) 10%, transparent), transparent)",
        }
      : undefined;

  return (
    <div className="bg-card flex h-full min-h-0 flex-col">
      <div className="border-border flex shrink-0 border-b">
        <button
          type="button"
          onClick={() => setTab("media")}
          className={tabBtn(tab === "media")}
          style={tabStyle(tab === "media")}
        >
          <Film className="h-4 w-4" />
          Media
        </button>
        <button
          type="button"
          onClick={() => setTab("transcript")}
          className={tabBtn(tab === "transcript")}
          style={tabStyle(tab === "transcript")}
        >
          <FileText className="h-4 w-4" />
          Transcript
        </button>
        <button
          type="button"
          onClick={() => setTab("captions")}
          className={tabBtn(tab === "captions")}
          style={tabStyle(tab === "captions")}
        >
          <Captions className="h-4 w-4" />
          Captions
        </button>
        <button
          type="button"
          onClick={() => setTab("feedback")}
          className={tabBtn(tab === "feedback")}
          style={tabStyle(tab === "feedback")}
        >
          <Sparkles className="h-4 w-4" />
          Feedback
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {tab === "media" ? (
          <MediaTab />
        ) : tab === "captions" ? (
          <CaptionsTab
            onSeek={onSeekTimeline}
            currentTimelineTime={currentTimelineTime}
          />
        ) : tab === "feedback" ? (
          <FeedbackTab />
        ) : (
          <StudioTranscript
            currentSourceTime={currentSourceTime}
            onSeek={onSeek}
          />
        )}
      </div>
    </div>
  );
}
