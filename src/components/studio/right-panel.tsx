"use client";

import { useState } from "react";
import { Captions, FileText, Film } from "lucide-react";
import MediaTab from "@/components/studio/media-tab";
import CaptionsTab from "@/components/studio/captions-tab";
import StudioTranscript from "@/components/studio/studio-transcript";

type Tab = "media" | "captions" | "transcript";

export default function RightPanel({
  currentSourceTime,
  onSeek,
  onSeekTimeline,
}: {
  currentSourceTime: number;
  onSeek: (t: number) => void;
  onSeekTimeline: (t: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("media");

  const tabBtn = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-bold transition-colors ${
      active
        ? "border-foreground text-foreground"
        : "text-foreground/50 hover:text-foreground/80 border-transparent"
    }`;

  return (
    <div className="bg-card flex h-full min-h-0 flex-col">
      <div className="border-border flex shrink-0 border-b">
        <button
          type="button"
          onClick={() => setTab("media")}
          className={tabBtn(tab === "media")}
        >
          <Film className="h-4 w-4" />
          Media
        </button>
        <button
          type="button"
          onClick={() => setTab("transcript")}
          className={tabBtn(tab === "transcript")}
        >
          <FileText className="h-4 w-4" />
          Transcript
        </button>
        <button
          type="button"
          onClick={() => setTab("captions")}
          className={tabBtn(tab === "captions")}
        >
          <Captions className="h-4 w-4" />
          Captions
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {tab === "media" ? (
          <MediaTab />
        ) : tab === "captions" ? (
          <CaptionsTab onSeek={onSeekTimeline} />
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
