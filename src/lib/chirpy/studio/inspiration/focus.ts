import { record } from "../../protocol";

/**
 * The inspiration item the creator has open on the Inspiration tab. Saved
 * inspiration lives in the browser, so the tab sends this one item with the
 * turn; studio.ideas.capture and studio.inspiration.brainstorm read it from
 * the turn, never from the model's arguments.
 */
export interface InspirationFocus {
  url: string;
  title: string;
  platform?: string;
  author?: string;
  /** What the creator wrote on the card. */
  note?: string;
  transcript?: string;
}

const text = (value: unknown, max: number): string | undefined =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : undefined;

/** The item, bounded; null when it is malformed. */
export function parseInspirationFocus(raw: unknown): InspirationFocus | null {
  if (!record(raw)) return null;
  const url = text(raw.url, 600);
  const title = text(raw.title, 300);
  if (!url || !/^https?:\/\//i.test(url) || !title) return null;
  const item: InspirationFocus = { url, title };
  const platform = text(raw.platform, 20);
  const author = text(raw.author, 120);
  const note = text(raw.note, 1000);
  const transcript = text(raw.transcript, 12_000);
  if (platform) item.platform = platform;
  if (author) item.author = author;
  if (note) item.note = note;
  if (transcript) item.transcript = transcript;
  return item;
}

/** What the planner needs to know about it: enough to say which item, not
 * its transcript. */
export function inspirationForPrompt(item: InspirationFocus) {
  return {
    title: item.title,
    ...(item.author ? { author: item.author } : {}),
    ...(item.platform ? { platform: item.platform } : {}),
    ...(item.note ? { note: item.note.slice(0, 200) } : {}),
  };
}
