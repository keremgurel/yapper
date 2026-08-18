"use client";

import { useState } from "react";
import type {
  TrainingCorrection,
  TranscriptWord,
} from "@/lib/training-feedback/types";
import AnnotatedTranscript from "@/components/training/feedback/annotated-transcript";
import PolishedPane from "@/components/training/feedback/polished-pane";
import SegmentedControl from "@/components/training/feedback/segmented-control";

const ID_BASE = "training-transcript";

/**
 * What was said and the cleaner version of it, toggled by a segmented
 * control. Both panes stay mounted so switching is instant and the
 * annotation selection survives a round trip to the rewrite.
 */
export default function TranscriptSection({
  words,
  corrections,
  polishedTranscript,
}: {
  words: TranscriptWord[];
  corrections: TrainingCorrection[];
  polishedTranscript: string;
}) {
  const [pane, setPane] = useState("original");

  return (
    <div className="space-y-3">
      <SegmentedControl
        options={[
          { id: "original", label: "What you said" },
          { id: "polished", label: "Cleaner version" },
        ]}
        value={pane}
        onChange={setPane}
        ariaLabel="Transcript version"
        idBase={ID_BASE}
      />
      <div className="bg-card border-border rounded-xl border p-5">
        <div
          role="tabpanel"
          id={`${ID_BASE}-panel-original`}
          aria-labelledby={`${ID_BASE}-tab-original`}
          hidden={pane !== "original"}
        >
          <AnnotatedTranscript words={words} corrections={corrections} />
        </div>
        <div
          role="tabpanel"
          id={`${ID_BASE}-panel-polished`}
          aria-labelledby={`${ID_BASE}-tab-polished`}
          hidden={pane !== "polished"}
        >
          <PolishedPane text={polishedTranscript} />
        </div>
      </div>
    </div>
  );
}
