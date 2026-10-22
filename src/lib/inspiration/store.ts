import type { InspirationItem, Pillar } from "./types";

const PILLARS_KEY = "yapper-inspiration-pillars-v1";
const ITEMS_KEY = "yapper-inspiration-items-v1";

export const DEFAULT_PILLARS: Pillar[] = [
  { id: "pillar-hooks", name: "Hooks & openers", createdAt: 0 },
  { id: "pillar-storytelling", name: "Storytelling", createdAt: 1 },
  { id: "pillar-education", name: "Educational", createdAt: 2 },
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    // Corrupt or schema-shifted storage must not crash a caller that maps over
    // the result (loadItems, loadPillars). A stored value whose array-ness no
    // longer matches the fallback is treated as absent, not blindly cast.
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable; ignore for this local-first MVP
  }
}

export function loadPillars(): Pillar[] {
  return read<Pillar[]>(PILLARS_KEY, DEFAULT_PILLARS);
}

export function savePillars(pillars: Pillar[]): void {
  write(PILLARS_KEY, pillars);
}

export function loadItems(): InspirationItem[] {
  // Items saved before the video/creator split have no `kind` — treat them as
  // videos so the existing library keeps rendering.
  const items = read<InspirationItem[]>(ITEMS_KEY, []).map((it) => ({
    ...it,
    kind: it.kind ?? "video",
  }));
  const clean = items.map(withoutYouTubeMetadata);
  write(ITEMS_KEY, clean); // Upgrade legacy browser copies as soon as the app opens.
  return clean;
}

export function saveItems(items: InspirationItem[]): void {
  write(ITEMS_KEY, items.map(withoutYouTubeMetadata));
}

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

/** YouTube API metadata is session-only. Keep the creator's saved link, notes,
 * transcript and organization; never persist feeds, metrics or API identity. */
export function withoutYouTubeMetadata(item: InspirationItem): InspirationItem {
  if (item.platform !== "youtube") return item;
  return {
    id: item.id,
    kind: item.kind,
    platform: item.platform,
    pillarId: item.pillarId,
    url: item.url,
    title: item.url,
    note: item.note,
    transcript: item.transcript,
    creatorItemId: item.creatorItemId,
    createdAt: item.createdAt,
  };
}

export const YOUTUBE_DISCONNECTED_EVENT = "yapper:youtube-disconnected";
export function clearYouTubeBrowserData() {
  saveItems(loadItems());
  try {
    window.localStorage.setItem(YOUTUBE_DISCONNECTED_EVENT, String(Date.now()));
  } catch {
    /* Storage may be disabled. */
  }
  window.dispatchEvent(new Event(YOUTUBE_DISCONNECTED_EVENT));
}
