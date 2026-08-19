/**
 * The retake pass, expressed as the edit decision itself rather than as prose
 * to be matched back afterwards.
 *
 * The model used to return a cleaned script, which then had to be aligned to
 * source words by text similarity. That step could not tell two attempts at one
 * line apart when both matched, so it picked the wrong occurrence, clipped
 * opening words, and dropped sentences the model had kept. Here the model
 * returns word indices, so there is nothing to align: the edit is what it said.
 *
 * The output is grouped by retake cluster on purpose. A cluster names the one
 * attempt that survives alongside the ones it deletes, so an edit that removes
 * every run at a line is not something the model can express, and anything it
 * does not put in a cluster is kept untouched.
 */

export const RETAKE_CLUSTER_PROMPT =
  "You are cutting the mistakes out of a talking-head video. You get the " +
  "speaker's transcript as numbered words, in recording order.\n\n" +
  "The speaker says a line, fumbles it, stops, and says it again, sometimes " +
  "three or four times, until they get it right. Every attempt is in the " +
  "transcript, one after another. A RETAKE CLUSTER is one such stretch: two or " +
  "more attempts at the same line, back to back.\n\n" +
  "Find every retake cluster. For each one, say which single attempt survives " +
  "and which spans are deleted.\n\n" +
  "PUNCTUATION DOES NOT MARK THE ATTEMPTS. The transcriber writes a false start " +
  "and its correction as one sentence, because the speaker does not pause for a " +
  "full stop before restarting. Read the words, not the periods. For example:\n" +
  '  "Navigate to practice celpip.ca and go to practice celpip.ca and click ' +
  'words in the navigation bar."\n' +
  'is one transcribed sentence holding two attempts: the abandoned "Navigate ' +
  'to practice celpip.ca and go", then the real line "to practice celpip.ca ' +
  'and click words in the navigation bar." Split it and delete the first.\n\n' +
  "Choosing the survivor:\n" +
  "- It is the LAST attempt that is a complete, fluent sentence. Later beats " +
  "earlier every time, as long as the later one is complete.\n" +
  "- Only fall back to an earlier attempt when NO later attempt finishes the " +
  "thought: the speaker trailed off, stuttered through it, or never got to the " +
  "end.\n" +
  "- Exactly one attempt survives per cluster. Never delete them all: the idea " +
  "has to be said once in the finished video.\n" +
  "- The kept span starts at the first word of that attempt and ends at its " +
  "last. Do not lop the opening word off it, and do not let it start on the " +
  "tail of the attempt before.\n\n" +
  "What counts as one cluster:\n" +
  '- Reworded attempts count. "Choose the right meaning for that word and the ' +
  'translation will be added automatically" and "And the translation as well ' +
  'as the English meaning will be added automatically" are two attempts at one ' +
  "line, not two facts.\n" +
  "- A half-finished restart counts as an attempt, so it is one of the spans " +
  "you delete.\n\n" +
  "Anything you do not put in a cluster is kept untouched, so do not build a " +
  "cluster around a line the speaker only said once.\n\n" +
  "For each cluster, first WRITE OUT every attempt you found, quoting the " +
  "speaker's words and its index range, and say whether it finishes the " +
  "thought. Only then pick the survivor. Work left to right through the " +
  "transcript and do not skip a cluster.\n\n" +
  "Return ONLY JSON:\n" +
  '{"clusters": [{\n' +
  '  "line": "<the line in a few words>",\n' +
  '  "attempts": [{"span": [<first>, <last>], "text": "<the words>", ' +
  '"complete": true|false}, ...],\n' +
  '  "keep": [<firstIndex>, <lastIndex>],\n' +
  '  "drop": [[<firstIndex>, <lastIndex>], ...]\n' +
  "}, ...]}\n" +
  "Every index range must be contiguous, non-overlapping, and inside the " +
  "cluster. The kept span must be one unbroken run of the recording, and it " +
  "must equal one of the attempts you listed.";

/** How the transcript is handed to the model. */
export function numberedTranscript(words: { text: string }[]): string {
  return words.map(({ text }, index) => `${index}:${text}`).join(" ");
}

/**
 * No edit removes this much of a recording. A response that says otherwise has
 * misread the indices, and applying it would delete the video.
 */
const MOST_THAT_MAY_GO = 0.85;

function isSpan(value: unknown, wordCount: number): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1]) &&
    value[0] >= 0 &&
    value[1] < wordCount &&
    value[0] <= value[1]
  );
}

function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

/**
 * The deletions a response asks for, or null when it cannot be trusted.
 *
 * Fails closed rather than applying the sound part of a bad answer. A partial
 * edit reads to the creator as a successful one that happened to delete their
 * ending.
 */
export function retakeCutsFromResponse(
  text: string,
  wordCount: number,
): [number, number][] | null {
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json[0]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const clusters = (parsed as { clusters?: unknown }).clusters;
  if (!Array.isArray(clusters)) return null;

  const keeps: [number, number][] = [];
  const drops: [number, number][] = [];
  for (const entry of clusters) {
    if (!entry || typeof entry !== "object") return null;
    const { keep, drop } = entry as { keep?: unknown; drop?: unknown };
    if (!isSpan(keep, wordCount)) return null;
    if (!Array.isArray(drop)) return null;
    const cluster: [number, number][] = [];
    for (const span of drop) {
      if (!isSpan(span, wordCount)) return null;
      cluster.push(span);
    }
    // A cluster that deletes its own survivor is self-contradictory, and one
    // whose deletions sit somewhere else in the recording has lost track of the
    // indices. Either way the response is not an edit of this transcript.
    if (cluster.some((span) => overlaps(span, keep))) return null;
    const extent = [keep, ...cluster];
    const from = Math.min(...extent.map(([start]) => start));
    const to = Math.max(...extent.map(([, end]) => end));
    if (to - from > wordCount) return null;
    keeps.push(keep);
    drops.push(...cluster);
  }

  drops.sort((a, b) => a[0] - b[0]);
  for (let index = 1; index < drops.length; index++) {
    if (overlaps(drops[index - 1], drops[index])) return null;
  }
  // Nothing one cluster keeps may be deleted by another.
  if (drops.some((span) => keeps.some((kept) => overlaps(span, kept)))) {
    return null;
  }

  const removed = drops.reduce(
    (sum, [start, end]) => sum + (end - start + 1),
    0,
  );
  if (removed > wordCount * MOST_THAT_MAY_GO) return null;
  return drops;
}
