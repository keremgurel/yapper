import type { VersionFormat } from "@/lib/content/formats";
import type { PromptContext } from "@/lib/ideas/expand-prompt";
import { dropRestatedOpener, matchPillar } from "@/lib/ideas/expansion-guards";
import { fetchBoundedJson } from "@/lib/http/outbound";
import { tidyLongScript } from "./chapters";
import {
  buildVersionMessages,
  parseVersionOutput,
  type IdeaMaterial,
  type VersionSource,
  type WrittenVersion,
} from "./prompt";

// A 12 minute long-form is about 1,800 words; the JSON around it and the key
// points need room on top.
const MAX_COMPLETION_TOKENS: Record<VersionFormat, number> = {
  short: 3_000,
  long: 8_000,
  article: 6_000,
};
const PROVIDER_TIMEOUT_MS = 100_000;
const MAX_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024;

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

/** The guards every written version goes through, by format. */
export function guardVersion(
  target: VersionFormat,
  version: WrittenVersion,
  pillarNames: readonly string[],
): WrittenVersion {
  const script =
    target === "short"
      ? dropRestatedOpener(version.script, version.alternatives)
      : target === "long"
        ? tidyLongScript(
            version.script,
            version.title.split(/\s+/).slice(0, 6).join(" "),
          )
        : version.script;
  return {
    ...version,
    script: script.replace(/\s*[—–]\s*/g, ", "),
    pillar: matchPillar(version.pillar, pillarNames),
  };
}

/**
 * Write one format of an idea through the AI provider. `from` is the version
 * to adapt, or null for a first draft straight from the idea's material.
 * Throws rather than returning something half made, so the route refunds.
 */
export async function writeVersion(
  target: VersionFormat,
  material: IdeaMaterial,
  from: VersionSource | null,
  context: PromptContext,
  signal?: AbortSignal,
): Promise<WrittenVersion> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model =
    process.env.AI_IDEA_MODEL ?? process.env.AI_CLEAN_MODEL ?? "gpt-5.4";

  const { system, user } = buildVersionMessages(
    target,
    material,
    from,
    context,
  );
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
        temperature: 0.5,
        max_completion_tokens: MAX_COMPLETION_TOKENS[target],
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
  if (!response.ok) throw new Error(`version_${response.status}`);
  const parsed = parseVersionOutput(
    target,
    data.choices?.[0]?.message?.content ?? "",
  );
  if (!parsed) throw new Error("version_unparseable");
  return guardVersion(target, parsed, context.pillarNames);
}
