import type { CrossPostTarget } from "@/components/publish/compose/types";
import type { PublishPlatform } from "@/lib/db/schema";
import { renderCaption } from "@/lib/publish/caption";

/** The sheet's own title/caption fields, used only when nothing was prepared. */
export interface CopyOverride {
  title: string;
  caption: string;
}

/**
 * What actually goes out for one source on one platform.
 *
 * A per-platform caption written in the Poster wins, and its body is rendered
 * by `renderCaption` so the text the creator read on screen is byte-for-byte
 * the text that is posted. The single-video fields in the sheet are the
 * fallback for the surfaces that open it straight from a list, where no
 * captions were prepared at all.
 */
export function outgoingCopy(
  source: CrossPostTarget,
  platform: PublishPlatform,
  override: CopyOverride | null,
): { title: string; body: string } {
  const prepared = source.captions?.[platform];
  const fallbackTitle =
    override?.title.trim() || source.initialTitle?.trim() || source.title;
  const title = prepared?.title.trim() || fallbackTitle;
  const body = prepared
    ? renderCaption(prepared)
    : override?.caption.trim() || source.initialDescription?.trim() || "";
  return { title, body };
}

/** True once any source carries captions written per platform. */
export function hasPreparedCaptions(sources: CrossPostTarget[]): boolean {
  return sources.some(
    (source) => Object.keys(source.captions ?? {}).length > 0,
  );
}
