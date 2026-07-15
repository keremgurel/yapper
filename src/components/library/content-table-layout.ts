/**
 * The one grid definition every part of the library table shares (header row,
 * data rows, skeleton rows) so their columns can never drift out of alignment.
 * Kept as literal strings in this file: Tailwind's scanner reads class names
 * from source text, so the arbitrary `grid-cols-[…]` must appear verbatim here.
 *
 * Columns: Title (fills) · Status · Updated · row actions. On phones the last
 * two collapse and the row falls back to two columns (title + status).
 */
export const TABLE_COLS = "sm:grid-cols-[1fr_130px_150px_72px]";

/** A data or skeleton row: always a grid, two columns on phones. */
export const ROW_GRID = `grid grid-cols-[1fr_auto] items-center gap-3 ${TABLE_COLS}`;

/** The header: hidden on phones, same four columns on `sm+`. */
export const HEADER_GRID = `hidden gap-3 sm:grid ${TABLE_COLS}`;
