"use client";

import type { TranscriptWord } from "@/lib/training-feedback/types";
import { formatClock } from "@/components/training/feedback/format-metric";
import { buildSpeechTimeline } from "@/components/training/feedback/speech-timeline-model";
import { useInView } from "@/components/training/feedback/use-in-view";
import styles from "@/components/training/feedback/report.module.css";

const percent = (fraction: number) => `${fraction * 100}%`;

/**
 * The recording drawn as a line: bars where you were speaking, gaps where you
 * paused, a dot for each filler. It shows at a glance where the hesitations
 * were, which a count alone cannot.
 */
export default function SpeechTimeline({ words }: { words: TranscriptWord[] }) {
  const { ref, inView } = useInView<HTMLElement>();
  const model = buildSpeechTimeline(words);
  if (!model) return null;
  const mid = model.pauses.filter((pause) => pause.midSentence).length;
  const between = model.pauses.length - mid;
  return (
    <figure ref={ref} className={styles.timeline} data-in-view={inView}>
      <div
        className={styles.track}
        role="img"
        aria-label={`Your ${formatClock(model.durationSec)} recording: ${model.fillers.length} filler words, ${mid} pauses in the middle of a sentence and ${between} between sentences.`}
      >
        <div className={styles.fillerRow}>
          {model.fillers.map((filler, index) => (
            <i
              key={index}
              style={{
                left: percent(filler.at),
                ["--at" as string]: filler.at,
              }}
              title={`“${filler.word}”`}
            />
          ))}
        </div>
        <div className={styles.speechRow}>
          {model.speech.map((span, index) => (
            <span
              key={`s${index}`}
              className={styles.speech}
              style={{ left: percent(span.left), width: percent(span.width) }}
            />
          ))}
          {model.pauses.map((pause, index) => (
            <span
              key={`p${index}`}
              className={styles.pause}
              data-mid={pause.midSentence}
              style={{ left: percent(pause.left), width: percent(pause.width) }}
              title={`${pause.seconds}s pause after “${pause.after}”`}
            />
          ))}
        </div>
        <div className={styles.axis}>
          <span>0:00</span>
          <span>{formatClock(model.durationSec)}</span>
        </div>
      </div>
      <figcaption className={styles.legend}>
        <span>
          <i className={styles.keySpeech} /> Speaking
        </span>
        <span>
          <i className={styles.keyFiller} /> Filler word
          <b>{model.fillers.length}</b>
        </span>
        <span>
          <i className={styles.keyMid} /> Pause mid-sentence
          <b>{mid}</b>
        </span>
        <span>
          <i className={styles.keyBetween} /> Pause between sentences
          <b>{between}</b>
        </span>
      </figcaption>
    </figure>
  );
}
