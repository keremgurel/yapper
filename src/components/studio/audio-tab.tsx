"use client";

import { useRef, useState } from "react";
import { Loader2, Music2, Play, Plus, Trash2, Upload } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { Button } from "@/components/ui/button";
import {
  previewSoundEffect,
  SOUND_EFFECTS,
  soundEffectFile,
  type SoundEffectId,
} from "@/lib/studio/sound-effects";

export default function AudioTab({
  currentTimelineTime,
}: {
  currentTimelineTime: number;
}) {
  const { audioTracks, addAudio, removeAudio } = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState("");

  const addEffect = async (id: SoundEffectId) => {
    setAdding(id);
    setError("");
    try {
      await addAudio(soundEffectFile(id), currentTimelineTime);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not add that sound.",
      );
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border shrink-0 border-b p-3">
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          size="sm"
          className="w-full"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload audio
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,video/*"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            setAdding("upload");
            setError("");
            void Promise.all(
              files.map((file) => addAudio(file, currentTimelineTime)),
            )
              .catch((cause: unknown) =>
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Could not add that audio.",
                ),
              )
              .finally(() => setAdding(null));
            event.target.value = "";
          }}
        />
        <p className="text-foreground/45 mt-2 text-center text-[11px]">
          Audio lands on the timeline at the playhead
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-foreground text-xs font-black">Sound effects</p>
            <span className="text-foreground/35 text-[10px]">Built in</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SOUND_EFFECTS.map((effect) => (
              <div
                key={effect.id}
                className="border-border bg-muted/30 rounded-xl border p-2.5"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/12 text-emerald-400">
                    <Music2 className="h-3.5 w-3.5" />
                  </span>
                  <Button
                    type="button"
                    onClick={() => previewSoundEffect(effect.id)}
                    aria-label={`Preview ${effect.name}`}
                    variant="ghost"
                    size="icon-xs"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                  </Button>
                </div>
                <p className="text-foreground text-xs font-black">
                  {effect.name}
                </p>
                <p className="text-foreground/40 mt-0.5 truncate text-[9px]">
                  {effect.hint}
                </p>
                <Button
                  type="button"
                  disabled={adding !== null}
                  onClick={() => void addEffect(effect.id)}
                  variant="outline"
                  size="xs"
                  className="mt-2 w-full"
                >
                  {adding === effect.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Add
                </Button>
              </div>
            ))}
          </div>
        </section>

        {audioTracks.length > 0 && (
          <section>
            <p className="text-foreground mb-2 text-xs font-black">
              On timeline
            </p>
            <div className="space-y-1.5">
              {audioTracks.map((track) => (
                <div
                  key={track.id}
                  className="border-border flex items-center gap-2 rounded-lg border px-2.5 py-2"
                >
                  <Music2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground/80 truncate text-[11px] font-bold">
                      {track.name}
                    </p>
                    <p className="text-foreground/35 text-[9px]">
                      {track.start.toFixed(1)}s · {track.duration.toFixed(1)}s
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => removeAudio(track.id)}
                    aria-label={`Remove ${track.name}`}
                    variant="ghost"
                    size="icon-xs"
                    className="text-foreground/35 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {adding === "upload" && (
          <p className="text-foreground/55 flex items-center gap-2 text-xs font-bold">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading audio…
          </p>
        )}
        {error && <p className="text-xs font-bold text-red-500">{error}</p>}
      </div>
    </div>
  );
}
