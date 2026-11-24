import { MONOLOGUES } from "./monologues.mjs";

/**
 * Turns a clean script into what a real recording session sounds like: lines
 * said twice, false starts, a stumble and an apology, a reworded retake, a
 * second attempt that is abandoned. Every piece is labelled, so the correct
 * cut is known exactly instead of being judged by ear.
 */

const ASIDES = [
  "Okay, again.",
  "Sorry, let me redo that.",
  "One more time.",
  "Hold on.",
  "Wait, no.",
];
const KEEPERS = ["No, that was fine.", "Actually that one was good."];

/** A small deterministic generator, so a take is the same every time it is built. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const firstWords = (text, count) =>
  text.replace(/[.,]/g, "").split(" ").slice(0, count).join(" ");

/** One line's worth of segments for a pattern. `keep` marks what belongs in the finished video. */
function segmentsFor(pattern, line, pick) {
  const final = { text: line.text, keep: true, kind: "final", pattern };
  const drop = (text, kind) => ({ text, keep: false, kind, pattern });
  const words = line.text.split(" ").length;
  switch (pattern) {
    case "repeat2":
      return [drop(line.text, "earlier-take"), final];
    case "repeat3":
      return [
        drop(line.text, "earlier-take"),
        drop(line.text, "earlier-take"),
        final,
      ];
    case "false-start":
      return [
        drop(firstWords(line.text, 2 + Math.floor(pick() * 3)), "false-start"),
        final,
      ];
    case "stumble":
      return [
        drop(
          `${firstWords(line.text, Math.max(3, Math.round(words * 0.6)))}, uh`,
          "stumble",
        ),
        drop(ASIDES[Math.floor(pick() * ASIDES.length)], "aside"),
        final,
      ];
    case "reworded":
      return [drop(line.alt, "earlier-wording"), final];
    case "abandoned-after":
      return [
        final,
        drop(firstWords(line.text, 3), "abandoned-attempt"),
        drop(KEEPERS[Math.floor(pick() * KEEPERS.length)], "aside"),
      ];
    default:
      return [final];
  }
}

/**
 * The segments of one take, in order, with the pause before each. Patterns are
 * dealt out so every take has the same mix and only their order changes.
 */
export function planTake(script, seed) {
  const pick = seeded(seed);
  const lines = MONOLOGUES[script];
  const free = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => !line.trap);
  const reworded = free
    .filter(({ line }) => line.alt)
    .sort(() => pick() - 0.5)[0].index;
  const rest = free
    .filter(({ index }) => index !== reworded)
    .sort(() => pick() - 0.5);
  const deal = [
    "repeat2",
    "repeat3",
    "false-start",
    "stumble",
    "abandoned-after",
    "clean",
  ];
  const patternOf = new Map([
    [reworded, "reworded"],
    ...rest.map(({ index }, i) => [index, deal[i] ?? "clean"]),
  ]);
  const deadAirBefore = 2 + Math.floor(pick() * (lines.length - 3));

  return lines.flatMap((line, index) => {
    const pattern = line.trap ? "emphasis" : patternOf.get(index);
    return segmentsFor(pattern, line, pick).map((segment, part) => ({
      ...segment,
      line: index,
      // A breath between lines, a longer beat before trying again, and one long silence per take.
      gapBeforeS:
        part > 0
          ? 0.9 + pick() * 1.4
          : index === deadAirBefore
            ? 4.5 + pick() * 2.5
            : index === 0
              ? 0.4
              : 0.45 + pick() * 0.5,
    }));
  });
}
