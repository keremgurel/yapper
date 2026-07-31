"use client";

import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Captions,
  Film,
  SlidersHorizontal,
  Sparkles,
  Type,
} from "lucide-react";
import AudioTab from "@/components/studio/audio-tab";
import CaptionsTab from "@/components/studio/captions-tab";
import FiltersTab from "@/components/studio/filters-tab";
import MediaTab from "@/components/studio/media-tab";
import QuickEditPanel from "@/components/studio/quick-edit-panel";
import TextTab from "@/components/studio/text-tab";
import type { LayoutId } from "@/lib/studio/layout";

type Tool = "media" | "audio" | "text" | "captions" | "filters";

const TOOLS: Array<{ id: Tool; label: string; Icon: typeof Film }> = [
  { id: "media", label: "Media", Icon: Film },
  { id: "audio", label: "Audio", Icon: AudioLines },
  { id: "text", label: "Text", Icon: Type },
  { id: "captions", label: "Captions", Icon: Captions },
  { id: "filters", label: "Filters", Icon: SlidersHorizontal },
];

const WIDE_MIN = 590;

export default function RightPanel({
  currentTimelineTime,
  onSeek,
  onSeekTimeline,
}: {
  currentTimelineTime: number;
  onSeek: (time: number) => void;
  onSeekTimeline: (time: number) => void;
  layout?: LayoutId;
}) {
  const [tool, setTool] = useState<Tool>("media");
  const [compactQuickEdit, setCompactQuickEdit] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from a browser-only URL on mount
    if (requested === "captions") setTool("captions");
  }, []);

  const content =
    tool === "media" ? (
      <MediaTab />
    ) : tool === "audio" ? (
      <AudioTab currentTimelineTime={currentTimelineTime} />
    ) : tool === "text" ? (
      <TextTab currentTimelineTime={currentTimelineTime} />
    ) : tool === "captions" ? (
      <CaptionsTab
        onSeek={onSeekTimeline}
        currentTimelineTime={currentTimelineTime}
      />
    ) : (
      <FiltersTab />
    );
  const wide = width === 0 || width >= WIDE_MIN;

  return (
    <div ref={containerRef} className="bg-card h-full min-h-0 min-w-0">
      {wide ? (
        <div className="flex h-full min-h-0">
          <ToolRail active={tool} onChange={setTool} />
          <section className="border-border flex w-[270px] min-w-0 shrink-0 flex-col border-r">
            <PanelTitle
              title={TOOLS.find((item) => item.id === tool)?.label ?? "Media"}
            />
            <div className="min-h-0 flex-1">{content}</div>
          </section>
          <section className="min-w-[240px] flex-1">
            <QuickEditPanel
              currentTimelineTime={currentTimelineTime}
              onSeek={onSeek}
              onOpenText={() => setTool("text")}
            />
          </section>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-border flex shrink-0 items-stretch overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TOOLS.map(({ id, label, Icon }) => (
              <CompactTool
                key={id}
                active={!compactQuickEdit && tool === id}
                label={label}
                Icon={Icon}
                onClick={() => {
                  setTool(id);
                  setCompactQuickEdit(false);
                }}
              />
            ))}
            <CompactTool
              active={compactQuickEdit}
              label="Quick edit"
              Icon={Sparkles}
              onClick={() => setCompactQuickEdit(true)}
            />
          </div>
          <div className="min-h-0 flex-1">
            {compactQuickEdit ? (
              <QuickEditPanel
                currentTimelineTime={currentTimelineTime}
                onSeek={onSeek}
                onOpenText={() => {
                  setTool("text");
                  setCompactQuickEdit(false);
                }}
              />
            ) : (
              content
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolRail({
  active,
  onChange,
}: {
  active: Tool;
  onChange: (tool: Tool) => void;
}) {
  return (
    <nav
      aria-label="Editor tools"
      className="border-border bg-background/35 flex w-[72px] shrink-0 flex-col border-r px-1.5 py-2"
    >
      {TOOLS.map(({ id, label, Icon }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={selected ? "page" : undefined}
            className={`mb-1 flex h-[54px] flex-col items-center justify-center gap-1 rounded-lg text-[9px] font-bold transition ${selected ? "bg-[color:var(--sg-accent)]/12 text-[color:var(--sg-accent)]" : "text-foreground/50 hover:bg-muted hover:text-foreground"}`}
          >
            <Icon className="h-[17px] w-[17px]" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function CompactTool({
  active,
  label,
  Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  Icon: typeof Film;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-[72px] flex-col items-center gap-1 px-3 py-2 text-[9px] font-bold ${active ? "bg-[color:var(--sg-accent)]/12 text-[color:var(--sg-accent)]" : "text-foreground/50"}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function PanelTitle({ title }: { title: string }) {
  return (
    <div className="border-border flex h-[52px] shrink-0 items-center border-b px-4">
      <p className="text-foreground text-sm font-black">{title}</p>
    </div>
  );
}
