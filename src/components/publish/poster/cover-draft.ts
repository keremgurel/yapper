export type CoverPosition = "top" | "center" | "bottom";
export type CoverTextStyle = "shadow" | "label";
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
  textStyle: CoverTextStyle;
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
    textStyle: "shadow",
    position: "bottom",
  };
}
