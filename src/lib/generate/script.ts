import type { ContentBlock } from "@/lib/db/schema";
import { fetchBoundedJson } from "@/lib/http/outbound";

const PROVIDER_TIMEOUT_MS = 35_000;
const MAX_COMPLETION_TOKENS = 800;
const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;
interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

export interface ScriptInput {
  /** The creator's compiled brain, already wrapped and ready to append. */
  context?: string;
  title?: string;
  hooks?: string[];
  /** The idea's body, in whatever shape the idea actually took. */
  blocks?: ContentBlock[];
  /** The creator's own words, which outrank anything the AI wrote about them. */
  originalNote?: string;
}

const SYSTEM =
  "You are a short-form video scriptwriter for creators (TikTok/Reels/Shorts). " +
  "Turn the given idea into a tight, spoken-word script the creator reads off a " +
  "teleprompter. Rules: open with the single strongest hook, then deliver the " +
  "idea's sections as natural spoken lines (contractions, short sentences, NO " +
  "bullet formatting or headers), following whatever order and emphasis those " +
  "sections imply rather than a fixed template. If the creator's own words are " +
  "supplied, their angle and meaning win over any summary of them. 130-200 " +
  "words (~45-75s spoken). Write ONLY the words to say aloud — no stage " +
  "directions, scene labels, or notes. Return STRICT JSON only: " +
  '{"script": "<the full script as one string, newlines allowed>"}.';

function parseScript(content: string): string {
  const s = content.indexOf("{");
  const e = content.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("script_unparseable");
  const raw = JSON.parse(content.slice(s, e + 1)) as { script?: unknown };
  const script = typeof raw.script === "string" ? raw.script.trim() : "";
  // Empty-but-valid JSON (content filter, wrong shape) must NOT count as success
  // — the route only charges when this returns, so throw to trigger no-charge.
  if (!script) throw new Error("script_empty");
  return script;
}

/** Generate a full spoken-word script from an idea via the Surplus gateway.
 * This is the "expensive side" of generation (long output) — a separate,
 * opt-in call from idea generation, so users only pay for it when they want it. */
export async function generateScript(
  input: ScriptInput,
  signal?: AbortSignal,
): Promise<string> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.GENERATE_MODEL ?? "gpt-5.4-mini";

  const bullets = (label: string, items?: string[]) =>
    items?.length ? `${label}:\n${items.map((x) => `- ${x}`).join("\n")}` : "";
  // Each block keeps its own label, so the model sees the structure the idea
  // actually has instead of it being flattened back into fixed headings.
  const body = (input.blocks ?? [])
    .map((b) =>
      b.items?.length ? bullets(b.label, b.items) : `${b.label}:\n${b.text}`,
    )
    .filter(Boolean);
  const parts = [
    input.title ? `Title: ${input.title}` : "",
    bullets("Hooks", input.hooks),
    input.originalNote?.trim()
      ? `The creator's own words:\n${input.originalNote.trim()}`
      : "",
    ...body,
  ].filter(Boolean);
  if (parts.length === 0) throw new Error("no_input");

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
        temperature: 0.7,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: SYSTEM + (input.context ?? ""),
          },
          {
            role: "user",
            content: `${parts.join("\n\n")}\n\nWrite the script.`,
          },
        ],
      }),
    },
    {
      timeoutMs: PROVIDER_TIMEOUT_MS,
      maxBytes: MAX_PROVIDER_RESPONSE_BYTES,
      signal,
    },
  );
  if (!response.ok) throw new Error(`generate_${response.status}`);
  return parseScript(data.choices?.[0]?.message?.content ?? "{}");
}
