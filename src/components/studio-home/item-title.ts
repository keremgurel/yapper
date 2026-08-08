/** Display title for a content item row, falling back through whatever the
 * creator actually gave us. ItemSummary and ContentSummary both satisfy it. */
export function itemTitle(item: {
  title: string;
  sourceTitle: string | null;
  originalNote: string;
}): string {
  return item.title || item.sourceTitle || item.originalNote || "Untitled idea";
}
