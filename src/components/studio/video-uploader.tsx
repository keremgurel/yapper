"use client";

import { useRef, useState } from "react";
import { useStudio } from "@/components/studio/studio-context";
import { loadVideoSource } from "@/lib/studio/load-source";
import { isNative, pickVideoPath } from "@/lib/studio/native/bridge";
import { loadNativeSource } from "@/lib/studio/native/load-native-source";
import { Chirpy } from "@/components/brand/chirpy";

export default function VideoUploader() {
  const { loadSource } = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);
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
      .catch((cause: unknown) => {
        console.error("[studio] native source import failed", cause);
        const detail = cause instanceof Error ? cause.message : String(cause);
        setError(`Could not read that video file: ${detail}`);
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
    void pickVideoPath()
      .then((path) => {
        if (!path) return;
        return loadNativeSource(path).then(loadSource);
      })
      .catch(() => setError("Could not read that video file."));
  };

  return (
    <div className="mx-auto max-w-2xl py-10">
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
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={openPicker}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed px-6 py-20 text-center transition-colors ${
          dragOver
            ? "border-foreground/40 bg-muted"
            : "border-border hover:bg-muted"
        }`}
      >
        <Chirpy expression={dragOver ? "happy" : "idle"} size={96} />
        <p className="text-foreground text-base font-bold">
          Drop a video to edit
        </p>
        <p className="text-foreground/55 max-w-sm text-sm">
          Trim clips, cut silences, and clean up takes, all in your browser.
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
