"use client";

import { useRef, useState } from "react";
import { History, UploadCloud } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { loadVideoSource } from "@/lib/studio/load-source";

function fmtDur(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function VideoUploader() {
  const { loadSource, restoreInfo, restoreWithVideo, dismissRestore } =
    useStudio();
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Please choose a video file.");
      return;
    }
    setError("");
    loadVideoSource(file, file.name)
      .then(loadSource)
      .catch(() => setError("Could not read that video file."));
  };

  const handleRestore = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Please choose a video file.");
      return;
    }
    setError("");
    void restoreWithVideo(file).catch(() =>
      setError("Could not read that video file."),
    );
  };

  return (
    <div className="mx-auto w-full max-w-2xl py-10">
      {restoreInfo && (
        <div className="border-border bg-card mb-4 rounded-3xl border p-5 ring-1 ring-cyan-500/40">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-500">
              <History className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-sm font-black">
                Pick up where you left off
              </p>
              <p className="text-foreground/60 mt-0.5 text-[13px] leading-5">
                Your edits are saved
                {restoreInfo.words > 0 && ` — ${restoreInfo.words} words`}
                {restoreInfo.captions > 0 &&
                  `, ${restoreInfo.captions} captions`}
                . Re-select{" "}
                <span className="text-foreground font-bold">
                  {restoreInfo.name}
                </span>{" "}
                ({fmtDur(restoreInfo.duration)}) to continue.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => restoreInputRef.current?.click()}
                  className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-cyan-600"
                >
                  Re-select video
                </button>
                <button
                  type="button"
                  onClick={dismissRestore}
                  className="text-foreground/50 hover:text-foreground text-xs font-bold"
                >
                  Start fresh
                </button>
              </div>
            </div>
          </div>
          <input
            ref={restoreInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleRestore(e.target.files?.[0])}
          />
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed px-6 py-20 text-center transition-colors ${
          dragOver
            ? "border-foreground/40 bg-muted"
            : "border-border hover:bg-muted"
        }`}
      >
        <UploadCloud className="text-foreground/40 h-9 w-9" />
        <p className="text-foreground text-base font-bold">
          Drop a video to edit
        </p>
        <p className="text-foreground/55 max-w-sm text-sm">
          Trim clips, cut silences, and clean up takes — all in your browser.
          Nothing is uploaded.
        </p>
        <span className="bg-foreground text-background mt-2 rounded-full px-4 py-2.5 text-sm font-black">
          Choose a video
        </span>
      </div>
      {error && <p className="mt-3 text-sm font-bold text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
