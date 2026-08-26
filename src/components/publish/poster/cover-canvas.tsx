"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  Film,
  ImagePlus,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_THUMBNAIL_PROMPT,
  type CoverDraft,
  type CoverPosition,
  type CoverTextStyle,
} from "@/components/publish/poster/cover-draft";

const FRAME_WIDTH = 1080;
const FRAME_HEIGHT = 1920;

function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60)
    .toString()
    .padStart(2, "0")}`;
}

function canvasImageData(source: HTMLVideoElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_WIDTH;
  canvas.height = FRAME_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("frame_canvas");
  const sourceRatio = source.videoWidth / source.videoHeight;
  const targetRatio = FRAME_WIDTH / FRAME_HEIGHT;
  let sx = 0;
  let sy = 0;
  let sw = source.videoWidth;
  let sh = source.videoHeight;
  if (sourceRatio > targetRatio) {
    sw = source.videoHeight * targetRatio;
    sx = (source.videoWidth - sw) / 2;
  } else {
    sh = source.videoWidth / targetRatio;
    sy = (source.videoHeight - sh) / 2;
  }
  context.drawImage(source, sx, sy, sw, sh, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  return canvas.toDataURL("image/jpeg", 0.9);
}

async function imageFileData(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not_image");
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("not_image"));
      element.src = source;
    });
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 1600 / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("image_canvas");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(source);
  }
}

function Preview({ draft }: { draft: CoverDraft }) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[230px] overflow-hidden rounded-2xl bg-[linear-gradient(145deg,#202020,#080808)] shadow-[0_28px_70px_-34px_rgba(0,0,0,.85)] ring-1 ring-white/10">
      {draft.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={draft.image}
          alt="Thumbnail preview"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div>
            <Film className="mx-auto h-7 w-7 text-white/55" />
            <p className="mt-2 text-xs font-semibold text-white/70">
              Pick a frame from the video
            </p>
          </div>
        </div>
      )}
      {draft.showHeadline && draft.headline.trim() ? (
        <div
          className={`absolute inset-x-0 flex p-[8%] ${
            draft.position === "top"
              ? "top-0 items-start"
              : draft.position === "center"
                ? "top-1/2 -translate-y-1/2 items-center"
                : "bottom-0 items-end bg-gradient-to-t from-black/80 via-black/20 to-transparent pt-[35%]"
          }`}
        >
          <p
            className={`w-full text-center text-xl leading-[1.02] font-black tracking-[-0.04em] uppercase ${
              draft.textStyle === "label"
                ? "rounded-md bg-[#f5d90a] px-2.5 py-2 text-black"
                : "text-white [text-shadow:0_2px_0_#000,2px_0_0_#000,-2px_0_0_#000,0_-2px_0_#000,0_5px_18px_rgba(0,0,0,.9)]"
            }`}
          >
            {draft.headline}
          </p>
        </div>
      ) : null}
      {draft.image ? (
        <span className="absolute top-2.5 left-2.5 rounded-full bg-black/65 px-2 py-1 text-[9px] font-bold tracking-[.12em] text-white uppercase backdrop-blur">
          {draft.source === "generated" ? "AI remix" : "Video frame"}
        </span>
      ) : null}
    </div>
  );
}

export default function CoverCanvas({
  draft,
  submissionId,
  onChange,
  onDownload,
}: {
  draft: CoverDraft;
  submissionId: string;
  onChange: (draft: CoverDraft) => void;
  onDownload: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [scrubTime, setScrubTime] = useState(draft.frameTime);
  const [frameBusy, setFrameBusy] = useState(false);
  const [frameError, setFrameError] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_THUMBNAIL_PROMPT);
  const [includeFrame, setIncludeFrame] = useState(true);
  const [reference, setReference] = useState<string | null>(null);
  const [referenceName, setReferenceName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");

  useEffect(() => {
    let live = true;
    setMediaUrl(null);
    setFrameError("");
    void (async () => {
      try {
        const detail = await fetch(`/api/submissions/${submissionId}`);
        if (!detail.ok) throw new Error("video_unavailable");
        const submission = (await detail.json()) as {
          submission?: { mediaKey?: string | null };
        };
        const key = submission.submission?.mediaKey;
        if (!key) throw new Error("video_unavailable");
        const signed = await fetch(
          `/api/media/sign?key=${encodeURIComponent(key)}`,
        );
        if (!signed.ok) throw new Error("video_unavailable");
        const { url } = (await signed.json()) as { url?: string };
        if (!url) throw new Error("video_unavailable");
        if (live) setMediaUrl(url);
      } catch {
        if (live) setFrameError("The video preview could not be loaded.");
      }
    })();
    return () => {
      live = false;
    };
  }, [submissionId]);

  const captureFrame = async (time = scrubTime, knownDuration = duration) => {
    const video = videoRef.current;
    if (!video) return;
    setFrameBusy(true);
    setFrameError("");
    try {
      const bounded = Math.min(
        Math.max(0, time),
        Math.max(0, knownDuration - 0.05),
      );
      if (video.seeking || Math.abs(video.currentTime - bounded) > 0.02) {
        await new Promise<void>((resolve, reject) => {
          const done = () => {
            video.removeEventListener("error", failed);
            resolve();
          };
          const failed = () => {
            video.removeEventListener("seeked", done);
            reject(new Error("frame_seek"));
          };
          video.addEventListener("seeked", done, { once: true });
          video.addEventListener("error", failed, { once: true });
          if (Math.abs(video.currentTime - bounded) > 0.02) {
            video.currentTime = bounded;
          }
        });
      }
      const image = canvasImageData(video);
      onChange({
        ...draftRef.current,
        frameImage: image,
        image,
        source: "frame",
        frameTime: bounded,
      });
      setScrubTime(bounded);
    } catch {
      setFrameError("That frame could not be captured. Try another moment.");
    } finally {
      setFrameBusy(false);
    }
  };

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setGenerationError("");
    try {
      const response = await fetch("/api/publish/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          frame: includeFrame ? draft.frameImage : undefined,
          reference: reference ?? undefined,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        image?: string;
        error?: string;
      };
      if (!response.ok || !result.image) {
        throw new Error(result.error ?? "generate_failed");
      }
      onChange({
        ...draftRef.current,
        image: result.image,
        source: "generated",
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      setGenerationError(
        reason === "not_entitled"
          ? "AI thumbnail generation needs an active plan."
          : reason === "insufficient_credits"
            ? "You need more credits to generate a thumbnail."
            : "Thumbnail generation failed. Your selected frame is safe.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const pickReference = async (file: File) => {
    setGenerationError("");
    try {
      const data = await imageFileData(file);
      setReference(data);
      setReferenceName(file.name || "Pasted example");
    } catch {
      setGenerationError("That example is not a readable image.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <Preview draft={draft} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!draft.image}
            onClick={onDownload}
            className="mt-3 w-full"
          >
            <Download aria-hidden />
            Download 1080 × 1920
          </Button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/8 bg-black/15 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-white/7">
                <Film className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-xs font-bold">1. Choose the exact frame</p>
                <p className="text-muted-foreground text-[10px]">
                  Scrub the actual finished video—this is the default thumbnail.
                </p>
              </div>
            </div>
            {mediaUrl ? (
              <video
                ref={videoRef}
                src={mediaUrl}
                crossOrigin="anonymous"
                muted
                playsInline
                preload="metadata"
                onLoadedMetadata={(event) => {
                  const nextDuration = event.currentTarget.duration || 0;
                  setDuration(nextDuration);
                  const initial = draftRef.current.frameImage
                    ? draftRef.current.frameTime
                    : Math.min(1, Math.max(0, nextDuration * 0.08));
                  setScrubTime(initial);
                  if (!draftRef.current.frameImage) {
                    void captureFrame(initial, nextDuration);
                  }
                }}
                className="aspect-video w-full rounded-lg bg-black object-contain"
              />
            ) : (
              <div className="bg-muted grid aspect-video place-items-center rounded-lg">
                <Loader2 className="text-muted-foreground h-4 w-4 animate-spin motion-reduce:animate-none" />
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-muted-foreground w-8 font-mono text-[10px] tabular-nums">
                {formatTime(scrubTime)}
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(duration, 0.1)}
                step={0.05}
                value={Math.min(scrubTime, Math.max(duration, 0.1))}
                disabled={!mediaUrl || !duration}
                onChange={(event) => {
                  const time = Number(event.target.value);
                  setScrubTime(time);
                  if (videoRef.current) videoRef.current.currentTime = time;
                }}
                className="min-w-0 flex-1 accent-[color:var(--sg-accent)]"
                aria-label="Video frame time"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => void captureFrame()}
                disabled={!mediaUrl || frameBusy}
              >
                {frameBusy ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" />
                ) : draft.source === "frame" && draft.image ? (
                  <Check />
                ) : (
                  <Film />
                )}
                Use frame
              </Button>
            </div>
            {frameError ? (
              <p role="alert" className="mt-2 text-[11px] text-amber-400">
                {frameError}
              </p>
            ) : null}
          </div>

          <div
            className="rounded-xl border border-[color:color-mix(in_srgb,var(--sg-accent)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--sg-accent)_7%,transparent)] p-3 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)]"
            tabIndex={0}
            onPaste={(event) => {
              const image = [...event.clipboardData.items].find((item) =>
                item.type.startsWith("image/"),
              );
              const file = image?.getAsFile();
              if (file) {
                event.preventDefault();
                void pickReference(file);
              }
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-[color:var(--sg-accent)] text-black">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-xs font-bold">2. Generate or remix</p>
                <p className="text-muted-foreground text-[10px]">
                  Prompt only, frame + prompt, or frame + example + prompt.
                </p>
              </div>
            </div>
            <textarea
              value={prompt}
              rows={5}
              maxLength={2000}
              disabled={generating}
              onChange={(event) => setPrompt(event.target.value)}
              className="border-border bg-background text-foreground w-full resize-y rounded-lg border px-3 py-2 text-[11px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)]"
              aria-label="Thumbnail generation prompt"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="border-border bg-background inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold">
                <input
                  type="checkbox"
                  checked={includeFrame}
                  disabled={!draft.frameImage || generating}
                  onChange={(event) => setIncludeFrame(event.target.checked)}
                  className="accent-[color:var(--sg-accent)]"
                />
                Keep selected frame
              </label>
              <label className="border-border bg-background inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold">
                <Upload className="h-3 w-3" />
                {referenceName || "Upload or paste example"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={generating}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void pickReference(file);
                  }}
                />
              </label>
              {reference ? (
                <div className="flex items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={reference}
                    alt="Example thumbnail"
                    className="h-8 w-8 rounded object-cover ring-1 ring-white/15"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setReference(null);
                      setReferenceName("");
                    }}
                    className="text-muted-foreground hover:text-foreground text-[10px] underline underline-offset-2"
                  >
                    Remove example
                  </button>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={generating || !prompt.trim()}
                onClick={() => void generate()}
                className="flex-1"
              >
                {generating ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <ImagePlus />
                )}
                {generating ? "Creating thumbnail…" : "Generate thumbnail"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Reset thumbnail prompt"
                disabled={generating || prompt === DEFAULT_THUMBNAIL_PROMPT}
                onClick={() => setPrompt(DEFAULT_THUMBNAIL_PROMPT)}
              >
                <RotateCcw />
              </Button>
            </div>
            {generationError ? (
              <p role="alert" className="mt-2 text-[11px] text-amber-400">
                {generationError}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/8 bg-black/15 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold">3. Optional text overlay</p>
            <p className="text-muted-foreground text-[10px]">
              Off by default. Add it only when the image needs a second hook.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.showHeadline}
            onClick={() =>
              onChange({ ...draft, showHeadline: !draft.showHeadline })
            }
            className={`relative h-6 w-11 rounded-full transition-colors ${
              draft.showHeadline ? "bg-[color:var(--sg-accent)]" : "bg-white/15"
            }`}
          >
            <span
              className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                draft.showHeadline ? "translate-x-5" : "translate-x-0"
              }`}
            />
            <span className="sr-only">Toggle text overlay</span>
          </button>
        </div>
        {draft.showHeadline ? (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <input
              value={draft.headline}
              maxLength={100}
              placeholder="Short thumbnail hook"
              onChange={(event) =>
                onChange({ ...draft, headline: event.target.value })
              }
              className="border-border bg-background text-foreground rounded-lg border px-3 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)]"
            />
            <div
              className="bg-muted flex rounded-lg p-1"
              role="group"
              aria-label="Text style"
            >
              {(["shadow", "label"] as CoverTextStyle[]).map((style) => (
                <button
                  key={style}
                  type="button"
                  aria-pressed={draft.textStyle === style}
                  onClick={() => onChange({ ...draft, textStyle: style })}
                  className={`rounded-md px-2 py-1 text-[10px] font-bold capitalize ${
                    draft.textStyle === style
                      ? "bg-background text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
            <div
              className="bg-muted flex rounded-lg p-1"
              role="group"
              aria-label="Text position"
            >
              {(["top", "center", "bottom"] as CoverPosition[]).map(
                (position) => (
                  <button
                    key={position}
                    type="button"
                    aria-pressed={draft.position === position}
                    onClick={() => onChange({ ...draft, position })}
                    className={`rounded-md px-2 py-1 text-[10px] font-bold capitalize ${
                      draft.position === position
                        ? "bg-background text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {position}
                  </button>
                ),
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
