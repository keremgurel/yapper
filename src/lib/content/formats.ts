/**
 * What a piece of content is going to be published as.
 *
 * Distinct from `contentItems.format`, which is the AI's read on the source's
 * creative shape ("audio-led reaction sketch"). This is the distribution
 * decision, it is the creator's to make, and one idea can be several: the same
 * angle often ships as a short and an article.
 */
export interface ContentFormat {
  id: string;
  label: string;
  /** Chip classes. Distinct hues so a row is scannable without reading. */
  chip: string;
}

export const CONTENT_FORMATS: ContentFormat[] = [
  {
    id: "short",
    label: "Short-form",
    chip: "bg-blue-500/15 text-blue-500",
  },
  {
    id: "long",
    label: "Long-form",
    chip: "bg-amber-500/15 text-amber-600",
  },
  {
    id: "article",
    label: "Article",
    chip: "bg-rose-500/15 text-rose-500",
  },
  {
    id: "thread",
    label: "Thread",
    chip: "bg-violet-500/15 text-violet-500",
  },
  {
    id: "carousel",
    label: "Carousel",
    chip: "bg-teal-500/15 text-teal-600",
  },
  {
    id: "newsletter",
    label: "Newsletter",
    chip: "bg-slate-500/15 text-slate-500",
  },
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
