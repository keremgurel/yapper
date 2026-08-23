import type { BrainBlockKind, BrainTable } from "@/lib/db/schema";

/**
 * Working out what a creator just pasted, without asking a model.
 *
 * This is what makes "import whatever you have" affordable. A 5000 row keyword
 * export is parsed here, in full, for free; only its column names and twenty of
 * its rows are ever sent anywhere. The model's job is to name the thing and say
 * when it matters, not to retype it.
 *
 * Everything here is pure and deliberately conservative. Guessing that prose is
 * a table produces a section that reads as garbage in every future prompt, so
 * each shape has to earn the call.
 */

/** Delimiters worth trying, in the order a real export is likely to use. */
const DELIMITERS = ["\t", ",", ";", "|"] as const;

const BULLET = /^\s*(?:[-*•·–]|\d{1,3}[.)])\s+\S/;

/** Below this a paste is a note the creator will read on the page; above it, it
 * is a document nobody wants rendered in a textarea. */
const DOC_THRESHOLD = 1_500;

const MAX_SAMPLE_ROWS = 20;
const MAX_SAMPLE_CHARS = 2_000;

export interface DetectedPaste {
  kind: BrainBlockKind;
  body: string;
  items: string[];
  rows: BrainTable | null;
  /** The small piece of it the naming pass sees. Never the whole paste. */
  sample: string;
  /** What the paste actually holds, for the preview to state honestly. */
  size: { rows?: number; items?: number; chars: number };
}

/**
 * One line of delimited text, respecting quotes.
 *
 * Hand-rolled rather than pulled in, because the only dialect that matters here
 * is "whatever a spreadsheet exported": doubled quotes to escape a quote, and
 * delimiters inside quotes taken literally.
 */
export function splitDelimited(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let at = 0; at < line.length; at += 1) {
    const char = line[at];
    if (quoted) {
      if (char !== '"') {
        cell += char;
      } else if (line[at + 1] === '"') {
        cell += '"';
        at += 1;
      } else {
        quoted = false;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      cells.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

interface DelimiterFit {
  delimiter: string;
  columns: number;
  agreement: number;
}

function fitDelimiter(lines: string[], delimiter: string): DelimiterFit | null {
  const counts = lines.map((line) => splitDelimited(line, delimiter).length);
  const columns = counts[0];
  if (columns < 2) return null;
  const agreeing = counts.filter((count) => count === columns).length;
  return { delimiter, columns, agreement: agreeing / counts.length };
}

/** Sentence-shaped cells mean this was prose that happened to have commas in
 * it. A real cell is a value; it does not end in a full stop and it is not a
 * paragraph. Both thresholds are loose enough that a table of short phrases
 * still reads as a table, and the preview lets the creator change the kind
 * anyway if a genuinely sentence-shaped grid trips this. */
function readsAsProse(rows: string[][]): boolean {
  const cells = rows.flat().filter(Boolean);
  if (!cells.length) return true;
  const sentences = cells.filter((cell) => /[.!?]$/.test(cell)).length;
  const averageLength =
    cells.reduce((total, cell) => total + cell.length, 0) / cells.length;
  return sentences / cells.length > 0.2 || averageLength > 40;
}

/**
 * Is this a grid? Only if a single delimiter gives the same column count on
 * almost every line, and the cells it produces look like values rather than
 * sentences. Three lines of prose with one comma each agree perfectly on two
 * columns, so agreement alone is not enough.
 */
function asTable(lines: string[]): BrainTable | null {
  if (lines.length < 3) return null;

  const best = DELIMITERS.map((delimiter) => fitDelimiter(lines, delimiter))
    .filter((fit): fit is DelimiterFit => fit !== null)
    .sort((a, b) => b.agreement - a.agreement || b.columns - a.columns)[0];
  if (!best || best.agreement < 0.8) return null;

  const rows = lines
    .map((line) => splitDelimited(line, best.delimiter))
    .filter((cells) => cells.length === best.columns);
  if (rows.length < 2 || readsAsProse(rows)) return null;

  // A first row of numbers is data, not headers, so the grid gets generic
  // column names rather than losing its first row to a header it never had.
  const [first, ...rest] = rows;
  const looksLikeHeader = first.every(
    (cell) => cell && !/^-?[\d.,%$€£\s]+$/.test(cell),
  );
  return looksLikeHeader
    ? { columns: first, rows: rest }
    : {
        columns: first.map((_, index) => `Column ${index + 1}`),
        rows,
      };
}

/** An array of flat objects, which is what an export from anything JSON shaped
 * looks like. The union of keys becomes the columns so a row missing a field
 * still lines up. */
function asJsonTable(text: string): BrainTable | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || !parsed.length) return null;
  const records = parsed.filter(
    (entry): entry is Record<string, unknown> =>
      !!entry && typeof entry === "object" && !Array.isArray(entry),
  );
  if (records.length !== parsed.length) return null;

  const columns: string[] = [];
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  if (!columns.length) return null;

  return {
    columns,
    rows: records.map((record) =>
      columns.map((column) => {
        const value = record[column];
        if (value === null || value === undefined) return "";
        return typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
      }),
    ),
  };
}

function asList(lines: string[]): string[] | null {
  if (lines.length < 3) return null;
  const bulleted = lines.filter((line) => BULLET.test(line)).length;
  if (bulleted / lines.length < 0.6) return null;
  return lines
    .map((line) => line.replace(/^\s*(?:[-*•·–]|\d{1,3}[.)])\s+/, "").trim())
    .filter(Boolean);
}

function sampleOf(detected: Omit<DetectedPaste, "sample">): string {
  if (detected.rows) {
    const head = [
      detected.rows.columns.join(" | "),
      ...detected.rows.rows
        .slice(0, MAX_SAMPLE_ROWS)
        .map((row) => row.join(" | ")),
    ].join("\n");
    const hidden = detected.rows.rows.length - MAX_SAMPLE_ROWS;
    return hidden > 0
      ? `${head}\n(and ${hidden} more rows)`.slice(0, MAX_SAMPLE_CHARS)
      : head.slice(0, MAX_SAMPLE_CHARS);
  }
  if (detected.items.length) {
    const head = detected.items
      .slice(0, MAX_SAMPLE_ROWS)
      .map((item) => `- ${item}`)
      .join("\n");
    const hidden = detected.items.length - MAX_SAMPLE_ROWS;
    return hidden > 0
      ? `${head}\n(and ${hidden} more lines)`.slice(0, MAX_SAMPLE_CHARS)
      : head.slice(0, MAX_SAMPLE_CHARS);
  }
  // The head and the tail: a research document's conclusion is usually at the
  // bottom, and a title that ignored it would be half a title.
  const body = detected.body;
  if (body.length <= MAX_SAMPLE_CHARS) return body;
  const half = Math.floor(MAX_SAMPLE_CHARS / 2);
  return `${body.slice(0, half)}\n…\n${body.slice(-half)}`;
}

/**
 * How the paste is described to the naming pass: the shape and the counts, in
 * one line. Kept here so the browser can compute it alongside the parse and
 * send it up, rather than shipping the whole import for the server to re-read.
 */
export function describePaste(detected: DetectedPaste): string {
  if (detected.rows) {
    return `a table of ${detected.rows.rows.length} rows and ${detected.rows.columns.length} columns`;
  }
  if (detected.items.length) {
    return `a list of ${detected.items.length} lines`;
  }
  const shape = detected.kind === "doc" ? "document" : "note";
  return `${detected.size.chars} characters of ${shape} text`;
}

/** Read a paste. Always returns something usable; the fallback is a note. */
export function detectPaste(input: string): DetectedPaste {
  const text = (input ?? "").replace(/\r\n?/g, "\n").trim();
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const table = asJsonTable(text) ?? asTable(lines);
  if (table) {
    const partial = {
      kind: "table" as const,
      body: "",
      items: [],
      rows: table,
      size: { rows: table.rows.length, chars: text.length },
    };
    return { ...partial, sample: sampleOf(partial) };
  }

  const items = asList(lines);
  if (items) {
    const partial = {
      kind: "list" as const,
      body: "",
      items,
      rows: null,
      size: { items: items.length, chars: text.length },
    };
    return { ...partial, sample: sampleOf(partial) };
  }

  const partial = {
    kind: (text.length > DOC_THRESHOLD ? "doc" : "note") as BrainBlockKind,
    body: text,
    items: [],
    rows: null,
    size: { chars: text.length },
  };
  return { ...partial, sample: sampleOf(partial) };
}
