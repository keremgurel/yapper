"use client";

import type { PronunciationReport } from "@/lib/pronunciation/types";
import RingMeter from "@/components/training/feedback/ring-meter";
import UnclearWords from "@/components/training/feedback/unclear-words";
import { useInView } from "@/components/training/feedback/use-in-view";
import styles from "@/components/training/feedback/pronunciation.module.css";

/** Above this share of flat words, the voice is worth a note of its own. */
const FLAT_SHARE = 35;

function pitchNote(report: PronunciationReport): string | null {
  if (report.prosody === null) return null;
  if (report.monotoneShare >= FLAT_SHARE)
    return `Your pitch stayed flat on about ${report.monotoneShare}% of your words. Pick the one word in each sentence that matters most and lift your voice on it.`;
  if (report.prosody >= 80)
    return "Your voice moved with your meaning. Stress and pitch landed where a listener expects them.";
  return "Your rhythm was uneven in places. Slow down on the words that carry the point and let the small words go by quickly.";
}

/**
 * How the rep sounded: how clear the sounds were, how smoothly the words ran
 * together, and how much the voice moved. These come from the audio itself,
 * so they are the part of feedback a transcript cannot give.
 */
export default function PronunciationSection({
  report,
}: {
  report: PronunciationReport;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const note = pitchNote(report);
  return (
    <div ref={ref} className={styles.section} data-in-view={inView}>
      <div className={styles.rings}>
        <RingMeter
          value={report.accuracy}
          label="Clear sounds"
          hint="How close each sound was to a clear, standard one."
          active={inView}
        />
        <RingMeter
          value={report.fluency}
          label="Smoothness"
          hint="Words running together without stalls inside a phrase."
          active={inView}
          delay={140}
        />
        {report.prosody !== null && (
          <RingMeter
            value={report.prosody}
            label="Intonation"
            hint="Stress, rhythm and how much your pitch moved."
            active={inView}
            delay={280}
          />
        )}
      </div>
      {note && <p className={styles.note}>{note}</p>}
      {report.words.length > 0 ? (
        <UnclearWords words={report.words} />
      ) : (
        <p className={styles.note}>
          Every word came through clearly. There is nothing to drill here.
        </p>
      )}
      <p className={styles.basis}>
        Measured from the first {report.assessedSeconds} seconds of your
        recording, against standard American English. An accent is not an error:
        these scores are about how easily a listener can follow you.
      </p>
    </div>
  );
}
