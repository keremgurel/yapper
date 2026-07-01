"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { loadVideoSource } from "@/lib/studio/load-source";

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
