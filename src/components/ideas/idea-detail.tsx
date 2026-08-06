"use client";

import { normalizeBody } from "@/lib/content/normalize";
import type { ContentDetail } from "@/lib/content/client";
import type { ContentBlock } from "@/lib/db/schema";

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function BlockBody({ block }: { block: ContentBlock }) {
  if (block.items?.length) {
    const ordered = block.kind === "steps";
    const List = ordered ? "ol" : "ul";
    return (
      <List
        className={`text-foreground/85 space-y-1 ${
          ordered ? "list-decimal" : "list-disc"
        } pl-5`}
      >
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </List>
    );
  }
  return <p className="text-foreground/85 whitespace-pre-wrap">{block.text}</p>;
}

/**
 * The full body of one idea.
 *
 * Order matters here: the creator's exact words come first and are never
 * AI-touched, the reference's verbatim transcript is kept intact, and the
 * AI-built blocks come last as the regenerable layer on top.
 */
export default function IdeaDetail({ detail }: { detail: ContentDetail }) {
  const { hooks, blocks } = normalizeBody(detail);

  return (
    <div className="space-y-5">
      {detail.originalNote && (
        <Section label="Your words">
          <p className="text-foreground/85 whitespace-pre-wrap italic">
            {detail.originalNote}
          </p>
        </Section>
      )}

      {detail.format && (
        <Section label="Format">
          <p className="text-foreground/85">{detail.format}</p>
        </Section>
      )}

      {detail.summary && (
        <Section label="The read">
          <p className="text-foreground/85 whitespace-pre-wrap">
            {detail.summary}
          </p>
        </Section>
      )}

      {hooks.length > 0 && (
        <Section label="Hooks">
          <ul className="text-foreground/85 space-y-1.5">
            {hooks.map((hook, i) => (
              <li key={i}>
                {hook.text}
                {hook.pattern && (
                  <span className="bg-muted text-muted-foreground ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold">
                    {hook.pattern}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {blocks.map((block, i) => (
        <Section key={`${block.label}-${i}`} label={block.label}>
          <BlockBody block={block} />
        </Section>
      ))}

      {detail.sourceTranscript && (
        <Section label="Original transcript">
          <p className="text-foreground/70 max-h-64 overflow-y-auto whitespace-pre-wrap">
            {detail.sourceTranscript}
          </p>
        </Section>
      )}

      {!detail.sourceTranscript && detail.sourceSummary && (
        <Section label="Source summary">
          <p className="text-foreground/70 whitespace-pre-wrap">
            {detail.sourceSummary}
          </p>
          <p className="text-muted-foreground mt-1.5 text-xs">
            This is a summary of the page, not the reference&apos;s spoken
            words.
          </p>
        </Section>
      )}
    </div>
  );
}
