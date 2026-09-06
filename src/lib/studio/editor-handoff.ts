/** Carry only the content identity; the Mac app resolves owned media itself. */
export function desktopEditorUrl(itemId?: string | null): string {
  const url = new URL("yapper-studio://open/editor");
  if (itemId) url.searchParams.set("item", itemId);
  return url.toString();
}

export function studioEditorUrl(itemId: string): string {
  return `/studio/editor?${new URLSearchParams({ item: itemId })}`;
}
