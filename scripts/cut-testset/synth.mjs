import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { planTake } from "./plan-take.mjs";
import { CONDITIONS, LONG_TAKE, TAKES } from "./takes.mjs";

// Builds the audio and the answer key for every take.
//   node scripts/cut-testset/synth.mjs <work folder> [take id ...]
// Writes audio/<take>.m4a, truth/<take>.json and fixtures/<take>.project.json,
// the layout scripts/asr-eval expects. Needs macOS `say` and ffmpeg.

const [work, ...only] = process.argv.slice(2);
if (!work) throw new Error("Pass a work folder.");
for (const dir of ["audio", "truth", "fixtures", "tmp"])
  fs.mkdirSync(path.join(work, dir), { recursive: true });

const run = (cmd, args) =>
  execFileSync(cmd, args, { stdio: ["ignore", "pipe", "ignore"] }).toString();
const seconds = (file) =>
  Number(
    run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      file,
    ]),
  );
const RATE = 48000;

function silence(file, duration) {
  run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=${RATE}:cl=mono`,
    "-t",
    duration.toFixed(3),
    "-c:a",
    "pcm_s16le",
    file,
  ]);
}

/** One spoken segment as a mono WAV, trimmed of the silence `say` leaves at both ends. */
function speak(file, voice, rate, text) {
  const raw = `${file}.aiff`;
  run("say", ["-v", voice, "-r", String(rate), "-o", raw, text]);
  run("ffmpeg", [
    "-y",
    "-i",
    raw,
    "-ac",
    "1",
    "-ar",
    String(RATE),
    "-af",
    "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse",
    "-c:a",
    "pcm_s16le",
    file,
  ]);
  fs.rmSync(raw);
}

function degrade(input, output, filter) {
  const encode = ["-ac", "1", "-c:a", "aac", "-b:a", "96k", output];
  if (filter === "noise") {
    // Room tone under the voice and a short echo, as in an untreated room.
    run("ffmpeg", [
      "-y",
      "-i",
      input,
      "-f",
      "lavfi",
      "-i",
      `anoisesrc=color=pink:amplitude=0.035:r=${RATE}`,
      "-filter_complex",
      "[0]aecho=0.8:0.5:45:0.3[v];[v][1]amix=inputs=2:duration=first:normalize=0",
      ...encode,
    ]);
  } else {
    run("ffmpeg", [
      "-y",
      "-i",
      input,
      ...(filter ? ["-af", filter] : []),
      ...encode,
    ]);
  }
}

/** A long take is several scripts in a row. Lines are renumbered so each stays its own line. */
const planOf = (take) =>
  take.parts
    ? take.parts.flatMap((part, index) =>
        planTake(part.script, part.seed).map((segment) => ({
          ...segment,
          line: index * 100 + segment.line,
        })),
      )
    : planTake(take.script, take.seed);

for (const take of [...TAKES, LONG_TAKE]) {
  if (only.length > 0 ? !only.includes(take.id) : take === LONG_TAKE) continue;
  const condition = CONDITIONS[take.condition];
  const tmp = path.join(work, "tmp", take.id);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });

  let clock = 0;
  const parts = [];
  const segments = planOf(take).map((segment, index) => {
    const gap = path.join(tmp, `${index}-gap.wav`);
    const voice = path.join(tmp, `${index}-voice.wav`);
    silence(gap, segment.gapBeforeS);
    speak(voice, take.voice, condition.rate, segment.text);
    const start = clock + segment.gapBeforeS;
    const end = start + seconds(voice);
    clock = end;
    parts.push(gap, voice);
    return {
      ...segment,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
    };
  });
  const tail = path.join(tmp, "tail.wav");
  silence(tail, 0.6);
  parts.push(tail);

  const list = path.join(tmp, "list.txt");
  fs.writeFileSync(list, parts.map((file) => `file '${file}'`).join("\n"));
  const joined = path.join(tmp, "joined.wav");
  run("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    list,
    "-c:a",
    "pcm_s16le",
    joined,
  ]);
  degrade(joined, path.join(work, "audio", `${take.id}.m4a`), condition.filter);

  const duration = Number((clock + 0.6).toFixed(3));
  const clips = segments.filter((s) => s.keep).map((s) => [s.start, s.end]);
  fs.writeFileSync(
    path.join(work, "truth", `${take.id}.json`),
    JSON.stringify({ ...take, duration, segments }, null, 1),
  );
  fs.writeFileSync(
    path.join(work, "fixtures", `${take.id}.project.json`),
    JSON.stringify({ words: [], clips, duration }),
  );
  fs.rmSync(tmp, { recursive: true, force: true });
  const kept = clips.reduce((sum, [a, b]) => sum + b - a, 0);
  console.log(
    `${take.id}: ${take.voice} (${take.accent}), ${condition.label}, ${duration.toFixed(0)} s, ${Math.round(100 * (1 - kept / duration))}% to cut`,
  );
}
