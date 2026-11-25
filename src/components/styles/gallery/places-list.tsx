"use client";

import type { PlaceDescription } from "@/lib/style-library/templates/describe-template";

/**
 * The parts of the open look, top layer first as they stack on screen. A slot
 * is indented under the block it belongs to.
 */
export default function PlacesList({
  places,
  selected,
  onSelect,
}: {
  places: PlaceDescription[];
  selected: string;
  onSelect: (path: string) => void;
}) {
  return (
    <ul className="divide-border/60 divide-y">
      {[...places].reverse().map((place) => {
        const depth = place.path.split(".").length - 1;
        const active = place.path === selected;
        return (
          <li key={place.path}>
            <button
              type="button"
              onClick={() => onSelect(place.path)}
              aria-current={active}
              style={{ paddingLeft: 12 + depth * 16 }}
              className={`focus-visible:ring-foreground/40 flex min-h-10 w-full items-center justify-between gap-3 rounded-md pr-3 text-left transition-colors duration-[var(--sg-dur-fast)] outline-none focus-visible:ring-2 ${
                active ? "bg-muted" : "hover:bg-muted"
              }`}
            >
              <span className="text-foreground text-[13px] font-medium">
                {place.label}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {place.block?.name ?? "Empty"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
