"use client";

import { Sparkles } from "lucide-react";
import CanvasSectionTitle from "@/components/canvas/canvas-section-title";
import GrowingTextarea from "@/components/canvas/growing-textarea";
import { Button } from "@/components/ui/button";

const WORDS_PER_MINUTE = 150;

function readingTime(words: number): string {
  const seconds = Math.round((words / WORDS_PER_MINUTE) * 60);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The full script, always there to type into. The main thing on the page:
 * every other part exists to feed it. The title carries the count and how
 * long it takes to say, and the two ways to have Chirpy work on it.
 */
export default function ScriptEditor({
  text,
  onChange,
  onWrite,
  onAsk,
}: {
  text: string;
  onChange: (text: string) => void;
  /** Asks Chirpy to write the whole script. */
  onWrite: () => void;
  /** Aims Chirpy at the script. */
  onAsk: () => void;
}) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <section>
      <CanvasSectionTitle
        title="Script"
        meta={words ? `${words} words · ${readingTime(words)}` : undefined}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onAsk}
              className="text-muted-foreground"
              title="Ask Chirpy to change the script"
            >
              <Sparkles className="h-3 w-3" /> Ask
            </Button>
            {!words && (
              <Button type="button" size="xs" onClick={onWrite}>
                Write it for me
              </Button>
            )}
          </>
        }
      />
      <GrowingTextarea
        value={text}
        minHeight={420}
        onChange={(event) => onChange(event.target.value)}
        placeholder="The words you will say. Type here, or have Chirpy write a first draft."
        aria-label="Script"
        className="text-foreground placeholder:text-muted-foreground/50 w-full text-[16px] leading-[1.75]"
      />
    </section>
  );
}
