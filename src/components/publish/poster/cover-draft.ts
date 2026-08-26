export type CoverPosition = "top" | "center" | "bottom";
export type CoverTextStyle = "shadow" | "label";
export type CoverSource = "frame" | "generated";

/** The cover image a post ships with, kept separate from its captions: one
 * cover serves every platform, the captions do not. */
export interface CoverDraft {
  frameImage: string | null;
  image: string | null;
  source: CoverSource;
  frameTime: number;
  headline: string;
  showHeadline: boolean;
  textStyle: CoverTextStyle;
  position: CoverPosition;
}

export const DEFAULT_THUMBNAIL_PROMPT =
  "Create a high-impact vertical social-video thumbnail. Keep the person recognizable and identity-faithful. Make the main subject large, expressive, and immediately readable on a phone. Improve lighting, separation, color, and contrast while keeping the result believable. Simplify distracting background details and leave useful negative space for an optional headline. Do not add text, logos, borders, or watermarks.";

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
    textStyle: "shadow",
    position: "bottom",
  };
}
