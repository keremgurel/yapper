import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Turns a video edited in the Mac app into a test case: its original audio,
// the app's own transcript, and the stretches the finished edit kept.
//   node scripts/cut-testset/add-project.mjs <work folder> <Name.yapperproj> [take name]
// The finished edit is the answer key, so finish the edit by hand first.

const [work, project, given] = process.argv.slice(2);
if (!work || !project)
  throw new Error("Pass a work folder and a .yapperproj folder.");
const doc = JSON.parse(
  fs.readFileSync(path.join(project, "project.json"), "utf8"),
);
const name =
  given ??
  path
    .basename(project, ".yapperproj")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

/** Seconds of each source the edit kept. The take is the source it kept the most of. */
const keptBySource = new Map();
for (const clip of doc.clips ?? []) {
  keptBySource.set(
    clip.mediaID,
    (keptBySource.get(clip.mediaID) ?? 0) + clip.sourceEnd - clip.sourceStart,
  );
}
const take = (doc.media ?? [])
  .filter(
    (media) => (media.kind ?? "video") === "video" && media.hasAudio !== false,
  )
  .sort(
    (a, b) => (keptBySource.get(b.id) ?? 0) - (keptBySource.get(a.id) ?? 0),
  )[0];
if (!take) throw new Error("This project has no video with sound.");

/** The project stores a file URL; a moved library keeps the file under recordings/. */
function sourceFile(url) {
  const raw = typeof url === "string" ? url : (url?.relative ?? "");
  const direct = raw.startsWith("file://")
    ? decodeURIComponent(new URL(raw).pathname)
    : raw;
  const packaged = path.join(project, "recordings", path.basename(direct));
  return [direct, packaged].find(
    (candidate) => candidate && fs.existsSync(candidate),
  );
}
const source = sourceFile(take.url);
if (!source)
  throw new Error(
    `The recording for "${take.name}" is not on this Mac right now.`,
  );

for (const dir of ["audio", "fixtures"])
  fs.mkdirSync(path.join(work, dir), { recursive: true });
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-y",
  "-i",
  source,
  "-vn",
  "-ac",
  "1",
  "-c:a",
  "aac",
  "-b:a",
  "96k",
  path.join(work, "audio", `${name}.m4a`),
]);

const clips = (doc.clips ?? [])
  .filter((clip) => clip.mediaID === take.id)
  .map((clip) => [clip.sourceStart, clip.sourceEnd])
  .sort((a, b) => a[0] - b[0]);
const words = (doc.transcript ?? [])
  .filter((word) => word.mediaID === take.id)
  .map(({ text, start, end }) => ({ text, start, end }));
fs.writeFileSync(
  path.join(work, "fixtures", `${name}.project.json`),
  JSON.stringify({ words, clips, duration: take.duration }),
);

const real = path.join(work, "real-takes.txt");
const listed = fs.existsSync(real)
  ? fs.readFileSync(real, "utf8").split("\n").filter(Boolean)
  : [];
if (!listed.includes(name))
  fs.writeFileSync(real, [...listed, name].join("\n") + "\n");

const kept = clips.reduce((sum, [start, end]) => sum + end - start, 0);
console.log(
  `${name}: ${(take.duration / 60).toFixed(1)} min, ${words.length} words in the app's transcript, ${clips.length} kept stretches, ${Math.round(100 * (1 - kept / take.duration))}% cut`,
);
