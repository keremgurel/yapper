"use client";

/**
 * The creator's exact words, as they said them.
 *
 * Deliberately read-only and never regenerated. Everything else on the item can
 * be rebuilt by asking the model again; this is the one thing that cannot, so
 * the UI gives it no edit affordance and no AI control at all.
 */
export default function VerbatimNote({ note }: { note: string }) {
  if (!note.trim()) return null;

  return (
    <section aria-labelledby="wb-verbatim">
      <h2
        id="wb-verbatim"
        className="text-muted-foreground mb-1.5 text-[11px] font-bold tracking-[0.1em] uppercase"
      >
        Your exact words
      </h2>
      <blockquote className="text-foreground/75 max-w-[68ch] border-l border-[color:var(--sg-accent)]/40 pl-4 text-[15px] leading-relaxed whitespace-pre-wrap italic">
        {note}
      </blockquote>
    </section>
  );
}
