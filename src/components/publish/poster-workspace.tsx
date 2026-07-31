"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  ImageIcon,
  Loader2,
  Palette,
  PenLine,
  Plus,
  Send,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react";
import CrossPostSheet, {
  type CrossPostTarget,
} from "@/components/publish/cross-post-sheet";
import PlatformVideos from "@/components/publish/platform-videos";
import { useAddVideo, type AddVideoError } from "@/hooks/use-add-video";
import { useContentList } from "@/hooks/use-content-list";
import { uploadThumbnailFile } from "@/hooks/use-thumbnail-upload";
import { defaultScheduleDate, patchContent } from "@/lib/content/client";
import { generateCaption } from "@/lib/publish/client";
import {
  postableVideos,
  type PostableVideo,
} from "@/lib/publish/postable-videos";

type ThumbnailPreset = "paper" | "ink" | "sunset";
type ThumbnailPosition = "top" | "center" | "bottom";

interface PostDraft {
  caption: string;
  headline: string;
  preset: ThumbnailPreset;
  position: ThumbnailPosition;
}

const PRESETS: Record<
  ThumbnailPreset,
  { label: string; shell: string; card: string }
> = {
  paper: {
    label: "Paper",
    shell: "bg-[linear-gradient(145deg,#e9e4db,#b9c0bd)]",
    card: "bg-white text-black",
  },
  ink: {
    label: "Ink",
    shell: "bg-[radial-gradient(circle_at_30%_10%,#373737,#090909_68%)]",
    card: "bg-black text-white ring-1 ring-white/15",
  },
  sunset: {
    label: "Sunset",
    shell:
      "bg-[radial-gradient(circle_at_18%_10%,#ffbd75,transparent_38%),linear-gradient(160deg,#a83525,#27111c_72%)]",
    card: "bg-white text-black",
  },
};

function uploadErrorText(error: AddVideoError): string {
  if (error === "not_video") return "Choose a video file.";
  if (error === "storage_full") return "Storage is full.";
  if (error === "locked") return "Uploading needs an active plan.";
  return "Upload failed. Please try again.";
}

function toLocalInput(iso?: string | null): string {
  const date = new Date(iso ?? defaultScheduleDate());
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function readableDate(iso: string | null): string {
  if (!iso) return "Not scheduled";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function defaultDraft(video: PostableVideo): PostDraft {
  return {
    caption: "",
    headline: video.title,
    preset: "paper",
    position: "top",
  };
}

function wrappedCanvasLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function renderThumbnail(draft: PostDraft): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("thumbnail_canvas");

  if (draft.preset === "paper") {
    const gradient = context.createLinearGradient(0, 0, 1080, 1920);
    gradient.addColorStop(0, "#eee9df");
    gradient.addColorStop(1, "#9fa9a6");
    context.fillStyle = gradient;
  } else if (draft.preset === "ink") {
    const gradient = context.createRadialGradient(300, 220, 20, 520, 900, 1300);
    gradient.addColorStop(0, "#464646");
    gradient.addColorStop(1, "#080808");
    context.fillStyle = gradient;
  } else {
    const gradient = context.createLinearGradient(0, 0, 800, 1920);
    gradient.addColorStop(0, "#f2a85f");
    gradient.addColorStop(0.34, "#a83525");
    gradient.addColorStop(1, "#27111c");
    context.fillStyle = gradient;
  }
  context.fillRect(0, 0, 1080, 1920);

  const headline = draft.headline.trim() || "Your text hook";
  let fontSize = 80;
  let lines: string[] = [];
  do {
    context.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
    lines = wrappedCanvasLines(context, headline, 820);
    if (lines.length <= 4) break;
    fontSize -= 5;
  } while (fontSize > 48);

  const lineHeight = fontSize * 1.15;
  const textHeight = lineHeight * lines.length;
  const centerY =
    draft.position === "top" ? 340 : draft.position === "bottom" ? 1560 : 900;
  const hasCard = draft.preset !== "ink";
  if (hasCard) {
    const widest = Math.max(
      ...lines.map((line) => context.measureText(line).width),
    );
    const width = Math.min(940, widest + 120);
    const height = textHeight + 90;
    context.save();
    context.shadowColor = "rgba(0,0,0,.25)";
    context.shadowBlur = 42;
    context.shadowOffsetY = 18;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.roundRect(540 - width / 2, centerY - height / 2, width, height, 38);
    context.fill();
    context.restore();
  }

  context.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = hasCard ? "#080808" : "#ffffff";
  if (!hasCard) {
    context.shadowColor = "rgba(0,0,0,.8)";
    context.shadowBlur = 18;
    context.shadowOffsetY = 5;
  }
  const firstY = centerY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    context.fillText(line, 540, firstY + index * lineHeight);
  });

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("thumbnail_blob")),
      "image/png",
      0.95,
    ),
  );
  return new File([blob], "yapper-thumbnail.png", { type: "image/png" });
}

async function downloadThumbnail(draft: PostDraft) {
  const file = await renderThumbnail(draft);
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function VideoCard({
  video,
  selected,
  active,
  onToggle,
  onOpen,
}: {
  video: PostableVideo;
  selected: boolean;
  active: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <article
      className={`group bg-card relative overflow-hidden rounded-2xl border transition-all ${
        active
          ? "border-[color:var(--sg-accent)] shadow-[0_18px_50px_-30px_var(--sg-accent)]"
          : "border-border hover:border-foreground/20"
      }`}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-[16/9] overflow-hidden bg-[radial-gradient(circle_at_20%_20%,color-mix(in_srgb,var(--sg-accent)_32%,transparent),transparent_44%),linear-gradient(145deg,#202020,#090909)]">
          <div className="absolute inset-0 grid place-items-center">
            <span className="max-w-[78%] text-center text-lg leading-tight font-black text-white/90">
              {video.title}
            </span>
          </div>
          <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
            Ready
          </span>
        </div>
        <div className="p-3.5 pr-12">
          <p className="text-foreground truncate text-sm font-black">
            {video.title}
          </p>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-[11px]">
            <Clock3 className="h-3 w-3" />
            {readableDate(video.scheduledFor)}
          </p>
        </div>
      </button>
      <button
        type="button"
        aria-label={
          selected ? `Deselect ${video.title}` : `Select ${video.title}`
        }
        onClick={onToggle}
        className={`absolute top-3 left-3 grid h-7 w-7 place-items-center rounded-full border shadow-sm backdrop-blur transition-all ${
          selected
            ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)] text-black"
            : "border-white/30 bg-black/45 text-transparent hover:text-white/70"
        }`}
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${video.title}`}
        className="text-muted-foreground hover:bg-muted hover:text-foreground absolute right-3 bottom-3 grid h-8 w-8 place-items-center rounded-full transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </article>
  );
}

function ThumbnailCanvas({
  draft,
  onChange,
  onDownload,
}: {
  draft: PostDraft;
  onChange: (draft: PostDraft) => void;
  onDownload: () => void;
}) {
  const position =
    draft.position === "top"
      ? "justify-start pt-[12%]"
      : draft.position === "bottom"
        ? "justify-end pb-[12%]"
        : "justify-center";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(180px,0.72fr)_1fr]">
      <div
        className={`relative mx-auto flex aspect-[9/16] w-full max-w-[230px] overflow-hidden rounded-2xl border border-white/10 p-[8%] shadow-2xl ${PRESETS[draft.preset].shell} ${position}`}
      >
        <div className="absolute inset-x-[8%] bottom-[8%] h-[42%] rounded-[40%_40%_15%_15%] bg-black/15 blur-xl" />
        <div
          className={`relative z-10 h-fit w-full rounded-xl px-3 py-3 text-center text-base leading-tight font-black shadow-xl ${PRESETS[draft.preset].card}`}
        >
          {draft.headline || "Your text hook"}
        </div>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-foreground/60 mb-1.5 block text-[11px] font-black tracking-wide uppercase">
            Thumbnail text
          </span>
          <textarea
            value={draft.headline}
            onChange={(event) =>
              onChange({ ...draft, headline: event.target.value })
            }
            rows={3}
            className="border-border bg-background text-foreground w-full resize-none rounded-xl border px-3 py-2.5 text-sm font-bold transition outline-none focus:border-[color:var(--sg-accent)]"
          />
        </label>
        <div>
          <p className="text-foreground/60 mb-2 text-[11px] font-black tracking-wide uppercase">
            Look
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PRESETS) as ThumbnailPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChange({ ...draft, preset })}
                className={`rounded-xl border px-2 py-2 text-xs font-black transition ${
                  draft.preset === preset
                    ? "text-foreground border-[color:var(--sg-accent)] bg-[color:color-mix(in_srgb,var(--sg-accent)_10%,transparent)]"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {PRESETS[preset].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-foreground/60 mb-2 text-[11px] font-black tracking-wide uppercase">
            Position
          </p>
          <div className="bg-muted/60 flex rounded-xl p-1">
            {(["top", "center", "bottom"] as ThumbnailPosition[]).map(
              (positionName) => (
                <button
                  key={positionName}
                  type="button"
                  onClick={() => onChange({ ...draft, position: positionName })}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-black capitalize ${
                    draft.position === positionName
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {positionName}
                </button>
              ),
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onDownload}
          className="border-border text-foreground hover:bg-muted flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition"
        >
          <Download className="h-3.5 w-3.5" />
          Download 1080 × 1920 PNG
        </button>
      </div>
    </div>
  );
}

export default function PosterWorkspace() {
  const { isSignedIn } = useUser();
  const { items, refresh, patchRow } = useContentList(!!isSignedIn, {
    includePosterUploads: true,
  });
  const videos = useMemo(() => postableVideos(items), [items]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PostDraft>>({});
  const [scheduleValue, setScheduleValue] = useState(toLocalInput());
  const [scheduleSpacing, setScheduleSpacing] = useState<"same" | "daily">(
    "daily",
  );
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [captionError, setCaptionError] = useState("");
  const [targets, setTargets] = useState<CrossPostTarget[] | null>(null);
  const [preparingPublish, setPreparingPublish] = useState(false);
  const [publishPrepError, setPublishPrepError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    state: uploadState,
    error: uploadError,
    add,
  } = useAddVideo(() => refresh());

  const active =
    videos.find((video) => video.id === activeId) ??
    videos.find((video) => selectedIds.has(video.id)) ??
    videos[0] ??
    null;
  const draft = active ? (drafts[active.id] ?? defaultDraft(active)) : null;
  const selected = videos.filter((video) => selectedIds.has(video.id));

  const setDraft = (id: string, next: PostDraft) => {
    setDrafts((current) => ({ ...current, [id]: next }));
  };

  const toggle = (video: PostableVideo) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(video.id)) next.delete(video.id);
      else next.add(video.id);
      return next;
    });
    setActiveId(video.id);
  };

  const generateForSelection = async () => {
    if (selected.length === 0) return;
    setGenerating(true);
    setCaptionError("");
    try {
      const results = await Promise.all(
        selected.map(async (video) => ({
          video,
          result: await generateCaption({
            title: video.title,
            context:
              "Write a natural social caption for this finished short video. Do not invent facts. Keep it adaptable to the actual format.",
            matchStyle: true,
          }),
        })),
      );
      setDrafts((current) => {
        const next = { ...current };
        for (const { video, result } of results) {
          const before = next[video.id] ?? defaultDraft(video);
          next[video.id] = {
            ...before,
            caption: result.description,
            headline: result.title || before.headline,
          };
        }
        return next;
      });
    } catch {
      setCaptionError("Caption generation failed. Your existing text is safe.");
    } finally {
      setGenerating(false);
    }
  };

  const scheduleSelection = async () => {
    if (selected.length === 0 || !scheduleValue) return;
    setScheduling(true);
    setScheduled(false);
    const base = new Date(scheduleValue);
    const previous = new Map(
      selected.map((video) => [
        video.id,
        { status: video.status, scheduledFor: video.scheduledFor },
      ]),
    );
    const changes = selected.map((video, index) => {
      const date = new Date(base);
      if (scheduleSpacing === "daily") date.setDate(date.getDate() + index);
      const scheduledFor = date.toISOString();
      patchRow(video.id, { status: "scheduled", scheduledFor });
      return { video, scheduledFor };
    });
    try {
      await Promise.all(
        changes.map(({ video, scheduledFor }) =>
          patchContent(video.id, { status: "scheduled", scheduledFor }),
        ),
      );
      setScheduled(true);
    } catch {
      for (const video of selected) {
        const old = previous.get(video.id);
        if (old) patchRow(video.id, old);
      }
    } finally {
      setScheduling(false);
    }
  };

  const preparePublish = async () => {
    if (!active || !draft || preparingPublish) return;
    setPreparingPublish(true);
    setPublishPrepError("");
    const publishVideos = selected.length > 0 ? selected : [active];
    const prepared = await Promise.all(
      publishVideos.map(async (video) => {
        const videoDraft = drafts[video.id] ?? defaultDraft(video);
        let thumbnail: { key: string; previewUrl: string } | undefined;
        try {
          thumbnail = await uploadThumbnailFile(
            await renderThumbnail(videoDraft),
          );
        } catch {
          // A cover is optional. Keep preparing the remaining videos and show
          // one non-blocking warning after the batch is ready.
        }
        return {
          id: video.id,
          title: video.title,
          initialTitle: videoDraft.headline || video.title,
          initialDescription: videoDraft.caption,
          submissionId: video.submissionId,
          contentItemId: video.id,
          thumbnailKey: thumbnail?.key,
          thumbnailPreviewUrl: thumbnail?.previewUrl,
        } satisfies CrossPostTarget;
      }),
    );
    if (prepared.some((item) => !item.thumbnailKey)) {
      setPublishPrepError(
        "One or more covers couldn't upload. The videos are still ready to publish.",
      );
    }
    setTargets(prepared);
    setPreparingPublish(false);
  };

  return (
    <div className="w-full">
      <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-foreground mb-2 inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--sg-accent)_28%,var(--border))] bg-[color:color-mix(in_srgb,var(--sg-accent)_8%,transparent)] px-3 py-1 text-[11px] font-black tracking-wide uppercase">
            <WandSparkles className="h-3.5 w-3.5 text-[color:var(--sg-accent)]" />
            Publishing desk
          </div>
          <h1 className="font-display text-foreground text-3xl font-black tracking-tight">
            Plan the post, then choose where it goes.
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
            Select one or many videos, create their captions and covers, then
            place them on your calendar. No platform is selected automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/studio/calendar"
            className="border-border text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition"
          >
            <CalendarDays className="h-4 w-4" />
            Open calendar
          </Link>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadState === "uploading"}
            className="bg-foreground text-background inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition hover:opacity-90 disabled:opacity-50"
          >
            {uploadState === "uploading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploadState === "uploading" ? "Uploading…" : "Add videos"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 0) {
                void (async () => {
                  for (const file of files) await add(file);
                })();
              }
              event.target.value = "";
            }}
          />
        </div>
      </header>

      {uploadError && (
        <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-bold text-red-500">
          {uploadErrorText(uploadError)}
        </p>
      )}

      <PlatformVideos />

      {items === null ? (
        <div className="text-muted-foreground mt-5 flex items-center gap-2 rounded-2xl border border-dashed px-5 py-8 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Yapper exports…
        </div>
      ) : videos.length > 0 ? (
        <div className="grid min-h-[680px] gap-5 xl:grid-cols-[minmax(0,1fr)_500px]">
          <section className="border-border bg-card/40 rounded-3xl border p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-foreground text-base font-black">
                  Your finished videos
                </h2>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Select cards to prepare them together.
                </p>
              </div>
              {videos.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds(
                      selectedIds.size === videos.length
                        ? new Set()
                        : new Set(videos.map((video) => video.id)),
                    )
                  }
                  className="border-border text-foreground hover:bg-muted rounded-full border px-3 py-1.5 text-xs font-black"
                >
                  {selectedIds.size === videos.length
                    ? "Clear selection"
                    : "Select all"}
                </button>
              )}
            </div>

            {items === null ? (
              <div className="text-muted-foreground grid min-h-80 place-items-center text-sm">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : videos.length === 0 ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="border-border hover:bg-muted/40 grid min-h-80 w-full place-items-center rounded-2xl border border-dashed text-center transition"
              >
                <span>
                  <span className="bg-muted text-foreground mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl">
                    <Plus className="h-5 w-5" />
                  </span>
                  <span className="text-foreground block text-sm font-black">
                    Add your first finished video
                  </span>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    It will appear here ready to prepare.
                  </span>
                </span>
              </button>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                {videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    selected={selectedIds.has(video.id)}
                    active={active?.id === video.id}
                    onToggle={() => toggle(video)}
                    onOpen={() => setActiveId(video.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="border-border bg-card overflow-hidden rounded-3xl border">
            {active && draft ? (
              <div className="flex h-full flex-col">
                <div className="border-border border-b px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black tracking-wide text-[color:var(--sg-accent)] uppercase">
                        Preparing
                      </p>
                      <h2 className="text-foreground mt-1 truncate text-base font-black">
                        {active.title}
                      </h2>
                    </div>
                    <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold">
                      {selected.length} selected
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto p-5">
                  <section>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <PenLine className="h-4 w-4 text-[color:var(--sg-accent)]" />
                        <h3 className="text-foreground text-sm font-black">
                          Caption
                        </h3>
                      </div>
                      <button
                        type="button"
                        disabled={selected.length === 0 || generating}
                        onClick={() => void generateForSelection()}
                        className="border-border text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black transition disabled:opacity-40"
                      >
                        {generating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Generate for selected
                      </button>
                    </div>
                    <textarea
                      value={draft.caption}
                      onChange={(event) =>
                        setDraft(active.id, {
                          ...draft,
                          caption: event.target.value,
                        })
                      }
                      placeholder="Write a caption, or generate one from the video title…"
                      rows={5}
                      className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full resize-none rounded-2xl border px-4 py-3 text-sm leading-6 transition outline-none focus:border-[color:var(--sg-accent)]"
                    />
                    {captionError && (
                      <p className="mt-2 text-xs font-bold text-red-500">
                        {captionError}
                      </p>
                    )}
                  </section>

                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <Palette className="h-4 w-4 text-[color:var(--sg-accent)]" />
                      <div>
                        <h3 className="text-foreground text-sm font-black">
                          Thumbnail studio
                        </h3>
                        <p className="text-muted-foreground text-[11px]">
                          A focused mini canvas—headline, look, and placement.
                        </p>
                      </div>
                    </div>
                    <ThumbnailCanvas
                      draft={draft}
                      onChange={(next) => setDraft(active.id, next)}
                      onDownload={() => void downloadThumbnail(draft)}
                    />
                  </section>

                  <section className="border-border bg-background/70 rounded-2xl border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-[color:var(--sg-accent)]" />
                      <h3 className="text-foreground text-sm font-black">
                        Schedule selected
                      </h3>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_130px]">
                      <input
                        type="datetime-local"
                        value={scheduleValue}
                        onChange={(event) =>
                          setScheduleValue(event.target.value)
                        }
                        className="border-border bg-card text-foreground rounded-xl border px-3 py-2 text-xs font-bold outline-none focus:border-[color:var(--sg-accent)]"
                      />
                      <select
                        value={scheduleSpacing}
                        onChange={(event) =>
                          setScheduleSpacing(
                            event.target.value as "same" | "daily",
                          )
                        }
                        className="border-border bg-card text-foreground rounded-xl border px-3 py-2 text-xs font-bold outline-none"
                      >
                        <option value="daily">One per day</option>
                        <option value="same">Same time</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={selected.length === 0 || scheduling}
                      onClick={() => void scheduleSelection()}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--sg-accent)] px-4 py-2.5 text-sm font-black text-black transition hover:brightness-105 disabled:opacity-40"
                    >
                      {scheduling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : scheduled ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <CalendarDays className="h-4 w-4" />
                      )}
                      {scheduling
                        ? "Scheduling…"
                        : scheduled
                          ? "Added to calendar"
                          : `Schedule ${selected.length || ""} selected`}
                    </button>
                  </section>
                </div>

                <div className="border-border bg-muted/20 border-t p-4">
                  {publishPrepError && (
                    <p className="mb-3 text-xs font-bold text-amber-500">
                      {publishPrepError}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={preparingPublish}
                    onClick={() => void preparePublish()}
                    className="bg-foreground text-background flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition hover:opacity-90 disabled:opacity-50"
                  >
                    {preparingPublish ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {preparingPublish
                      ? "Preparing caption and cover…"
                      : "Choose destination and publish"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid h-full min-h-[560px] place-items-center p-8 text-center">
                <div>
                  <span className="bg-muted text-muted-foreground mx-auto grid h-14 w-14 place-items-center rounded-2xl">
                    <ImageIcon className="h-6 w-6" />
                  </span>
                  <h2 className="text-foreground mt-4 text-base font-black">
                    Pick a video to prepare
                  </h2>
                  <p className="text-muted-foreground mt-1 max-w-xs text-sm leading-6">
                    Its caption, thumbnail, schedule, and publish controls will
                    appear here.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {targets && (
        <CrossPostSheet
          key={targets.map((target) => target.id).join(",")}
          items={targets}
          onClose={() => setTargets(null)}
        />
      )}
    </div>
  );
}
