"use client";

import { useState } from "react";
import { ArrowRight, Dices, Loader2 } from "lucide-react";
import ReadLine from "@/components/brain/recall/read-line";
import { Section } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import { useBrainSpin } from "@/hooks/use-brain-spin";
import { createIdea } from "@/lib/ideas/client";

/**
 * Pull the handle and get an idea built out of everything the brain knows.
 *
 * Three reels are dealt server-side (pillar, angle, format) and the model
 * writes for what they landed on, which is what stops every pull being the same
 * safe listicle in a different hat. Nothing is saved until the creator says so:
 * a spin they do not like costs one more pull, not a row in their bank.
 */
export default function SlotMachine({ pillars }: { pillars: string[] }) {
  const { idea, used, spinning, error, pull } = useBrainSpin();
  const [held, setHeld] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!idea || sending) return;
    setSending(true);
    try {
      // The creator's own words are what the bank keeps, so the idea goes in as
      // the note it would have been if they had typed it.
      await createIdea({
        originalNote: [idea.title, idea.angle, `Hook: ${idea.hook}`]
          .filter(Boolean)
          .join("\n\n"),
        ideaType: "original",
      });
      setSent(idea.title);
    } catch {
      setSent(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <Section
      title="Spin me an idea"
      action={
        <Button size="sm" onClick={() => void pull(held)} disabled={spinning}>
          {spinning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Dices className="h-4 w-4" />
          )}
          {spinning ? "Spinning" : "Spin"}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-muted-foreground text-xs">
          A pillar, an angle and a format, dealt at random and written for you.
        </p>

        {pillars.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground text-xs">
              Hold a pillar:
            </span>
            {pillars.map((pillar) => (
              <button
                key={pillar}
                type="button"
                onClick={() => setHeld(held === pillar ? null : pillar)}
                aria-pressed={held === pillar}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  held === pillar
                    ? "border-[color:var(--sg-accent)] text-[color:var(--sg-accent)]"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {pillar}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        {idea && (
          <article className="bg-muted space-y-3 rounded-xl p-4">
            <div className="text-muted-foreground flex flex-wrap gap-1.5 text-[11px]">
              {[
                idea.combination.pillar,
                idea.combination.angle,
                idea.combination.format,
              ]
                .filter(Boolean)
                .map((reel) => (
                  <span
                    key={reel}
                    className="border-border rounded-full border px-2 py-0.5"
                  >
                    {reel}
                  </span>
                ))}
            </div>

            <h3 className="text-base font-semibold">{idea.title}</h3>
            {idea.hook && (
              <p className="text-sm">
                <span className="text-muted-foreground">Open with: </span>
                &ldquo;{idea.hook}&rdquo;
              </p>
            )}
            {idea.angle && (
              <p className="text-muted-foreground text-sm">{idea.angle}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => void send()}
                disabled={sending || sent === idea.title}
              >
                {sent === idea.title ? (
                  "In your Idea Bank"
                ) : (
                  <>
                    Send to Idea Bank <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void pull(held)}
                disabled={spinning}
              >
                Again
              </Button>
            </div>
            <ReadLine used={used} />
          </article>
        )}
      </div>
    </Section>
  );
}
