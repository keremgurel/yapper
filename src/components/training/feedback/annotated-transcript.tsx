"use client";

import { useMemo, useState } from "react";
import { CHIP_TONES, Section } from "@/components/studio-ui";
import type {
  TrainingCorrection,
  TranscriptWord,
} from "@/lib/training-feedback/types";
import {
  annotateTranscript,
  unmatchedCorrections,
} from "@/components/training/feedback/annotate";
import { CORRECTION_TONES } from "@/components/training/feedback/correction-tones";
import CorrectionDetail from "@/components/training/feedback/correction-detail";
import CorrectionLegend from "@/components/training/feedback/correction-legend";

/**
 * The spoken transcript with corrected spans marked in their type's tone.
 * Selecting a mark shows that correction's fix and note below the prose.
 * Corrections that could not be anchored to the text still appear at the end
 * so nothing the coach flagged is lost.
 */
export default function AnnotatedTranscript({
  words,
  corrections,
}: {
  words: TranscriptWord[];
  corrections: TrainingCorrection[];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const segments = useMemo(
    () => annotateTranscript(words, corrections),
    [words, corrections],
  );
  const leftover = useMemo(
    () => unmatchedCorrections(segments, corrections),
    [segments, corrections],
  );

  if (segments.length === 0) {
    return (
      <p className="text-muted-foreground text-[13px]">
        The transcript for this rep is unavailable.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {corrections.length > 0 ? (
        <CorrectionLegend corrections={corrections} />
      ) : (
        <p className="text-muted-foreground text-xs">
          No inline corrections for this rep.
        </p>
      )}
      <p className="text-foreground max-w-[68ch] text-[17px] leading-[1.75]">
        {segments.map((seg, i) => {
          if (seg.correctionIndex === null) {
            return <span key={i}>{seg.text}</span>;
          }
          const correction = corrections[seg.correctionIndex];
          const tone = CHIP_TONES[CORRECTION_TONES[correction.type]];
          const isSelected = selected === seg.correctionIndex;
          return (
            <button
              key={i}
              type="button"
              aria-expanded={isSelected}
              onClick={() =>
                setSelected(isSelected ? null : seg.correctionIndex)
              }
              className={`inline rounded-sm px-0.5 text-inherit ${tone.bg} focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
                isSelected ? "ring-2 ring-[color:var(--sg-accent)]" : ""
              }`}
            >
              {seg.text}
            </button>
          );
        })}
      </p>
      {selected !== null && corrections[selected] && (
        <CorrectionDetail correction={corrections[selected]} />
      )}
      {leftover.length > 0 && (
        <Section title="Also flagged" rank="quiet">
          <div className="space-y-2">
            {leftover.map((c, i) => (
              <CorrectionDetail key={i} correction={c} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
