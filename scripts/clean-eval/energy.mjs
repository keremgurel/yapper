import fs from "node:fs/promises";

/**
 * What the audio says about each word.
 *
 * Reads 16 kHz mono signed 16 bit PCM and measures dBFS over every word's
 * window and over every meaningful gap. A word sitting at room tone was
 * invented by the transcriber; a gap holding speech level energy is a stretch
 * the transcriber did not write down. Both create phantom retakes.
 *
 * Usage: node energy.mjs <fixture.json> <take.pcm>   (rewrites the fixture)
 */
const SAMPLE_RATE = 16_000;
const PAUSE_SECONDS = 0.75;
const FRAME_SECONDS = 0.2;
const QUIET_BELOW_MEDIAN_DB = 18;
const SPEECH_BELOW_MEDIAN_DB = 10;

export function measureEnergy(words, pcm) {
  const samples = new Int16Array(
    pcm.buffer,
    pcm.byteOffset,
    Math.floor(pcm.byteLength / 2),
  );
  const dbfs = (fromSec, toSec) => {
    const from = Math.max(0, Math.floor(fromSec * SAMPLE_RATE));
    const to = Math.min(samples.length, Math.ceil(toSec * SAMPLE_RATE));
    if (to <= from) return -120;
    let sum = 0;
    for (let i = from; i < to; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / (to - from)) / 32768;
    return rms > 0 ? 20 * Math.log10(rms) : -120;
  };

  const wordDb = words.map((w) => dbfs(w.start, w.end));
  const sorted = [...wordDb].sort((a, b) => a - b);
  const speechMedian = sorted[Math.floor(sorted.length / 2)];

  const quiet = wordDb.map((db) => db < speechMedian - QUIET_BELOW_MEDIAN_DB);
  const unheardSpeechBefore = words.map((w, i) => {
    if (i === 0) return false;
    const gapStart = words[i - 1].end;
    if (w.start - gapStart < PAUSE_SECONDS) return false;
    let loud = 0;
    for (let t = gapStart; t + FRAME_SECONDS <= w.start; t += FRAME_SECONDS) {
      if (dbfs(t, t + FRAME_SECONDS) > speechMedian - SPEECH_BELOW_MEDIAN_DB) {
        loud++;
      }
    }
    return loud >= 3;
  });
  return {
    speechMedianDb: Number(speechMedian.toFixed(1)),
    wordDb: wordDb.map((v) => Number(v.toFixed(1))),
    quiet,
    unheardSpeechBefore,
  };
}

if (process.argv[1]?.endsWith("energy.mjs")) {
  const [fixturePath, pcmPath] = process.argv.slice(2);
  if (!fixturePath || !pcmPath) {
    throw new Error("Usage: energy.mjs <fixture.json> <take.pcm>");
  }
  const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  const energy = measureEnergy(fixture.words, await fs.readFile(pcmPath));
  fixture.energy = energy;
  await fs.writeFile(fixturePath, JSON.stringify(fixture));
  const quietCount = energy.quiet.filter(Boolean).length;
  const unheard = energy.unheardSpeechBefore.filter(Boolean).length;
  console.log(
    `speech median ${energy.speechMedianDb} dBFS, ${quietCount} quiet words, ` +
      `${unheard} gaps with unheard speech`,
  );
}
