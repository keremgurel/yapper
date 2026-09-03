/**
 * The numbered transcript with audio markers.
 *
 * Mirrors production `numberedTranscript` (pause markers at 0.75 s) and adds
 * two markers the production route does not have yet: `[quiet]` before a word
 * whose window is near silence, and `unheard-speech` inside a pause marker
 * when the gap holds speech the transcriber dropped.
 */
export function numberedTranscriptWithEnergy(words, energy) {
  const parts = [];
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    if (index > 0) {
      const previous = words[index - 1];
      const pause = word.start - previous.end;
      if (pause >= 0.75) {
        const flag = energy.unheardSpeechBefore[index] ? " unheard-speech" : "";
        parts.push(`[pause=${pause.toFixed(1)}s${flag}]`);
      }
    }
    if (energy.quiet[index]) parts.push("[quiet]");
    parts.push(`${index}:${word.text}`);
  }
  return parts.join(" ");
}

export const ENERGY_LEGEND =
  "\n\nAudio markers: [quiet] before a word means the recording is near " +
  "silence at that word, so the transcriber most likely invented it; treat " +
  "such a word as unreliable evidence of a retake rather than as speech. A " +
  "pause marker with unheard-speech means the speaker was talking there but " +
  "the transcriber wrote nothing; an attempt may begin or end inside it.";
