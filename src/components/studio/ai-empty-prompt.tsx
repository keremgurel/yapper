"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { loadVideoSource } from "@/lib/studio/load-source";

/**
 * There is no project yet, so there is nothing for the bird to place anything
 * over. It asks for a video and takes the file itself, rather than sending you
 * looking for the uploader.
 */
export default function AiEmptyPrompt() {
  const { loadSource } = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const take = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("That is not a video. Try an mp4 or a mov.");
      return;
    }
    setError("");
    loadVideoSource(file, file.name)
      .then(loadSource)
      .catch(() => setError("I could not read that video."));
  };

  return (
    <div>
      <p className="text-foreground/55 mb-2.5 text-sm">
        Start with a video. Then I can cut the retakes, write the captions, and
        put your b-roll where it belongs.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          take(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
          dragOver
            ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)]/10"
            : "border-border hover:bg-foreground/5"
        }`}
      >
        <span
          style={{ background: "var(--sg-accent-gradient)" }}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-black text-white"
        >
          <Upload className="h-4 w-4" />
          Choose a video
        </span>
        <span className="text-foreground/50 text-xs">
          Or drop one here. It never leaves your browser.
        </span>
      </div>

      {error && (
        <p className="mt-2.5 text-xs font-bold text-[color:var(--sg-pink-500)]">
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => take(e.target.files?.[0])}
      />
    </div>
  );
}
