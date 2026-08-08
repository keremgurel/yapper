"use client";

import { Chip, Section } from "@/components/studio-ui";
import { normalizeBody } from "@/lib/content/normalize";
import type { ContentDetail } from "@/lib/content/client";
import type { ContentBlock } from "@/lib/db/schema";

const PROSE = "text-foreground/85 max-w-[68ch] text-[15px] leading-relaxed";

function BlockBody({ block }: { block: ContentBlock }) {
  if (block.items?.length) {
    const ordered = block.kind === "steps";
    const List = ordered ? "ol" : "ul";
    return (
      <List
        className={`${PROSE} space-y-1 ${ordered ? "list-decimal" : "list-disc"} pl-5`}
      >
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </List>
    );
  }
  return <p className={`${PROSE} whitespace-pre-wrap`}>{block.text}</p>;
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
        <Section title="Your words" rank="quiet">
          <p className={`${PROSE} whitespace-pre-wrap italic`}>
            {detail.originalNote}
          </p>
        </Section>
      )}

      {detail.format && (
        <Section title="Format" rank="quiet">
          <p className={PROSE}>{detail.format}</p>
        </Section>
      )}

      {detail.summary && (
        <Section title="The read" rank="quiet">
          <p className={`${PROSE} whitespace-pre-wrap`}>{detail.summary}</p>
        </Section>
      )}

      {hooks.length > 0 && (
        <Section title="Hooks" rank="quiet">
          <ul className={`${PROSE} space-y-1.5`}>
            {hooks.map((hook, i) => (
              <li key={i}>
                {hook.text}
                {hook.pattern && (
                  <Chip tone="neutral" pill className="ml-2 align-middle">
                    {hook.pattern}
                  </Chip>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {blocks.map((block, i) => (
        <Section key={`${block.label}-${i}`} title={block.label} rank="quiet">
          <BlockBody block={block} />
        </Section>
      ))}

      {detail.sourceTranscript && (
        <Section title="Original transcript" rank="quiet">
          <p className="text-foreground/70 max-h-64 max-w-[68ch] overflow-y-auto text-[15px] leading-relaxed whitespace-pre-wrap">
            {detail.sourceTranscript}
          </p>
        </Section>
      )}

      {!detail.sourceTranscript && detail.sourceSummary && (
        <Section title="Source summary" rank="quiet">
          <p className="text-foreground/70 max-w-[68ch] text-[15px] leading-relaxed whitespace-pre-wrap">
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
