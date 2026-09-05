"use client";

import { formatFrameTime } from "./frame-timeline";
import type { FilmstripTile } from "./use-filmstrip";

/** Twelve stills across the take. Clicking one moves the playhead there. */
export default function Filmstrip({
  tiles,
  loading,
  duration,
  time,
  onPick,
}: {
  tiles: FilmstripTile[];
  loading: boolean;
  duration: number;
  time: number;
  onPick: (time: number) => void;
}) {
  if (!loading && tiles.length === 0) return null;
  return (
    <div
      className="flex gap-0.5 overflow-hidden rounded-lg bg-black/40 p-0.5"
      role="group"
      aria-label="Moments in the video"
    >
      {tiles.map((tile, index) => {
        const active =
          duration > 0 &&
          time >= (index === 0 ? 0 : (tiles[index - 1].time + tile.time) / 2) &&
          time <
            (index === tiles.length - 1
              ? duration
              : (tile.time + tiles[index + 1].time) / 2);
        return (
          <button
            key={tile.time}
            type="button"
            aria-label={`Seek to ${formatFrameTime(tile.time)}`}
            aria-pressed={active}
            tabIndex={-1}
            onClick={() => onPick(tile.time)}
            className={`h-16 min-w-0 flex-1 overflow-hidden rounded-[3px] ${
              active ? "opacity-100" : "opacity-65"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tile.src}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          </button>
        );
      })}
      {loading
        ? Array.from({ length: Math.max(0, 12 - tiles.length) }, (_, i) => (
            <span
              key={`pending-${i}`}
              className="h-16 min-w-0 flex-1 animate-pulse rounded-[3px] bg-white/10 motion-reduce:animate-none"
            />
          ))
        : null}
    </div>
  );
}
