import type { PlatformCaption } from "./caption-prompt";
import { captionSpec } from "./caption-specs";
export type { PlatformCaption } from "./caption-prompt";

/**
 * The caption as it is actually posted: body then hashtags, with the tags on
 * their own line so they read as tags rather than as a sentence that trailed
 * off. Kept out of the model's hands because the platforms differ on where
 * tags belong and the model is inconsistent about it.
 */
export function renderCaption(caption: PlatformCaption): string {
  const tags = caption.hashtags.map((tag) => `#${tag}`).join(" ");
  return [caption.body.trim(), tags].filter(Boolean).join("\n\n");
}

/** Whether this caption fits what the platform will accept once rendered. */
export function captionFits(caption: PlatformCaption): boolean {
  const spec = captionSpec(caption.platform);
  return (
    caption.title.length <= spec.titleMax &&
    renderCaption(caption).length <= spec.bodyMax
  );
}
