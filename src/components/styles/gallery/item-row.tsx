"use client";

import type { GalleryItem } from "./gallery-item";

/** One entry in the browse list: its rendered still, its name, one line about it. */
export default function ItemRow({
  item,
  selected,
  onOpen,
}: {
  item: GalleryItem;
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={selected}
      className={`focus-visible:ring-foreground/40 flex w-36 shrink-0 flex-col gap-2 rounded-lg p-2 text-left transition-colors duration-[var(--sg-dur-fast)] outline-none focus-visible:ring-2 lg:w-full lg:flex-row lg:items-center lg:gap-3 ${
        selected ? "bg-muted" : "hover:bg-muted"
      }`}
    >
      <span className="bg-muted block aspect-[9/16] w-full shrink-0 overflow-hidden rounded-md lg:w-9">
        {item.poster ? (
          // Stills rendered by the style runner; fixed 9:16, so no layout shift.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.poster}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="text-foreground block truncate text-[13px] font-medium">
          {item.name}
        </span>
        {item.summary && (
          <span className="text-muted-foreground line-clamp-2 text-xs leading-snug">
            {item.summary}
          </span>
        )}
      </span>
    </button>
  );
}
