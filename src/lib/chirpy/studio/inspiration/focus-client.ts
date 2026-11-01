import type { InspirationItem } from "@/lib/inspiration/types";
import type { InspirationFocus } from "./focus";

let current: InspirationFocus | null = null;

/** Remember the inspiration card the creator last clicked or tabbed into:
 * it is "this" when they ask Chirpy on the Inspiration tab. Saved
 * inspiration lives in this browser, so the turn carries the item itself. */
export function noteInspirationFocus(item: InspirationItem): void {
  current = {
    url: item.url,
    title: item.title,
    platform: item.platform,
    ...(item.author ? { author: item.author } : {}),
    ...(item.note ? { note: item.note } : {}),
    ...(item.transcript ? { transcript: item.transcript } : {}),
  };
}

/** Forget it when the card goes away (deleted, or the tab closed). */
export function forgetInspirationFocus(url?: string): void {
  if (!url || current?.url === url) current = null;
}

export function inspirationFocus(): InspirationFocus | null {
  return current;
}
