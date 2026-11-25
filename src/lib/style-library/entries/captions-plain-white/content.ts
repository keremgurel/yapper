import { wordsContent } from "../../format/content-spec";

export const captionContent = {
  words: wordsContent("Transcript words"),
} as const;

export type CaptionContentSpecs = typeof captionContent;
