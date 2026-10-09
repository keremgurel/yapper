"use client";

import styles from "@/components/studio-shell/chirpy-dock/chirpy-dock.module.css";

/**
 * The speech bubble Chirpy says hello with. It hangs off the bird on the side
 * facing the middle of the window, with its tail pointing back at the beak.
 * Clicking it is the same as clicking the bird.
 */
export default function ChirpyGreetingBubble({
  leaving,
  right,
  below,
  birdSize,
  onOpen,
  onGone,
}: {
  leaving: boolean;
  /** The bird is on the right half, so the bubble extends to the left. */
  right: boolean;
  /** The bird is near the top, so the bubble hangs underneath it. */
  below: boolean;
  birdSize: number;
  onOpen: () => void;
  onGone: () => void;
}) {
  const tailInset = birdSize / 2 - 6;
  return (
    <button
      type="button"
      onClick={onOpen}
      onAnimationEnd={(event) => {
        if (leaving && event.target === event.currentTarget) onGone();
      }}
      data-state={leaving ? "out" : "in"}
      className={`${styles.bubble} bg-card text-foreground border-border shadow-card pointer-events-auto absolute flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold whitespace-nowrap focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none`}
      style={{
        [right ? "right" : "left"]: 0,
        [below ? "top" : "bottom"]: `calc(100% + 12px)`,
        transformOrigin: `${right ? "right" : "left"} ${below ? "top" : "bottom"}`,
      }}
    >
      Ask me anything
      <kbd className="text-muted-foreground font-mono text-[11px] font-medium">
        ⌘K
      </kbd>
      <span
        aria-hidden
        className="bg-card border-border absolute size-3 rotate-45"
        style={{
          [right ? "right" : "left"]: tailInset,
          ...(below
            ? { top: -6.5, borderLeftWidth: 1, borderTopWidth: 1 }
            : { bottom: -6.5, borderRightWidth: 1, borderBottomWidth: 1 }),
        }}
      />
    </button>
  );
}
