import { it, expect } from "vitest";
import { loadLiveEnv } from "./live-env";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { directChecked } from "./direct-checked";
import { paletteFor } from "./scene-colors";
import type { DirectInput } from "./direct-input";
import { designMoments } from "./design-moments";
import type { DirectReply } from "./direct-reply";

it.skipIf(process.env.RUN_OVERLAY_EDITORIAL_DESIGN_EVAL !== "1")(
  "renders the actual reviewed editorial choices, without hand-written replacement scenes",
  async () => {
    loadLiveEnv();
    const out = process.env.OVERLAY_EVAL_OUTPUT!;
    const editorial = JSON.parse(
      await readFile(`${out}/editorial.json`, "utf8"),
    ) as {
      input: Omit<DirectInput, "words"> & {
        words: { text: string; start: number; end: number }[];
      };
      parsed: DirectReply;
    };
    const words = editorial.input.words;
    const moments = editorial.parsed.moments.map((moment, index) => {
      const transcript = words.map((w) => w.text).join(" ");
      const quoteStart = transcript.indexOf(moment.quote);
      let offset = 0;
      const offsets = words.map((w) => {
        const at = offset;
        offset += w.text.length + 1;
        return at;
      });
      const at = offsets.findIndex((start) => start === quoteStart);
      const last = offsets.findLastIndex(
        (start) => start < quoteStart + moment.quote.length,
      );
      expect(at).toBeGreaterThanOrEqual(0);
      const start = words[at].start!;
      const duration = words[last].end! - start;
      return {
        ...moment,
        id: `editorial-${index}`,
        sentence: moment.quote,
        start,
        duration,
        wordTimings: words.slice(at, last + 1).map((w) => ({
          text: w.text,
          at: Math.max(0, w.start - start),
          end: Math.min(duration, w.end - start),
        })),
        box: { widthPx: 400, heightPx: 240, aspect: 400 / 240 },
      };
    });
    const result = await designMoments({
      moments,
      instruction: editorial.input.instruction,
      model: "claude-opus-4.7",
      frameAspect: 9 / 16,
      frameHeightPx: 1080,
      brand: { palette: paletteFor([]), hasKit: false, logos: [], colors: [] },
    });
    await writeFile(
      `${out}/designed.json`,
      JSON.stringify({ moments, result }, null, 2),
    );
    expect(result.failed).toEqual([]);
  },
  250_000,
);

// Paid, opt-in evaluation against a local QA copy. Never mutates the project.
// Review editorial.json yourself: passing schema assertions is NOT design approval.
it.skipIf(process.env.RUN_OVERLAY_EDITORIAL_EVAL !== "1")(
  "evaluates editorial choices against the kept video, not discarded takes",
  async () => {
    loadLiveEnv();
    const out = process.env.OVERLAY_EVAL_OUTPUT!;
    const projectPath = process.env.OVERLAY_EVAL_PROJECT!;
    expect(out).toBeTruthy();
    expect(projectPath).toBeTruthy();
    const project = JSON.parse(await readFile(projectPath, "utf8")) as {
      clips: { mediaID: string; sourceStart: number; sourceEnd: number }[];
      transcript: {
        mediaID: string;
        start: number;
        end: number;
        text: string;
      }[];
    };
    let time = 0;
    const words = project.clips.flatMap((clip) => {
      const result = project.transcript
        .filter(
          (w) =>
            w.mediaID === clip.mediaID &&
            (w.start + w.end) / 2 >= clip.sourceStart &&
            (w.start + w.end) / 2 < clip.sourceEnd,
        )
        .map((w) => ({
          text: w.text,
          start: time + Math.max(0, w.start - clip.sourceStart),
          end: time + Math.min(clip.sourceEnd, w.end) - clip.sourceStart,
        }));
      time += clip.sourceEnd - clip.sourceStart;
      return result;
    });
    const input: DirectInput = {
      instruction:
        process.env.OVERLAY_EVAL_INSTRUCTION ??
        "Add overlays where they would improve the video. Be selective.",
      words,
      frameAspect: 9 / 16,
      speaker: [],
      placed: [],
      texts: [],
    };
    const brand = {
      palette: paletteFor([]),
      hasKit: false,
      colors: [],
      logos: [],
    };
    const parsed = await directChecked(input, brand, "claude-opus-4.7");
    await mkdir(out, { recursive: true });
    await writeFile(
      `${out}/editorial.json`,
      JSON.stringify({ input, parsed }, null, 2),
    );
    expect(parsed.moments.length).toBeLessThanOrEqual(5);
    for (const moment of parsed.moments) {
      expect(words.map((w) => w.text).join(" ")).toContain(moment.quote);
    }
  },
  120_000,
);
