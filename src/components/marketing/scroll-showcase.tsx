"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface ShowcaseItem {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  media: ReactNode;
}

/**
 * A list of capabilities on the left, one sticky panel of product on the
 * right. Whichever item is nearest the middle of the viewport is the one
 * reading at full strength; the rest recede. Scrolling the list drives the
 * panel.
 *
 * This is the one place motion is doing real explanatory work: the claim and
 * the screen making the claim are bound together, so the reader never has to
 * hold text in their head while hunting for the matching picture.
 *
 * Below the large breakpoint the sticky column cannot work, so each item
 * simply carries its own media inline and nothing moves.
 */
export default function ScrollShowcase({ items }: { items: ShowcaseItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const nodes = itemRefs.current.filter(Boolean) as HTMLDivElement[];
    if (nodes.length === 0 || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the middle of the band rather than the
        // first intersecting one, so a tall item does not hold the panel while
        // the next one is already the thing being read.
        let best: { index: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = nodes.indexOf(entry.target as HTMLDivElement);
          if (index < 0) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { index, ratio: entry.intersectionRatio };
          }
        }
        if (best) setActiveIndex(best.index);
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: [0, 0.25, 0.5, 1] },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [items.length]);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
      <div>
        {items.map((item, index) => {
          const active = index === activeIndex;
          return (
            <div
              key={item.id}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              className="py-8 lg:py-14"
            >
              <div
                className="motion-reduce:!opacity-100"
                style={{
                  opacity: active ? 1 : 0.35,
                  transition: "opacity 240ms var(--sg-ease-out, ease-out)",
                }}
              >
                <p className="text-[11px] font-bold tracking-[0.16em] text-[color:var(--sg-accent)] uppercase">
                  {item.eyebrow}
                </p>
                <h3 className="type-h3 mt-3">{item.title}</h3>
                <p className="text-muted-foreground mt-3 max-w-[46ch] text-[15px] leading-relaxed">
                  {item.body}
                </p>
              </div>

              {/* Narrow screens get the picture with its own claim. */}
              <div className="mt-6 lg:hidden">{item.media}</div>
            </div>
          );
        })}
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-24">
          <div className="relative">
            {items.map((item, index) => (
              <div
                key={item.id}
                aria-hidden={index !== activeIndex}
                className={
                  index === activeIndex
                    ? "relative"
                    : "pointer-events-none absolute inset-0"
                }
                style={{
                  opacity: index === activeIndex ? 1 : 0,
                  transition: "opacity 240ms var(--sg-ease-out, ease-out)",
                }}
              >
                {item.media}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
