"use client";

import type { GalleryItem } from "./gallery-item";
import ItemRow from "./item-row";

/**
 * Everything that can be opened, grouped by shelf. A column beside the stage
 * on a wide screen and a row you swipe on a phone.
 */
export default function ItemList({
  items,
  selectedKey,
  onOpen,
}: {
  items: GalleryItem[];
  selectedKey: string;
  onOpen: (item: GalleryItem) => void;
}) {
  const groups = [...new Set(items.map((item) => item.group))];
  return (
    <nav
      aria-label="Templates and blocks"
      className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:block lg:space-y-6 lg:overflow-visible lg:px-0 lg:pb-0"
    >
      {groups.map((group) => (
        <section key={group} className="shrink-0">
          <h2 className="text-muted-foreground mb-1.5 px-2 text-xs font-semibold">
            {group}
          </h2>
          <div className="flex gap-1 lg:block lg:space-y-0.5">
            {items
              .filter((item) => item.group === group)
              .map((item) => (
                <ItemRow
                  key={item.key}
                  item={item}
                  selected={item.key === selectedKey}
                  onOpen={() => onOpen(item)}
                />
              ))}
          </div>
        </section>
      ))}
    </nav>
  );
}
