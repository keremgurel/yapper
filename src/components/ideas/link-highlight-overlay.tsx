"use client";

import { useLayoutEffect, useRef } from "react";

import { linkSpans } from "@/lib/inspiration/link-spans";

/**
 * The composer's own text, painted underneath the textarea so links can look
 * like links without giving up a plain textarea.
 *
 * The alternative was a contenteditable, which buys inline chips and costs
 * every other thing a textarea does for free: dictation inserting at the caret,
 * undo, spellcheck, drag and drop, IME, and the exact selection behaviour
 * people expect from a writing surface. So the textarea stays and renders its
 * glyphs transparent, and this draws the same string in the same metrics one
 * layer down with the links styled.
 *
 * Everything about the two has to match — font, size, leading, padding,
 * wrapping — or the paint slides off the words underneath it. That is the whole
 * risk of the technique, and it is why both sets of classes are written here
 * together rather than being left to drift apart in two files.
 */
export const COMPOSER_TEXT_CLASSES =
  "max-h-[320px] min-h-7 w-full px-3 py-1 text-[16px] leading-7";
/** Full screen: no cap, a reading-size type, and the field fills its column. */
export const COMPOSER_TEXT_CLASSES_EXPANDED =
  "h-full w-full px-3 py-1 text-[17px] leading-[1.65]";

export function composerTextClasses(expanded: boolean): string {
  return expanded ? COMPOSER_TEXT_CLASSES_EXPANDED : COMPOSER_TEXT_CLASSES;
}

export default function LinkHighlightOverlay({
  text,
  armedLink,
  scrollTop = 0,
  expanded = false,
}: {
  /** Matches the composer's full-screen metrics when it is maximized. */
  expanded?: boolean;
  /** The textarea's scroll offset, so the painted text stays under the typed text. */
  scrollTop?: number;
  text: string;
  /** The link Backspace has taken hold of, shown as selected before it goes. */
  armedLink?: string | null;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  // The textarea scrolls; this layer is overflow-hidden, so it is scrolled by
  // hand to the same offset or the painted words drift from the typed ones.
  useLayoutEffect(() => {
    if (overlay.current) overlay.current.scrollTop = scrollTop;
  }, [scrollTop, text]);

  return (
    <div
      aria-hidden
      ref={overlay}
      className={`${composerTextClasses(expanded)} text-foreground pointer-events-none absolute inset-0 overflow-hidden font-normal whitespace-pre-wrap`}
    >
      {linkSpans(text).map((span, index) =>
        span.isLink ? (
          <span
            key={`${span.start}-${index}`}
            className={
              armedLink === span.text
                ? "rounded-[5px] bg-[color:var(--sg-cyan-500)] px-[3px] py-[1px] text-white"
                : "rounded-[5px] bg-[color:var(--sg-cyan-500)]/12 px-[3px] py-[1px] font-medium text-[color:var(--sg-cyan-500)] underline decoration-[color:var(--sg-cyan-500)]/40 underline-offset-2"
            }
          >
            {span.text}
          </span>
        ) : (
          <span key={`${span.start}-${index}`}>{span.text}</span>
        ),
      )}
      {/* A trailing newline has no glyph of its own, so without this the last
          line of the paint is a line short of the text it is under. */}
      {text.endsWith("\n") ? " " : null}
    </div>
  );
}
