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
    // Deterministic rather than observed: whichever item's midpoint is nearest
    // the middle of the viewport is the one being read. An IntersectionObserver
    // was leaving the panel stranded on a fast scroll, because a flick can move
    // every item out of the observed band between two callbacks and none of
    // them reports as intersecting.
    let frame = 0;

    const measure = () => {
      frame = 0;
      const nodes = itemRefs.current;
      const middle = window.innerHeight / 2;
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        if (!node) continue;
        const rect = node.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - middle);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }
      setActiveIndex(bestIndex);
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [items.length]);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
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
                  opacity: active ? 1 : 0.45,
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
                  // Two panels of dense text cross-fading over each other is
                  // unreadable mush for the length of the transition, so the
                  // outgoing one is pulled immediately and only the arriving
                  // one fades. visibility cannot tween, which is the point.
                  visibility: index === activeIndex ? "visible" : "hidden",
                  transition:
                    "opacity 220ms var(--sg-ease-out, ease-out), visibility 0s",
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
