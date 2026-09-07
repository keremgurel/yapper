"use client";

import { useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronRight } from "lucide-react";
import TranscriptRecovery from "@/components/workbench/transcript-recovery";
import { Section } from "@/components/studio-ui";
import type { ContentDetail, ContentPatch } from "@/lib/content/client";

/**
 * Where the piece came from, under the writing: the creator's own words as
 * captured, and what the reference actually says. Open by default, because a
 * transcript you are adapting is something you keep glancing back at while
 * you write. A reference we could not hear says so and offers the ways to
 * fix it, instead of a heading with nothing under it.
 */
export default function CanvasReference({
  item,
  update,
}: {
  item: ContentDetail;
  update: (patch: ContentPatch) => void;
}) {
  const note = item.originalNote.trim();
  const transcript = item.sourceTranscript?.trim() ?? "";
  const recorded = item.recordedTranscript?.trim() ?? "";
  const summary = item.sourceSummary?.trim() ?? "";
  const hasReference = Boolean(item.sourceTitle || item.sourceUrl);
  const [noteOpen, setNoteOpen] = useState(true);
  if (!note && !hasReference && !transcript && !summary && !recorded)
    return null;

  const NoteChevron = noteOpen ? ChevronDown : ChevronRight;

  return (
    <div className="space-y-10">
      {recorded && (
        <Section title="What you said" rank="lead" meta="from your recording">
          <p className="text-foreground/80 max-w-[68ch] text-[15px] leading-relaxed whitespace-pre-wrap">
            {recorded}
          </p>
        </Section>
      )}
      {(transcript || summary || hasReference) && (
        <Section
          title="Reference"
          rank="lead"
          meta={
            item.transcriptStatus === "pending"
              ? "transcribing"
              : transcript
                ? "transcript"
                : summary
                  ? "page summary"
                  : undefined
          }
          action={
            item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
              >
                {item.sourceTitle
                  ? truncate(item.sourceTitle, 48)
                  : "Open reference"}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            ) : undefined
          }
        >
          {transcript ? (
            <p className="text-foreground/80 max-w-[68ch] text-[15px] leading-relaxed whitespace-pre-wrap">
              {transcript}
            </p>
          ) : summary ? (
            <div>
              <p className="text-foreground/80 max-w-[68ch] text-[15px] leading-relaxed whitespace-pre-wrap">
                {summary}
              </p>
              <p className="text-muted-foreground mt-2 text-xs">
                This is a summary of the page, not the reference’s spoken words.
              </p>
              {item.sourceUrl && (
                <div className="mt-3">
                  <TranscriptRecovery
                    sourceUrl={item.sourceUrl}
                    update={update}
                  />
                </div>
              )}
            </div>
          ) : item.transcriptStatus === "pending" ? (
            <p className="text-muted-foreground text-sm">
              Fetching the transcript. It shows up here when it lands.
            </p>
          ) : (
            <div>
              <p className="text-muted-foreground max-w-[60ch] text-sm">
                No transcript for this reference yet, so Chirpy only knows what
                you wrote about it. Fetch it again, attach the file, or paste
                the words in.
              </p>
              <div className="mt-3">
                <TranscriptRecovery
                  sourceUrl={item.sourceUrl}
                  update={update}
                />
              </div>
            </div>
          )}
        </Section>
      )}

      {note && (
        <section>
          <button
            type="button"
            onClick={() => setNoteOpen((value) => !value)}
            aria-expanded={noteOpen}
            className="text-foreground font-display border-border/70 mb-3 flex w-full items-center gap-1.5 border-b pb-1.5 text-left text-[13px] font-black tracking-[0.14em] uppercase"
          >
            <NoteChevron className="h-3.5 w-3.5" />
            Your original note
          </button>
          {noteOpen && (
            <blockquote className="text-foreground/75 max-w-[68ch] border-l border-[color:var(--sg-accent)]/40 pl-4 text-[15px] leading-relaxed whitespace-pre-wrap italic">
              {note}
            </blockquote>
          )}
        </section>
      )}
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
