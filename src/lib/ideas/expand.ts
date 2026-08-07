import { deriveIdeaType } from "@/lib/ideas/derive-type";
import {
  buildExpandMessages,
  EMPTY_PROMPT_CONTEXT,
  parseExpansion,
  type PromptContext,
} from "@/lib/ideas/expand-prompt";
import type { IdeaExpansion, IdeaInput } from "@/lib/ideas/types";

/**
 * Turn a raw idea into an adaptive reference dossier via the AI provider.
 * Server-only: reads the provider key from the env. The caller preserves the
 * creator's words and the source transcript separately; this only builds the
 * regenerable analysis around them.
 *
 * Throws (never returns a half-baked object) so the route can decide whether to
 * store the idea un-expanded and retry later versus surface the error.
 */
export async function expandIdea(
  input: IdeaInput,
  context: PromptContext = EMPTY_PROMPT_CONTEXT,
): Promise<IdeaExpansion> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model =
    process.env.AI_IDEA_MODEL ?? process.env.AI_CLEAN_MODEL ?? "gpt-5.4";

  const type = deriveIdeaType(input);
  const { system, user } = buildExpandMessages(input, type, context);

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`expand_${res.status}`);
  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  const parsed = parseExpansion(content);
  if (!parsed) throw new Error("expand_unparseable");
  return parsed;
}
