import { clamp, clampBlock, overlapScore, tokenize } from "./text";
import type { BrainBlockSource } from "./types";

/**
 * Turn one section into the part of it this task should read.
 *
 * This is the second half of the trick that lets the brain hold more than a
 * prompt can. The router decides which sections matter; this decides how much
 * of each one to spend budget on, and for the big kinds that means picking
 * rows and slices rather than sending the thing whole. A 200 row keyword export
 * contributes its columns and the dozen rows the task is about. A pasted
 * research document contributes the two chunks that mention what is being
 * written.
 *
 * Selection inside a block is deliberately deterministic. The model already
 * chose the block; paying for a second model call to choose rows inside it
 * would double the latency for a decision that word overlap gets right.
 */

const ITEM_CAP = 140;
const CELL_CAP = 60;
const HEADING_CAP = 60;

/** Rank by overlap, but keep the creator's order among equal scores, so an
 * unrelated task reads the top of the list rather than a shuffled sample. */
function rank<T>(entries: T[], score: (entry: T) => number): T[] {
  return entries
    .map((entry, index) => ({ entry, index, score: score(entry) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((scored) => scored.entry);
}

function joinWithin(lines: string[], maxChars: number): string {
  const kept: string[] = [];
  let used = 0;
  for (const line of lines) {
    if (!line) continue;
    const cost = line.length + (kept.length ? 1 : 0);
    if (used + cost > maxChars) break;
    kept.push(line);
    used += cost;
  }
  return kept.join("\n");
}

/**
 * Fill the room with lines, and say how many were left out.
 *
 * The count is part of the excerpt rather than an extra: a model shown eight of
 * forty lines with no note will reason as though it saw all forty. But content
 * still wins over bookkeeping, so the notice buys its space by dropping
 * rendered lines only while at least one survives, and is itself dropped when
 * the budget is too small to hold both.
 */
function fitWithNotice(
  lines: string[],
  total: number,
  noun: string,
  room: number,
  bullet = "",
): string {
  if (room <= 0) return "";
  const notice = (dropped: number) => `${bullet}(${dropped} more ${noun})`;

  let kept = joinWithin(lines, room).split("\n").filter(Boolean);
  if (kept.length >= total) return kept.join("\n");

  while (
    kept.length > 1 &&
    kept.join("\n").length + 1 + notice(total - kept.length).length > room
  ) {
    kept = kept.slice(0, -1);
  }

  const text = kept.join("\n");
  const tail = notice(total - kept.length);
  const cost = kept.length ? text.length + 1 + tail.length : tail.length;
  if (cost > room) return text;
  return kept.length ? `${text}\n${tail}` : tail;
}

function excerptList(
  block: BrainBlockSource,
  task: Set<string>,
  maxChars: number,
): string {
  const items = block.items
    .map((item) => clamp(item, ITEM_CAP))
    .filter(Boolean);
  if (!items.length) return "";
  const ordered = rank(items, (item) => overlapScore(task, item));
  return fitWithNotice(
    ordered.map((item) => `- ${item}`),
    items.length,
    "not shown",
    maxChars,
    "- ",
  );
}

function excerptTable(
  block: BrainBlockSource,
  task: Set<string>,
  maxChars: number,
): string {
  const table = block.rows;
  if (!table || !table.rows.length) return "";

  const header = table.columns.map((c) => clamp(c, CELL_CAP)).join(" | ");
  const rows = table.rows.map((row) =>
    row.map((cell) => clamp(cell, CELL_CAP)).join(" | "),
  );
  const ordered = rank(rows, (row) => overlapScore(task, row));

  // The header always survives: a row of values with no column names is a row
  // the model has to guess at.
  const body = fitWithNotice(
    ordered,
    rows.length,
    "rows not shown",
    maxChars - header.length - 1,
  );
  return body ? `${header}\n${body}` : header;
}

function excerptDoc(
  block: BrainBlockSource,
  task: Set<string>,
  maxChars: number,
): string {
  const chunks = block.chunks ?? [];
  if (!chunks.length) return clampBlock(block.body, maxChars);

  const ordered = rank(chunks, (chunk) =>
    overlapScore(task, `${chunk.heading} ${chunk.text}`),
  );
  // Back into document order once the relevant ones are chosen, so two adjacent
  // slices read as one passage rather than as two quotes out of sequence.
  const room = Math.max(0, maxChars);
  const picked: typeof ordered = [];
  let used = 0;
  for (const chunk of ordered) {
    const cost = chunk.text.length + chunk.heading.length + 2;
    if (used + cost > room && picked.length) break;
    picked.push(chunk);
    used += cost;
    if (used >= room) break;
  }
  picked.sort((a, b) => a.ord - b.ord);

  const lines = picked.map((chunk) =>
    chunk.heading
      ? `${clamp(chunk.heading, HEADING_CAP)}: ${chunk.text}`
      : chunk.text,
  );
  return clampBlock(lines.join("\n"), maxChars);
}

/**
 * The contents of a block, cut to fit. `task` may be empty, in which case every
 * kind falls back to reading from the top in the creator's own order.
 */
export function excerptBlock(
  block: BrainBlockSource,
  task: Set<string>,
  maxChars: number,
): string {
  if (maxChars <= 0) return "";
  switch (block.kind) {
    case "list":
      return excerptList(block, task, maxChars);
    case "table":
      return excerptTable(block, task, maxChars);
    case "doc":
      return excerptDoc(block, task, maxChars);
    default: {
      // A note can still carry collected lines; a creator who typed a list into
      // a prose block should not lose it to the kind they picked first.
      const body = clampBlock(block.body, maxChars);
      const room = maxChars - body.length - 1;
      const items = room > 0 ? excerptList(block, task, room) : "";
      return [body, items].filter(Boolean).join("\n");
    }
  }
}

/** How the block is described when only its digest is affordable. Used by the
 * index, and as the fallback when the creator never wrote one. */
export function describeBlock(block: BrainBlockSource): string {
  switch (block.kind) {
    case "table": {
      const rows = block.rows?.rows.length ?? 0;
      const columns = block.rows?.columns.length ?? 0;
      return `table, ${rows} row${rows === 1 ? "" : "s"}, ${columns} column${columns === 1 ? "" : "s"}`;
    }
    case "list":
      return `list, ${block.items.length} line${block.items.length === 1 ? "" : "s"}`;
    case "doc": {
      const chunks = block.chunks?.length ?? 0;
      return chunks ? `document, ${chunks} sections` : "document";
    }
    default:
      return "note";
  }
}

export { tokenize };
