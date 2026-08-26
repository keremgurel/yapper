import { fetchBoundedJson } from "@/lib/http/outbound";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 18 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 90_000;

export interface ThumbnailInput {
  prompt: string;
  frame?: string;
  reference?: string;
}

interface InlineImage {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
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

/** Parse only small, known image data URLs before they cross the provider boundary. */
export function inlineImage(value: unknown): InlineImage | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i.exec(
    value,
  );
  if (!match) throw new Error("thumbnail_bad_image");
  const data = match[2];
  const bytes = Math.floor((data.length * 3) / 4);
  if (bytes <= 0 || bytes > MAX_IMAGE_BYTES) {
    throw new Error("thumbnail_image_too_large");
  }
  return { mimeType: match[1].toLowerCase() as InlineImage["mimeType"], data };
}

/** Generate a vertical thumbnail from text, a video frame, or frame + reference. */
export async function generateThumbnail(
  input: ThumbnailInput,
  signal?: AbortSignal,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no_provider");
  const model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";
  const frame = inlineImage(input.frame);
  const reference = inlineImage(input.reference);
  const parts: (
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  )[] = [
    {
      text:
        "Create one finished 9:16 social-video thumbnail. Follow the creator's " +
        "request precisely. If a SELECTED VIDEO FRAME is supplied, preserve the " +
        "person's identity and use that frame as the composition/subject source. " +
        "If an EXAMPLE THUMBNAIL is supplied, borrow its visual language—layout, " +
        "lighting, color, energy, and hierarchy—but do not copy its people, text, " +
        "logos, or copyrighted characters. Unless explicitly requested, do not " +
        "render any words, logos, borders, or watermarks. Output only the image.\n\n" +
        `CREATOR REQUEST:\n${input.prompt.trim()}`,
    },
  ];
  if (frame) {
    parts.push({ text: "SELECTED VIDEO FRAME:" });
    parts.push({ inlineData: frame });
  }
  if (reference) {
    parts.push({ text: "EXAMPLE THUMBNAIL (style reference only):" });
    parts.push({ inlineData: reference });
  }

  const { response, data } = await fetchBoundedJson<GeminiImageResponse>(
    `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "X-goog-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          responseFormat: {
            // REST takes the protobuf enum names here. The SDK examples show
            // friendly "9:16"/"2K" values, but sending those strings directly
            // to v1 is a 400 INVALID_ARGUMENT.
            image: {
              aspectRatio: "ASPECT_RATIO_NINE_BY_SIXTEEN",
              imageSize: "IMAGE_SIZE_TWO_K",
            },
          },
        },
      }),
    },
    {
      timeoutMs: PROVIDER_TIMEOUT_MS,
      maxBytes: MAX_RESPONSE_BYTES,
      signal,
    },
  );
  if (!response.ok) throw new Error(`thumbnail_${response.status}`);

  const images =
    data.candidates?.flatMap((candidate) =>
      (candidate.content?.parts ?? []).filter(
        (part) => !part.thought && part.inlineData?.data,
      ),
    ) ?? [];
  const result = images.at(-1)?.inlineData;
  const mimeType = result?.mimeType?.toLowerCase();
  if (
    !result?.data ||
    (mimeType !== "image/jpeg" &&
      mimeType !== "image/png" &&
      mimeType !== "image/webp")
  ) {
    throw new Error("thumbnail_empty");
  }
  return `data:${mimeType};base64,${result.data}`;
}
