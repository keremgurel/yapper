import { fetchBoundedJson } from "@/lib/http/outbound";
import type { SceneImageRequest } from "./scene-types";

/**
 * A picture for an `image:<key>` node, from the same Gemini image endpoint
 * the thumbnail feature uses, at the smallest size the model offers: the
 * picture sits inside a card inside a video frame, so 1K is already more
 * than the export can show.
 *
 * Returns null when no key is configured. Delivery rejects incomplete scenes
 * instead of silently stripping the illustration that gave them meaning.
 */
export interface SceneImage {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  /** Base64, no data URL prefix. */
  data: string;
}

interface GeminiImageResponse {
  candidates?: {
    content?: {
      parts?: {
        thought?: boolean;
        inlineData?: { mimeType?: string; data?: string };
      }[];
    };
  }[];
}

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 60_000;

const PROMPT_PREFIX =
  "A clean illustration for a video overlay. No text, no letters, no logos, " +
  "no watermark. Use a solid plain white background. Do not simulate transparency: " +
  "no checkerboard, transparency grid, or textured backdrop.\n\n";

/**
 * The aspect ratios the image API accepts, as the protobuf enum names v1 REST
 * takes (the friendly "16:9" strings are a 400 there, see thumbnail.ts).
 */
const ASPECT_RATIOS: readonly { ratio: number; name: string }[] = [
  { ratio: 1, name: "ASPECT_RATIO_ONE_BY_ONE" },
  { ratio: 4 / 3, name: "ASPECT_RATIO_FOUR_BY_THREE" },
  { ratio: 3 / 4, name: "ASPECT_RATIO_THREE_BY_FOUR" },
  { ratio: 16 / 9, name: "ASPECT_RATIO_SIXTEEN_BY_NINE" },
  { ratio: 9 / 16, name: "ASPECT_RATIO_NINE_BY_SIXTEEN" },
  { ratio: 3 / 2, name: "ASPECT_RATIO_THREE_BY_TWO" },
  { ratio: 2 / 3, name: "ASPECT_RATIO_TWO_BY_THREE" },
  { ratio: 4 / 5, name: "ASPECT_RATIO_FOUR_BY_FIVE" },
  { ratio: 5 / 4, name: "ASPECT_RATIO_FIVE_BY_FOUR" },
  { ratio: 21 / 9, name: "ASPECT_RATIO_TWENTY_ONE_BY_NINE" },
];

/** The supported ratio nearest the one asked for, by log distance. */
export function nearestAspectRatioName(aspect: number): string {
  if (!Number.isFinite(aspect) || aspect <= 0) return ASPECT_RATIOS[0].name;
  let best = ASPECT_RATIOS[0];
  let bestDistance = Infinity;
  for (const candidate of ASPECT_RATIOS) {
    const distance = Math.abs(Math.log(aspect / candidate.ratio));
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best.name;
}

async function requestImage(
  key: string,
  model: string,
  prompt: string,
  aspectRatio: string,
  signal?: AbortSignal,
) {
  return fetchBoundedJson<GeminiImageResponse>(
    `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "X-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: PROMPT_PREFIX + prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          responseFormat: {
            image: { aspectRatio, imageSize: "IMAGE_SIZE_ONE_K" },
          },
        },
      }),
    },
    { timeoutMs: PROVIDER_TIMEOUT_MS, maxBytes: MAX_RESPONSE_BYTES, signal },
  );
}

export async function generateSceneImage(
  request: Pick<SceneImageRequest, "prompt" | "aspect">,
  signal?: AbortSignal,
): Promise<SceneImage | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";
  const aspectRatio = nearestAspectRatioName(request.aspect);
  let { response, data } = await requestImage(
    key,
    model,
    request.prompt,
    aspectRatio,
    signal,
  );
  // A model that does not take this ratio answers 400. Square is the one
  // every image model takes, and a square picture in a card still reads.
  if (response.status === 400 && aspectRatio !== ASPECT_RATIOS[0].name) {
    ({ response, data } = await requestImage(
      key,
      model,
      request.prompt,
      ASPECT_RATIOS[0].name,
      signal,
    ));
  }
  if (!response.ok) throw new Error(`image_${response.status}`);

  const parts =
    data.candidates?.flatMap((candidate) =>
      (candidate.content?.parts ?? []).filter(
        (part) => !part.thought && part.inlineData?.data,
      ),
    ) ?? [];
  const result = parts.at(-1)?.inlineData;
  const mimeType = result?.mimeType?.toLowerCase();
  if (
    !result?.data ||
    (mimeType !== "image/jpeg" &&
      mimeType !== "image/png" &&
      mimeType !== "image/webp")
  ) {
    throw new Error("image_empty");
  }
  if (Math.floor((result.data.length * 3) / 4) > MAX_IMAGE_BYTES) {
    throw new Error("image_too_large");
  }
  return { mimeType, data: result.data };
}
