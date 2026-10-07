import sharp from "sharp";
import { fetchBoundedJson } from "@/lib/http/outbound";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 18 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 210_000;

export interface ThumbnailInput {
  prompt: string;
  frame?: string;
  reference?: string;
}

interface InlineImage {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
}

interface SurplusImageResponse {
  error?: { code?: string; message?: string };
  data?: { b64_json?: string }[];
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

/** Generate or remix through Surplus; attachments always require an edit model. */
export async function generateThumbnail(
  input: ThumbnailInput,
  signal?: AbortSignal,
): Promise<string> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base = (
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1"
  ).replace(/\/$/, "");
  const frame = inlineImage(input.frame);
  const reference = inlineImage(input.reference);
  // The first image is the editing canvas. A reference should set the layout,
  // while the selected video frame supplies the creator's identity and scene.
  const images = [reference, frame].filter(
    (image): image is InlineImage => image !== undefined,
  );
  const editing = images.length > 0;
  const model = editing
    ? (process.env.SURPLUS_IMAGE_EDIT_MODEL ?? "gpt-image-2-edit")
    : (process.env.SURPLUS_IMAGE_MODEL ?? "venice-gpt-image-2");
  const roles = [
    reference
      ? "Image 1 is the REFERENCE THUMBNAIL: preserve its layout and design."
      : "",
    frame
      ? `Image ${reference ? 2 : 1} is the SELECTED VIDEO FRAME: use this person and scene.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const prompt =
    "Create one finished 9:16 vertical short-form video thumbnail. " +
    "Follow the creator's request precisely. Preserve the recognizable identity " +
    "of the person in the selected video frame. When a reference thumbnail is " +
    "supplied, match its layout, crop, framing, background, lighting, colors, " +
    "typography, text placement, and graphic elements. Replace the reference's " +
    "person with the person from the video frame when both are supplied. " +
    "Keep the reference's text unless the creator requests new wording. " +
    "Render requested text exactly, including punctuation and episode numbers. " +
    "Without a reference, omit text unless requested. Fill the entire vertical " +
    "canvas; do not put the thumbnail inside a landscape image or add borders.\n\n" +
    roles +
    "\n\nCREATOR REQUEST:\n" +
    input.prompt.trim();

  const { response, data } = await fetchBoundedJson<SurplusImageResponse>(
    `${base}/images/${editing ? "edits" : "generations"}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: "1024x1536",
        aspect_ratio: "9:16",
        resolution: "2K",
        quality: "high",
        response_format: "b64_json",
        ...(editing
          ? {
              input_images: images.map((image, index) => ({
                url: `data:${image.mimeType};base64,${image.data}`,
                role: index === 0 ? "start" : "reference",
              })),
            }
          : {}),
      }),
    },
    { timeoutMs: PROVIDER_TIMEOUT_MS, maxBytes: MAX_RESPONSE_BYTES, signal },
  );
  if (!response.ok) {
    // Provider errors stay server-side; never log creator content or credentials.
    let message =
      typeof data.error?.message === "string" ? data.error.message : "";
    for (const value of [
      key,
      prompt,
      input.prompt.trim(),
      frame?.data,
      reference?.data,
    ]) {
      if (value) message = message.replaceAll(value, "[redacted]");
    }
    throw new Error(`thumbnail_${response.status}`, {
      cause: {
        model,
        code: data.error?.code,
        requestId: response.headers.get("x-request-id"),
        message: message.slice(0, 500),
      },
    });
  }
  const encoded = data.data?.[0]?.b64_json;
  if (typeof encoded !== "string" || !/^[a-z0-9+/]+={0,2}$/i.test(encoded)) {
    throw new Error("thumbnail_empty");
  }
  // Providers can return PNG even when JPEG is requested. Re-encode real image
  // bytes to keep a high-quality result below the serverless response limit.
  try {
    const image = await sharp(Buffer.from(encoded, "base64"), {
      limitInputPixels: 20_000_000,
    })
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90 })
      .toBuffer();
    if (image.length > 3 * 1024 * 1024)
      throw new Error("thumbnail_image_too_large");
    return `data:image/jpeg;base64,${image.toString("base64")}`;
  } catch {
    throw new Error("thumbnail_invalid_output");
  }
}
