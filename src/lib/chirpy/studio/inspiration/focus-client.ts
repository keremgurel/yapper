import type { InspirationItem } from "@/lib/inspiration/types";
import type { InspirationFocus } from "./focus";
import { INSPIRATION_FOCUS_MAX as MAX, isWebLink } from "./focus-limits";

let current: InspirationFocus | null = null;

const cut = (value: string | undefined, max: number): string | undefined =>
  value?.trim().slice(0, max) || undefined;

/** Remember the inspiration card the creator last clicked or tabbed into:
 * it is "this" when they ask Chirpy on the Inspiration tab. Saved
 * inspiration lives in this browser, so the turn carries the item itself,
 * cut to what the server keeps. A card the server would refuse (no title,
 * or a link that is not a web address) is not remembered, since sending it
 * would fail every request on the tab. */
export function noteInspirationFocus(item: InspirationItem): void {
  const url = cut(item.url, MAX.url);
  const title = cut(item.title, MAX.title);
  if (!url || !isWebLink(url) || !title) {
    current = null;
    return;
  }
  const platform = cut(item.platform, MAX.platform);
  const author = cut(item.author, MAX.author);
  const note = cut(item.note, MAX.note);
  const transcript = cut(item.transcript, MAX.transcript);
  current = {
    url,
    title,
    ...(platform ? { platform } : {}),
    ...(author ? { author } : {}),
    ...(note ? { note } : {}),
    ...(transcript ? { transcript } : {}),
  };
}

/** Forget it when the card goes away (deleted, or the tab closed). */
export function forgetInspirationFocus(url?: string): void {
  if (!url || current?.url === url) current = null;
}

export function inspirationFocus(): InspirationFocus | null {
  return current;
}
