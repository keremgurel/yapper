"use client";

import { useRef, useState } from "react";
import { useStudio } from "@/components/studio/studio-context";
import { loadVideoSource } from "@/lib/studio/load-source";
import { isNative, pickVideoPaths } from "@/lib/studio/native/bridge";
import { loadNativeSource } from "@/lib/studio/native/load-native-source";
import { Film, FolderOpen, Gauge, ShieldCheck, Sparkles } from "lucide-react";

export default function VideoUploader() {
  const { loadSources } = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: File[]) => {
    if (files.length === 0) return;
    if (files.some((file) => !file.type.startsWith("video/"))) {
      setError("Please choose video files only.");
      return;
    }
    setError("");
    Promise.all(files.map((file) => loadVideoSource(file, file.name)))
      .then(loadSources)
      .catch((cause: unknown) => {
        console.error("[studio] native source import failed", cause);
        const detail = cause instanceof Error ? cause.message : String(cause);
        setError(`Could not read one of those video files: ${detail}`);
      });
  };

  // Desktop: pick a real file path so the native ffmpeg pipeline (instant
  // thumbnails, native decode) handles it instead of an in-browser blob.
  const openPicker = () => {
    if (!isNative()) {
      inputRef.current?.click();
      return;
    }
    setError("");
    void pickVideoPaths()
      .then((paths) => {
        if (paths.length === 0) return;
        return Promise.all(paths.map(loadNativeSource)).then(loadSources);
      })
      .catch(() => setError("Could not read one of those video files."));
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (isNative()) {
            openPicker();
            return;
          }
          handleFiles(Array.from(e.dataTransfer.files ?? []));
        }}
        className={`group relative overflow-hidden rounded-[28px] border p-2 transition-all ${
          dragOver
            ? "border-[color:var(--sg-accent)] bg-[color:color-mix(in_srgb,var(--sg-accent)_8%,transparent)] shadow-[0_24px_80px_-45px_var(--sg-accent)]"
            : "border-border bg-card hover:border-foreground/20"
        }`}
      >
        <button
          type="button"
          onClick={openPicker}
          className={`relative flex w-full cursor-pointer flex-col items-center justify-center rounded-[22px] border border-dashed px-6 py-12 text-center transition-colors sm:py-14 ${
            dragOver
              ? "border-[color:var(--sg-accent)]/70 bg-[color:color-mix(in_srgb,var(--sg-accent)_5%,transparent)]"
              : "border-foreground/12 bg-background/45 group-hover:border-foreground/20"
          }`}
        >
          <span className="relative mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-[color:color-mix(in_srgb,var(--sg-accent)_13%,var(--background))] text-[color:var(--sg-accent)] ring-1 ring-[color:color-mix(in_srgb,var(--sg-accent)_24%,transparent)]">
            {dragOver ? (
              <Film className="h-7 w-7" />
            ) : (
              <FolderOpen className="h-7 w-7" />
            )}
            <span className="bg-foreground text-background absolute -right-1 -bottom-1 grid h-6 w-6 place-items-center rounded-full">
              <Sparkles className="h-3 w-3" />
            </span>
          </span>
          <p className="text-foreground text-lg font-black">
            {dragOver ? "Drop them here" : "Choose clips to start"}
          </p>
          <p className="text-foreground/55 mt-2 max-w-md text-sm leading-6">
            Pick one video or a whole sequence. MP4, MOV, HEVC, and longer
            recordings are welcome; the desktop app reads each original file
            directly.
          </p>
          <span className="bg-foreground text-background mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black shadow-lg">
            <FolderOpen className="h-4 w-4" />
            Browse clips
          </span>
        </button>

        <div className="grid gap-1 px-3 py-3 sm:grid-cols-3">
          <span className="text-muted-foreground flex items-center justify-center gap-1.5 text-[11px] font-bold">
            <Gauge className="h-3.5 w-3.5 text-[color:var(--sg-accent)]" />
            Native-speed preview
          </span>
          <span className="text-muted-foreground flex items-center justify-center gap-1.5 text-[11px] font-bold">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--sg-accent)]" />
            AI cleanup ready
          </span>
          <span className="text-muted-foreground flex items-center justify-center gap-1.5 text-[11px] font-bold">
            <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--sg-accent)]" />
            Stays on your device
          </span>
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-bold text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}
