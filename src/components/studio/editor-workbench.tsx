"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  Captions,
  FileText,
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
import StudioTranscript from "@/components/studio/studio-transcript";
import TextTab from "@/components/studio/text-tab";

type ToolId =
  | "media"
  | "quick"
  | "transcript"
  | "audio"
  | "text"
  | "captions"
  | "filters";

type Tool = {
  id: ToolId;
  label: string;
  Icon: typeof Film;
};

const TOOLS: Tool[] = [
  { id: "media", label: "Media", Icon: Film },
  { id: "quick", label: "Quick Edit", Icon: Sparkles },
  { id: "transcript", label: "Transcript", Icon: FileText },
  { id: "audio", label: "Audio", Icon: AudioLines },
  { id: "text", label: "Text", Icon: Type },
  { id: "captions", label: "Captions", Icon: Captions },
  { id: "filters", label: "Filters", Icon: SlidersHorizontal },
];

const DEFAULT_ORDER = TOOLS.map((tool) => tool.id);
const STORAGE_KEY = "yapper.editor.workbench.v1";
// Keep the drop gesture available at the editor's default width. Individual
// tools already handle compact layouts, and users can widen the workbench when
// they want two roomier panes.
const MIN_PANE_WIDTH = 200;

function isToolId(value: unknown): value is ToolId {
  return TOOLS.some((tool) => tool.id === value);
}

function titleFor(id: ToolId): Tool {
  return TOOLS.find((tool) => tool.id === id) ?? TOOLS[0];
}

export default function EditorWorkbench({
  currentTimelineTime,
  onSeek,
  onSeekTimeline,
}: {
  currentTimelineTime: number;
  onSeek: (time: number) => void;
  onSeekTimeline: (time: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const draggedTab = useRef<ToolId | null>(null);
  const [width, setWidth] = useState(0);
  const [order, setOrder] = useState<ToolId[]>(DEFAULT_ORDER);
  const [panes, setPanes] = useState<ToolId[]>(["media"]);
  const [focusedPane, setFocusedPane] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [draggingTab, setDraggingTab] = useState<ToolId | null>(null);
  const [dropPane, setDropPane] = useState<number | "split" | null>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "");
      const storedOrder = Array.isArray(stored?.order)
        ? stored.order.filter(isToolId)
        : [];
      const storedPanes = Array.isArray(stored?.panes)
        ? stored.panes.filter(isToolId).slice(0, 2)
        : [];
      if (storedOrder.length === TOOLS.length) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time browser preference hydration
        setOrder(storedOrder);
      }
      if (storedPanes.length > 0) {
        setPanes(storedPanes);
      }
    } catch {
      // Invalid preferences fall back to the deliberate default workspace.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ order, panes }),
      );
    } catch {
      // Workbench tabs still work when persistence is unavailable.
    }
  }, [hydrated, order, panes]);

  const maxVisiblePanes = Math.max(
    1,
    Math.min(2, Math.floor((width || MIN_PANE_WIDTH) / MIN_PANE_WIDTH)),
  );
  const visiblePanes = panes.slice(0, maxVisiblePanes);
  const safeFocusedPane = Math.min(focusedPane, visiblePanes.length - 1);
  const visibleSet = useMemo(() => new Set(visiblePanes), [visiblePanes]);

  const openTool = (tool: ToolId) => {
    const existing = visiblePanes.indexOf(tool);
    if (existing >= 0) {
      setFocusedPane(existing);
      return;
    }
    setPanes((current) =>
      current.map((item, index) => (index === safeFocusedPane ? tool : item)),
    );
  };

  const openBeside = (tool: ToolId) => {
    const existing = visiblePanes.indexOf(tool);
    if (existing >= 0) {
      setFocusedPane(existing);
      return;
    }
    if (visiblePanes.length >= maxVisiblePanes || panes.length >= 2) return;
    setPanes((current) => [...current, tool]);
    setFocusedPane(panes.length);
  };

  const moveTab = (target: ToolId) => {
    const source = draggedTab.current;
    draggedTab.current = null;
    if (!source || source === target) return;
    setOrder((current) => {
      const next = current.filter((id) => id !== source);
      next.splice(next.indexOf(target), 0, source);
      return next;
    });
  };

  const endDrag = () => {
    draggedTab.current = null;
    setDraggingTab(null);
    setDropPane(null);
  };

  const dropBeside = () => {
    const source = draggedTab.current;
    if (source) openBeside(source);
    endDrag();
  };

  const dropIntoPane = (index: number) => {
    const source = draggedTab.current;
    if (!source) return endDrag();
    const sourcePane = visiblePanes.indexOf(source);
    if (sourcePane >= 0 && sourcePane !== index) {
      // Dragging an already-open pane back onto its neighbour merges the split,
      // matching desktop window managers.
      setPanes([source]);
      setFocusedPane(0);
    } else {
      setPanes((current) =>
        current.map((item, pane) => (pane === index ? source : item)),
      );
      setFocusedPane(index);
    }
    endDrag();
  };

  return (
    <section
      ref={rootRef}
      aria-label="Editor Workbench"
      className="bg-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
    >
      <div className="border-border flex h-11 shrink-0 items-stretch border-b">
        <div
          role="tablist"
          aria-label="Editing tools"
          className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {order.map((id) => {
            const { label, Icon } = titleFor(id);
            const open = visibleSet.has(id);
            const focused = visiblePanes[safeFocusedPane] === id;
            return (
              <div
                key={id}
                draggable
                onDragStart={(event) => {
                  draggedTab.current = id;
                  setDraggingTab(id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", id);
                }}
                onDragEnd={endDrag}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveTab(id)}
                className={`group/tab relative flex shrink-0 items-stretch border-r ${focused ? "bg-background" : "bg-card"}`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={focused}
                  title={`${label}${open ? " — open" : ""}. Drag into the workspace to split.`}
                  onClick={() => openTool(id)}
                  className={`flex h-full items-center gap-1.5 px-3 text-[11px] font-bold whitespace-nowrap transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:ring-inset ${focused ? "text-foreground" : open ? "text-foreground/70" : "text-foreground/45 hover:bg-muted/60 hover:text-foreground"}`}
                >
                  <Icon
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 ${focused ? "text-[color:var(--sg-accent)]" : ""}`}
                  />
                  {label}
                </button>
                {open && (
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 top-0 h-0.5 ${focused ? "bg-[color:var(--sg-accent)]" : "bg-foreground/25"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="relative grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: `repeat(${visiblePanes.length}, minmax(0, 1fr))`,
        }}
      >
        {visiblePanes.map((id, index) => {
          const { label } = titleFor(id);
          const focused = index === safeFocusedPane;
          return (
            <section
              key={`${id}-${index}`}
              aria-label={label}
              onPointerDown={() => setFocusedPane(index)}
              className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden ${index > 0 ? "border-border border-l" : ""} ${focused ? "bg-background/20" : "bg-card"}`}
            >
              <div className="min-h-0 flex-1 overflow-hidden">
                <ToolContent
                  id={id}
                  currentTimelineTime={currentTimelineTime}
                  onSeek={onSeek}
                  onSeekTimeline={onSeekTimeline}
                  openText={() => openTool("text")}
                  openTranscript={() => openTool("transcript")}
                />
              </div>
              {draggingTab && visiblePanes.length > 1 && (
                <div
                  onDragEnter={() => setDropPane(index)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropPane(index);
                  }}
                  onDragLeave={() =>
                    setDropPane((current) =>
                      current === index ? null : current,
                    )
                  }
                  onDrop={(event) => {
                    event.preventDefault();
                    dropIntoPane(index);
                  }}
                  className={`absolute inset-2 z-30 grid place-items-center rounded-xl border-2 border-dashed transition-colors duration-150 ${dropPane === index ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)]/16" : "border-foreground/20 bg-background/75"}`}
                >
                  <span className="bg-background/90 text-foreground rounded-full px-3 py-1.5 text-xs font-black shadow-sm">
                    {visibleSet.has(draggingTab)
                      ? "Merge here"
                      : `Open ${titleFor(draggingTab).label} here`}
                  </span>
                </div>
              )}
            </section>
          );
        })}

        {draggingTab &&
          visiblePanes.length === 1 &&
          maxVisiblePanes > 1 &&
          !visibleSet.has(draggingTab) && (
            <div
              onDragEnter={() => setDropPane("split")}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropPane("split");
              }}
              onDragLeave={() =>
                setDropPane((current) => (current === "split" ? null : current))
              }
              onDrop={(event) => {
                event.preventDefault();
                dropBeside();
              }}
              className={`absolute inset-y-2 right-2 z-30 grid w-[calc(50%_-_0.75rem)] place-items-center rounded-xl border-2 border-dashed transition-all duration-150 ${dropPane === "split" ? "translate-x-0 border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)]/16" : "border-foreground/20 bg-background/75 translate-x-1"}`}
            >
              <span className="bg-background/90 text-foreground rounded-full px-3 py-1.5 text-xs font-black shadow-sm">
                Open {titleFor(draggingTab).label} beside
              </span>
            </div>
          )}
      </div>
    </section>
  );
}

function ToolContent({
  id,
  currentTimelineTime,
  onSeek,
  onSeekTimeline,
  openText,
  openTranscript,
}: {
  id: ToolId;
  currentTimelineTime: number;
  onSeek: (time: number) => void;
  onSeekTimeline: (time: number) => void;
  openText: () => void;
  openTranscript: () => void;
}) {
  if (id === "media") return <MediaTab />;
  if (id === "quick") {
    return (
      <QuickEditPanel
        currentTimelineTime={currentTimelineTime}
        onOpenText={openText}
        onOpenTranscript={openTranscript}
        embedded
      />
    );
  }
  if (id === "transcript") {
    return (
      <StudioTranscript
        currentTimelineTime={currentTimelineTime}
        onSeek={onSeek}
        embedded
      />
    );
  }
  if (id === "audio") {
    return <AudioTab currentTimelineTime={currentTimelineTime} />;
  }
  if (id === "text") {
    return <TextTab currentTimelineTime={currentTimelineTime} />;
  }
  if (id === "captions") {
    return (
      <CaptionsTab
        onSeek={onSeekTimeline}
        currentTimelineTime={currentTimelineTime}
      />
    );
  }
  return <FiltersTab />;
}
