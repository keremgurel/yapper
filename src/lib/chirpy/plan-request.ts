import { createHash } from "node:crypto";
import {
  discoveredCatalog,
  schemaDefinitions,
  type PlanInput,
} from "./protocol";

export const CHIRPY_MAX_COMPLETION_TOKENS = 6000;
export const CHIRPY_TIMEOUT_MS = 40_000;

export function chirpyModel(): string {
  return process.env.AI_CHIRPY_MODEL ?? "gpt-5.4";
}

/** The catalog and its schemas are the same for every turn from one app
 * version, so they go ahead of the conversation and project, which change
 * every turn; behind them nothing past the system prompt could be cached. The
 * key is shared by every user on the same prompt and catalog. */
export function planReference(input: PlanInput, system: string) {
  const reference = JSON.stringify({
    catalog: discoveredCatalog(input),
    definitions: schemaDefinitions(input),
  });
  const digest = createHash("sha256")
    .update(system)
    .update(reference)
    .digest("hex");
  return { reference, promptCacheKey: `chirpy-${digest.slice(0, 16)}` };
}

interface OverlayImage {
  overlayID: string;
  jpeg: string;
  width?: number;
  height?: number;
  detectedRegions?: unknown;
}

/** Take the selected overlay's JPEG out of the context, leaving a stub that
 * describes it, so base64 never travels as prompt text. */
export function splitOverlayImage(
  input: Record<string, unknown>,
  description: string,
): { context: Record<string, unknown>; image?: string } {
  const { selectedOverlayImage, ...context } = input;
  const image = selectedOverlayImage as OverlayImage | undefined | null;
  if (!image) return { context };
  return {
    context: {
      ...context,
      selectedOverlayImage: {
        overlayID: image.overlayID,
        width: image.width,
        height: image.height,
        detectedRegions: image.detectedRegions,
        description,
      },
    },
    image: image.jpeg || undefined,
  };
}
