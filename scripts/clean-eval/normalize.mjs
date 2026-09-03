/**
 * Two forgiving readers for the model's answer.
 *
 * The production validator refuses any answer with a contradiction in it. That
 * is the right default for an edit applied at full confidence, but most
 * contradictions seen in practice are a fencepost (an end index one past the
 * last word) or a drop that clips the edge of its own keep. Both have an
 * obvious safe reading: the word stays. These readers apply that reading and
 * report that they had to, so a run can be scored on the edit the creator
 * would have received rather than on whether the JSON was tidy.
 */

const MOST_THAT_MAY_GO = 0.85;
const LEAST_THAT_MAY_STAY = 0.1;

function parseJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/** Clamp a span into bounds, swapping a reversed pair. Null when hopeless. */
function tidySpan(span, wordCount, notes) {
  if (!Array.isArray(span) || span.length !== 2) return null;
  let [a, b] = span;
  if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
  if (a > b) {
    [a, b] = [b, a];
    notes.add("reversed span");
  }
  if (b >= wordCount) {
    if (b > wordCount) return null;
    b = wordCount - 1;
    notes.add("fencepost end");
  }
  if (a < 0) return null;
  return [a, b];
}

function merge(spans) {
  const sorted = [...spans].sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const span of sorted) {
    const last = out[out.length - 1];
    if (last && span[0] <= last[1] + 1) last[1] = Math.max(last[1], span[1]);
    else out.push([...span]);
  }
  return out;
}

function complement(spans, wordCount) {
  const out = [];
  let cursor = 0;
  for (const [a, b] of spans) {
    if (a > cursor) out.push([cursor, a - 1]);
    cursor = Math.max(cursor, b + 1);
  }
  if (cursor <= wordCount - 1) out.push([cursor, wordCount - 1]);
  return out;
}

function covered(spans) {
  return spans.reduce((sum, [a, b]) => sum + (b - a + 1), 0);
}

/**
 * Keep only contract: {"keep":[[first,last],...]}. Everything else goes.
 * Overlaps between keeps are harmless, so the only failure modes left are an
 * unreadable reply or an edit that keeps almost nothing.
 */
export function cutsFromKeepOnly(text, wordCount) {
  const parsed = parseJson(text);
  const raw = parsed?.keep;
  if (!Array.isArray(raw) || raw.length === 0)
    return { cuts: null, notes: ["no keep array"] };
  const notes = new Set();
  const spans = [];
  for (const span of raw) {
    const tidy = tidySpan(span, wordCount, notes);
    if (!tidy)
      return { cuts: null, notes: [`unusable span ${JSON.stringify(span)}`] };
    spans.push(tidy);
  }
  const keeps = merge(spans);
  const kept = covered(keeps);
  if (kept < wordCount * LEAST_THAT_MAY_STAY) {
    return { cuts: null, notes: [`keeps only ${kept} of ${wordCount} words`] };
  }
  return { cuts: complement(keeps, wordCount), notes: [...notes] };
}

/**
 * Blocks contract read leniently: keeps win every overlap, fenceposts are
 * clamped, and the 85% ceiling still applies.
 */
export function lenientBlockCuts(text, wordCount) {
  const parsed = parseJson(text);
  const blocks = parsed?.blocks;
  if (!Array.isArray(blocks)) return { cuts: null, notes: ["no blocks array"] };
  const notes = new Set();
  const keeps = [];
  const drops = [];
  for (const block of blocks) {
    for (const span of block?.keep ?? []) {
      const tidy = tidySpan(span, wordCount, notes);
      if (tidy) keeps.push(tidy);
      else notes.add("dropped unusable keep span");
    }
    for (const span of block?.drop ?? []) {
      const tidy = tidySpan(span, wordCount, notes);
      if (tidy) drops.push(tidy);
      else notes.add("dropped unusable drop span");
    }
  }
  const keepMerged = merge(keeps);
  let cuts = merge(drops);
  const before = covered(cuts);
  // Subtract every keep from every drop: the survivor wins the argument.
  for (const [ka, kb] of keepMerged) {
    cuts = cuts.flatMap(([a, b]) => {
      if (kb < a || ka > b) return [[a, b]];
      const pieces = [];
      if (a < ka) pieces.push([a, ka - 1]);
      if (b > kb) pieces.push([kb + 1, b]);
      return pieces;
    });
  }
  if (covered(cuts) !== before) notes.add("keep trimmed a drop");
  if (covered(cuts) > wordCount * MOST_THAT_MAY_GO) {
    return { cuts: null, notes: ["removes more than 85%"] };
  }
  return { cuts, notes: [...notes] };
}
