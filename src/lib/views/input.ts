import { CONTENT_FORMATS } from "@/lib/content/formats";
import { ALL_COLUMN_KEYS } from "@/lib/content/columns";
import type { LibraryViewInput } from "@/lib/db/library-views";
import {
  contentStatuses,
  libraryGroupings,
  libraryViewKinds,
  type LibraryGrouping,
  type LibraryViewKind,
} from "@/lib/db/schema";

const NAME_MAX = 60;
const LIST_MAX = 40;

const FORMAT_IDS = new Set(CONTENT_FORMATS.map((f) => f.id));
const STATUS_IDS = new Set<string>(contentStatuses);
const COLUMN_IDS = new Set<string>(ALL_COLUMN_KEYS);

const isKind = (v: unknown): v is LibraryViewKind =>
  typeof v === "string" && (libraryViewKinds as readonly string[]).includes(v);

const isGrouping = (v: unknown): v is LibraryGrouping =>
  typeof v === "string" && (libraryGroupings as readonly string[]).includes(v);

/** Keep only ids from a known vocabulary. A filter naming something this app
 * does not have would silently match nothing, which reads as "your view broke"
 * rather than "that value is gone". */
function ids(value: unknown, allowed?: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .filter((v) => !allowed || allowed.has(v))
    .filter((v, i, all) => all.indexOf(v) === i)
    .slice(0, LIST_MAX);
}

/**
 * Parse a client-supplied view.
 *
 * `pillarId` is deliberately not validated against the creator's pillars here:
 * a filter is not a link, it never renders a name it did not already have, and
 * a stale id simply matches nothing. Ownership still matters for writes, which
 * is why every view query is scoped to the caller.
 */
export function parseViewInput(
  body: Record<string, unknown>,
): LibraryViewInput | null {
  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, NAME_MAX) : "";
  if (!name) return null;

  const rawFilters =
    body.filters && typeof body.filters === "object"
      ? (body.filters as Record<string, unknown>)
      : {};

  const filters: Record<string, string[]> = {};
  const status = ids(rawFilters.status, STATUS_IDS);
  if (status.length) filters.status = status;
  const formats = ids(rawFilters.formats, FORMAT_IDS);
  if (formats.length) filters.formats = formats;
  const pillarId = ids(rawFilters.pillarId);
  if (pillarId.length) filters.pillarId = pillarId;

  return {
    name,
    kind: isKind(body.kind) ? body.kind : "table",
    groupBy: isGrouping(body.groupBy) ? body.groupBy : null,
    filters,
    columns: ids(body.columns, COLUMN_IDS),
  };
}
