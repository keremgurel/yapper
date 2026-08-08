/**
 * What a piece of content is going to be published as.
 *
 * Distinct from `contentItems.format`, which is the AI's read on the source's
 * creative shape ("audio-led reaction sketch"). This is the distribution
 * decision, it is the creator's to make, and one idea can be several: the same
 * angle often ships as a short and an article.
 *
 * Chip colors are not stored here: they come from `formatTone()` in
 * `@/components/studio-ui`, so every surface renders a format the same way.
 */
export interface ContentFormat {
  id: string;
  label: string;
}

export const CONTENT_FORMATS: ContentFormat[] = [
  { id: "short", label: "Short-form" },
  { id: "long", label: "Long-form" },
  { id: "article", label: "Article" },
  { id: "thread", label: "Thread" },
  { id: "carousel", label: "Carousel" },
  { id: "newsletter", label: "Newsletter" },
];

const BY_ID = new Map(CONTENT_FORMATS.map((f) => [f.id, f]));

export function contentFormat(id: string): ContentFormat | null {
  return BY_ID.get(id) ?? null;
}

/** Keep only ids this app knows, de-duplicated, in library order so two items
 * with the same formats always render their chips the same way round. */
export function normalizeFormats(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const wanted = new Set(
    value.filter((v): v is string => typeof v === "string" && BY_ID.has(v)),
  );
  return CONTENT_FORMATS.filter((f) => wanted.has(f.id)).map((f) => f.id);
}
