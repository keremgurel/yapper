import {
  buildCaptionMessages,
  parseCaptions,
  type CaptionInput,
  type PlatformCaption,
} from "@/lib/publish/caption-prompt";
import type { PublishPlatform } from "@/lib/db/schema";
import { fetchBoundedJson } from "@/lib/http/outbound";
import { undash } from "@/lib/text/undash";

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
  const captions = parseCaptions(
    data.choices?.[0]?.message?.content ?? "{}",
    platforms,
  ).map((caption) => ({
    ...caption,
    title: undash(caption.title),
    body: undash(caption.body),
  }));
  if (
    input.titleOnly &&
    !captions.find((caption) => caption.platform === "youtube")?.title.trim()
  ) {
    throw new Error("caption_empty");
  }
  return captions;
}

export { renderCaption, captionFits } from "./caption-format";
