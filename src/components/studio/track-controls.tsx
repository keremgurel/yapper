"use client";

import { Eye, EyeOff, Trash2, Volume2, VolumeX } from "lucide-react";

const btn =
  "text-foreground/50 hover:text-foreground transition-colors disabled:opacity-30";

/**
 * The controls every track gets: hide, mute, delete. One component, used by the
 * bottom track, the upper tracks, and the audio tracks alike — a track that
 * happens to sit at the bottom of the stack is still just a track. Omit a
 * handler to leave that control off (audio has nothing to hide).
 */
export default function TrackControls({
  hidden,
  muted,
  onToggleHidden,
  onToggleMuted,
  onRemove,
}: {
  hidden?: boolean;
  muted?: boolean;
  onToggleHidden?: () => void;
  onToggleMuted?: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      {onToggleHidden && (
        <button
          type="button"
          onClick={onToggleHidden}
          className={btn}
          title={hidden ? "Show track" : "Hide track"}
          aria-label={hidden ? "Show track" : "Hide track"}
        >
          {hidden ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      )}
      {onToggleMuted && (
        <button
          type="button"
          onClick={onToggleMuted}
          className={btn}
          title={muted ? "Unmute track" : "Mute track"}
          aria-label={muted ? "Unmute track" : "Mute track"}
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className={`${btn} hover:!text-red-400`}
        title="Delete track"
        aria-label="Delete track"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </>
  );
}
