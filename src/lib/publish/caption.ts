import {
  buildCaptionMessages,
  parseCaptions,
  type CaptionInput,
  type PlatformCaption,
} from "@/lib/publish/caption-prompt";
import { captionSpec } from "@/lib/publish/caption-specs";
import type { PublishPlatform } from "@/lib/db/schema";
import { fetchBoundedJson } from "@/lib/http/outbound";

const PROVIDER_TIMEOUT_MS = 35_000;
const MAX_COMPLETION_TOKENS = 3_000;
const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;
interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

export type { CaptionInput, PlatformCaption };

/**
 * One caption per platform, written together so they stay the same idea in
 * three voices rather than three ideas.
 */
export async function generateCaptions(
  input: CaptionInput,
  signal?: AbortSignal,
): Promise<PlatformCaption[]> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.GENERATE_MODEL ?? "gpt-5.4-mini";

  const platforms: PublishPlatform[] = input.platforms.length
    ? input.platforms
    : ["youtube"];
  const { system, user } = buildCaptionMessages({ ...input, platforms });

  const { response, data } = await fetchBoundedJson<ChatCompletionResponse>(
    `${base}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    },
    {
      timeoutMs: PROVIDER_TIMEOUT_MS,
      maxBytes: MAX_PROVIDER_RESPONSE_BYTES,
      signal,
    },
  );
  if (!response.ok) throw new Error(`caption_${response.status}`);
  return parseCaptions(data.choices?.[0]?.message?.content ?? "{}", platforms);
}

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
