import type { BrainBlockInput } from "@/lib/db/project-brain";
import {
  brainBlockKinds,
  brainBlockUsages,
  type BrainBlockKind,
  type BrainBlockUsage,
  type BrainTable,
} from "@/lib/db/schema";

// Generous enough to hold a creator thinking properly, bounded so a client
// cannot stuff megabytes into a row. The compiler truncates again, much harder,
// on the way into a prompt.
const TITLE_MAX = 80;
const DIGEST_MAX = 200;
const BODY_MAX = 200_000;
const ITEM_MAX = 400;
const ITEMS_MAX = 2_000;
const TAG_MAX = 32;
const TAGS_MAX = 8;
const SOURCE_MAX = 120;
const URL_MAX = 500;
const COLUMNS_MAX = 24;
const CELL_MAX = 300;
const ROWS_MAX = 5_000;

const isKind = (v: unknown): v is BrainBlockKind =>
  typeof v === "string" && (brainBlockKinds as readonly string[]).includes(v);

const isUsage = (v: unknown): v is BrainBlockUsage =>
  typeof v === "string" && (brainBlockUsages as readonly string[]).includes(v);

function parseStrings(value: unknown, itemMax: number, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, itemMax))
    .filter(Boolean)
    .slice(0, max);
}

/**
 * An imported grid, made safe.
 *
 * Rows are padded and truncated to the column count rather than kept ragged,
 * because everything downstream (the excerpt renderer, the table editor, the
 * character count) assumes a row's nth cell belongs to the nth column, and a
 * short row from a messy export would otherwise shift a whole line's meaning.
 */
function parseTable(value: unknown): BrainTable | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const columns = parseStrings(raw.columns, CELL_MAX, COLUMNS_MAX);
  if (!columns.length) return null;
  if (!Array.isArray(raw.rows)) return { columns, rows: [] };

  const rows = raw.rows
    .filter((row): row is unknown[] => Array.isArray(row))
    .slice(0, ROWS_MAX)
    .map((row) =>
      columns.map((_, index) => {
        const cell = row[index];
        return typeof cell === "string" ? cell.trim().slice(0, CELL_MAX) : "";
      }),
    )
    .filter((row) => row.some(Boolean));

  return { columns, rows };
}

/**
 * A client payload turned into a safe block.
 *
 * Absent keys stay absent rather than becoming empty strings: that is what lets
 * a page save one field at a time without blanking the rest of the block.
 */
export function parseBrainBlockInput(
  body: Record<string, unknown>,
): Partial<BrainBlockInput> {
  const input: Partial<BrainBlockInput> = {};

  if (typeof body.title === "string") {
    input.title = body.title.trim().slice(0, TITLE_MAX);
  }
  if (isKind(body.kind)) input.kind = body.kind;
  if (isUsage(body.usage)) input.usage = body.usage;
  if (typeof body.digest === "string") {
    input.digest = body.digest.trim().slice(0, DIGEST_MAX);
  }
  if (typeof body.body === "string") input.body = body.body.slice(0, BODY_MAX);
  if (Array.isArray(body.items)) {
    input.items = parseStrings(body.items, ITEM_MAX, ITEMS_MAX);
  }
  if (body.rows !== undefined) input.rows = parseTable(body.rows);
  if (Array.isArray(body.tags)) {
    input.tags = parseStrings(body.tags, TAG_MAX, TAGS_MAX).map((tag) =>
      tag.toLowerCase(),
    );
  }
  if (typeof body.sourceLabel === "string") {
    input.sourceLabel = body.sourceLabel.trim().slice(0, SOURCE_MAX);
  }
  if (typeof body.sourceUrl === "string") {
    input.sourceUrl = body.sourceUrl.trim().slice(0, URL_MAX);
  }

  // The old boolean, still accepted so an older client (or a queued autosave
  // from a tab open across the deploy) keeps working.
  if (input.usage === undefined && typeof body.inContext === "boolean") {
    input.usage = body.inContext ? "auto" : "private";
  }

  return input;
}

/** A block being created needs a title; everything else can come later. */
export function parseNewBrainBlock(
  body: Record<string, unknown>,
): BrainBlockInput | null {
  const input = parseBrainBlockInput(body);
  if (!input.title) return null;
  return { ...input, title: input.title };
}

/** An explicit order from the client, as a list of ids. */
export function parseBlockOrder(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value
    .filter((id): id is string => typeof id === "string")
    .slice(0, 200);
  return ids.length ? ids : null;
}
