"use client";

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
  const slice = duration ? duration / Math.max(tiles.length, 1) : 0;
  return (
    <div
      className="flex gap-0.5 overflow-hidden rounded-lg bg-black/40 p-0.5"
      role="listbox"
      aria-label="Moments in the video"
    >
      {tiles.map((tile, index) => {
        const active =
          duration > 0 && time >= index * slice && time < (index + 1) * slice;
        return (
          <button
            key={tile.time}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onPick(tile.time)}
            className={`h-10 min-w-0 flex-1 overflow-hidden rounded-[3px] ring-2 transition-[ring-color] ${
              active ? "ring-[color:var(--sg-accent)]" : "ring-transparent"
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
              className="h-10 min-w-0 flex-1 animate-pulse rounded-[3px] bg-white/10 motion-reduce:animate-none"
            />
          ))
        : null}
    </div>
  );
}
