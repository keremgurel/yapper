"use client";

import { useState } from "react";
import {
  countWords,
  formatDuration,
  speakingSeconds,
  WPM_PACES,
  wordsForSeconds,
} from "@/lib/tools/wpm";

const muted = { color: "var(--sg-text-muted)" };

/** Words-per-minute calculator: paste a script to get its spoken length, or
 * plan how many words fit a target time. Pure client-side — the math lives in
 * lib/tools/wpm. */
export default function WpmCalculator() {
  const [text, setText] = useState("");
  const [wpm, setWpm] = useState<number>(130);
  const [targetMin, setTargetMin] = useState("1");

  const words = countWords(text);
  const seconds = speakingSeconds(words, wpm);
  const targetSeconds = Math.max(0, Number(targetMin) || 0) * 60;
  const wordsNeeded = wordsForSeconds(targetSeconds, wpm);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {/* Script → time */}
      <div className="sg-card p-6">
        <label
          htmlFor="wpm-script"
          className="sg-label"
          style={{ color: "var(--sg-label)" }}
        >
          Your script
        </label>
        <textarea
          id="wpm-script"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          placeholder="Paste your script or talking points here…"
          className="sg-sunken mt-2 w-full resize-y rounded-xl p-3 text-sm leading-6 outline-none"
          style={{ color: "var(--sg-text)" }}
        />

        <div className="mt-4">
          <p className="sg-label mb-2" style={{ color: "var(--sg-label)" }}>
            Speaking pace
          </p>
          <div className="flex flex-wrap gap-2">
            {WPM_PACES.map((p) => (
              <button
                key={p.wpm}
                type="button"
                onClick={() => setWpm(p.wpm)}
                className={wpm === p.wpm ? "sg-btn-accent" : "sg-btn-ghost"}
                title={p.hint}
              >
                {p.label} · {p.wpm} wpm
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <p className="sg-display text-5xl">{formatDuration(seconds)}</p>
            <p className="sg-label mt-1" style={{ color: "var(--sg-label)" }}>
              Spoken length
            </p>
          </div>
          <div>
            <p className="sg-display text-3xl">{words.toLocaleString()}</p>
            <p className="sg-label mt-1" style={{ color: "var(--sg-label)" }}>
              Words
            </p>
          </div>
        </div>
      </div>

      {/* Time → words (planning) */}
      <div className="sg-panel flex flex-col gap-4 p-6">
        <div>
          <p className="sg-display text-2xl">Planning to a length?</p>
          <p className="mt-2 text-sm leading-6" style={muted}>
            Enter a target time and get the word count to aim for at your chosen
            pace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="0.5"
            value={targetMin}
            onChange={(e) => setTargetMin(e.target.value)}
            className="sg-sunken w-24 rounded-xl p-3 text-lg outline-none"
            style={{ color: "var(--sg-text)" }}
            aria-label="Target minutes"
          />
          <span className="text-sm" style={muted}>
            minutes at {wpm} wpm
          </span>
        </div>
        <div className="sg-sunken rounded-xl p-4">
          <p className="sg-display text-4xl">{wordsNeeded.toLocaleString()}</p>
          <p className="sg-label mt-1" style={{ color: "var(--sg-label)" }}>
            Words to write
          </p>
        </div>
      </div>
    </div>
  );
}
