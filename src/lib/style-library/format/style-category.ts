/** The shelves of the gallery, in the order they are shown. */
export const STYLE_CATEGORIES = [
  { id: "captions", label: "Captions" },
  { id: "hooks", label: "Text hooks" },
  { id: "layouts", label: "Layouts" },
  { id: "splits", label: "Split screens" },
  { id: "cards", label: "Cards" },
  { id: "overlays", label: "Overlays" },
  { id: "behind-speaker", label: "Behind the speaker" },
  { id: "covers", label: "Covers" },
] as const;

export type StyleCategoryId = (typeof STYLE_CATEGORIES)[number]["id"];

/**
 * How far a style sits from what Instagram and TikTok do on their own.
 * `native` could have been made in the app and is the default shelf for
 * yappers; `produced` is the heavier, edited look and is browsed on purpose.
 */
export type StyleWeight = "native" | "produced";
