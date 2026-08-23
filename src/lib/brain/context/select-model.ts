import { fetchBoundedJson } from "@/lib/http/outbound";
import { MAX_LOADED_BLOCKS, MAX_LOADED_SKILLS } from "./budgets";
import type { BrainIndex } from "./digest";
import { clamp } from "./text";
import type { BrainSelection, BrainSurface } from "./types";

/**
 * The router: a small model reading the index and saying what this task needs.
 *
 * Rules can only match words. A creator who imported "Q3 audience survey" and
 * is writing about why nobody finishes their videos gets nothing from word
 * overlap and everything from a model that understands the survey is about
 * their audience. That gap is why this exists.
 *
 * It is an optimizer, never a dependency. Everything here is built so that the
 * worst case is the deterministic path: an aggressive timeout, a tiny output,
 * no retries, and a caller that treats any failure as "use the rules". A
 * generation must never fail because routing did.
 */

// Short on purpose. Past this the router is costing the creator more time than
// a slightly worse selection would cost them quality.
const ROUTER_TIMEOUT_MS = 4_000;
const MAX_COMPLETION_TOKENS = 160;
const MAX_PROVIDER_RESPONSE_BYTES = 64 * 1024;
const TASK_CAP = 1_200;

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

// Constant, so it caches as a prompt prefix on the provider side across every
// creator and every call.
const SYSTEM =
  "You route a content creator's stored knowledge into the prompt that is " +
  "about to run. You are given an index of the skills and reference sections " +
  "in their brain, the surface being written, and the task text. Choose only " +
  "what genuinely changes the output.\n\n" +
  "Rules:\n" +
  "- Return refs exactly as they appear in the index, in square brackets " +
  "without the brackets. Never invent a ref.\n" +
  `- At most ${MAX_LOADED_SKILLS} skills and ${MAX_LOADED_BLOCKS} sections. ` +
  "Fewer is better; an empty list is a valid answer.\n" +
  "- A skill is worth loading when its procedure would change how this " +
  "specific piece is written, not merely because it matches the surface.\n" +
  "- A section is worth loading when the task is about what is in it. Do not " +
  "load a reference list just because it is large.\n" +
  '- Return STRICT JSON only: {"skills":["s1"],"context":["c2"]}. No prose.';

/** Guarded against untrusted output: unknown refs are dropped rather than
 * carried into a lookup that would silently load nothing. */
export function parseRouterReply(
  content: string,
  index: BrainIndex,
): BrainSelection {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("router_unparseable");
  const raw = JSON.parse(content.slice(start, end + 1)) as Record<
    string,
    unknown
  >;

  const refs = (value: unknown, type: "skill" | "context", max: number) =>
    (Array.isArray(value) ? value : [])
      .filter((ref): ref is string => typeof ref === "string")
      .map((ref) => ref.trim().replace(/^\[|\]$/g, ""))
      .filter((ref) =>
        index.entries.some((entry) => entry.ref === ref && entry.type === type),
      )
      .filter((ref, position, all) => all.indexOf(ref) === position)
      .slice(0, max);

  return {
    skillRefs: refs(raw.skills, "skill", MAX_LOADED_SKILLS),
    contextRefs: refs(raw.context, "context", MAX_LOADED_BLOCKS),
    by: "model",
  };
}

export interface RouterInput {
  index: BrainIndex;
  surface: BrainSurface;
  task: string;
}

/**
 * Ask the router. Throws on anything unexpected, which is the signal for the
 * caller to fall back; it never returns a partial or guessed selection.
 */
export async function selectByModel(
  input: RouterInput,
  signal?: AbortSignal,
): Promise<BrainSelection> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  // Its own variable, so the router can be pointed at something cheaper than
  // the model doing the writing without touching generation quality.
  const model =
    process.env.BRAIN_ROUTER_MODEL ??
    process.env.GENERATE_MODEL ??
    "gpt-5.4-mini";

  const userMsg = [
    `Surface: ${input.surface}`,
    `Index:\n${input.index.text}`,
    `Task:\n${clamp(input.task, TASK_CAP) || "(no task text)"}`,
  ].join("\n\n");

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
        // Zero: the same brain and the same task should route the same way
        // twice, both because it is cacheable and because a creator noticing
        // their gap list was read once and not the next time is a bug report.
        temperature: 0,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
      }),
    },
    {
      timeoutMs: ROUTER_TIMEOUT_MS,
      maxBytes: MAX_PROVIDER_RESPONSE_BYTES,
      signal,
    },
  );
  if (!response.ok) throw new Error(`router_${response.status}`);
  return parseRouterReply(
    data.choices?.[0]?.message?.content ?? "{}",
    input.index,
  );
}
