export type CoverPosition = "top" | "center" | "bottom";
export const coverFonts = {
  modern: { label: "Modern", family: "system-ui, sans-serif" },
  rounded: {
    label: "Rounded",
    family: 'ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif',
  },
  editorial: {
    label: "Editorial",
    family: 'Georgia, "Times New Roman", serif',
  },
} as const;

export type CoverTextAppearance = {
  font: keyof typeof coverFonts;
  size: number;
  fill: string;
  background: boolean;
  backgroundColor: string;
  cornerRadius: number;
  shadow: boolean;
  shadowColor: string;
  shadowRadius: number;
  stroke: boolean;
  strokeColor: string;
};

export const defaultCoverText: CoverTextAppearance = {
  font: "modern",
  size: 92,
  fill: "#ffffff",
  background: false,
  backgroundColor: "#1b181c",
  cornerRadius: 28,
  shadow: true,
  shadowColor: "#000000",
  shadowRadius: 18,
  stroke: false,
  strokeColor: "#000000",
};
export type CoverSource = "frame" | "generated" | "uploaded" | "original";

/** The cover image a post ships with, kept separate from its captions: one
 * cover serves every platform, the captions do not. */
export interface CoverDraft {
  frameImage: string | null;
  image: string | null;
  source: CoverSource;
  frameTime: number;
  headline: string;
  showHeadline: boolean;
  text: CoverTextAppearance;
  position: CoverPosition;
}

export function withCoverFrame(
  draft: CoverDraft,
  frame: { image: string; time: number },
): CoverDraft {
  return {
    ...draft,
    frameImage: frame.image,
    frameTime: frame.time,
    image: draft.source === "frame" ? frame.image : draft.image,
  };
}

export const DEFAULT_THUMBNAIL_PROMPT =
  "Generate a 9:16 short-form video thumbnail from the attached frame.";

export function defaultCover(title: string): CoverDraft {
  // Kept in the signature because the caller's title is still the fallback
  // publish title; it simply must not become a white card on the thumbnail.
  void title;
  return {
    frameImage: null,
    image: null,
    source: "frame",
    frameTime: 0,
    headline: "",
    showHeadline: false,
    text: { ...defaultCoverText },
    position: "bottom",
  };
}
