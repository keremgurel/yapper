import fs from "node:fs/promises";

/**
 * A scored take: the words the model sees plus the spans a human kept.
 *
 * `keptSpans` are inclusive word index ranges. Everything outside them is the
 * expected deletion. Optional `energy` carries per word dBFS and per gap
 * unheard speech flags produced by energy.mjs.
 */
export async function loadFixture(path) {
  const raw = JSON.parse(await fs.readFile(path, "utf8"));
  if (!Array.isArray(raw.words) || !Array.isArray(raw.keptSpans)) {
    throw new Error(`fixture ${path} needs words[] and keptSpans[]`);
  }
  const expectedKeep = new Set(
    raw.keptSpans.flatMap(([start, end]) =>
      Array.from({ length: end - start + 1 }, (_, offset) => start + offset),
    ),
  );
  const expectedDrop = new Set(
    raw.words.map((_, index) => index).filter((i) => !expectedKeep.has(i)),
  );
  return {
    name: raw.source ?? path,
    words: raw.words,
    expectedKeep,
    expectedDrop,
    energy: raw.energy ?? null,
  };
}
