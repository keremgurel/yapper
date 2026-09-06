"use client";

import { Check } from "lucide-react";

/**
 * One row of the simple item list: a checkbox that shows itself on hover, a
 * title, an optional one-line preview, and whatever the surface puts on the
 * right. The whole row opens the item.
 *
 * Nothing else lives here on purpose. The old bank card carried a disclosure,
 * an open link, a reference link, a retry button and a chevron per row, and a
 * list of them was a field of controls with the ideas somewhere underneath.
 */
export default function ItemListRow({
  title,
  preview,
  selected,
  onToggleSelect,
  onOpen,
  trailing,
}: {
  title: string;
  preview?: string | null;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${title}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`group flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)]/60 focus-visible:ring-inset ${
        selected ? "bg-[color:var(--sg-accent)]/8" : "hover:bg-muted/40"
      }`}
    >
      <span
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        className={`shrink-0 transition-opacity ${
          selected
            ? "opacity-100"
            : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={onToggleSelect}
          aria-label={selected ? "Deselect" : "Select"}
          aria-pressed={selected}
          className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
            selected
              ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)] text-white"
              : "border-border hover:border-foreground/40"
          }`}
        >
          {selected && <Check className="h-3 w-3" />}
        </button>
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm font-medium">
          {title}
        </span>
        {preview && (
          <span className="text-muted-foreground block truncate text-[13px]">
            {preview}
          </span>
        )}
      </span>

      {trailing && (
        <span
          className="flex shrink-0 items-center gap-3"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {trailing}
        </span>
      )}
    </div>
  );
}
