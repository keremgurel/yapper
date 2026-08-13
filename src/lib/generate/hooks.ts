import { projectContextSection } from "@/lib/content/project-context";
import { hookPattern, hookPatternBlock } from "@/lib/content/hook-patterns";
import type { ContentBlock, ContentHook } from "@/lib/db/schema";
import { fetchBoundedJson } from "@/lib/http/outbound";

const PROVIDER_TIMEOUT_MS = 35_000;
const MAX_COMPLETION_TOKENS = 900;
const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;
interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

export interface HooksInput {
  /** The creator's compiled standing context. */
  context?: string;
  title?: string;
  /** What the idea actually is, so the hooks open THIS video. */
  blocks?: ContentBlock[];
  originalNote?: string;
  /** Restrict every hook to one archetype ("three more, all stakes-first"). */
  patternId?: string | null;
  count?: number;
}

const DEFAULT_COUNT = 3;
const MAX_COUNT = 6;

export function buildHooksMessages(input: HooksInput): {
  system: string;
  user: string;
} {
  const only = input.patternId ?? null;
  const count = Math.min(Math.max(input.count ?? DEFAULT_COUNT, 1), MAX_COUNT);

  const system =
    "You write opening lines for short-form video (TikTok/Reels/Shorts). " +
    `Write ${count} hook${count === 1 ? "" : "s"} for the idea below. Return ` +
    "STRICT JSON only, no prose or code fences:\n" +
    '{"hooks":[{"text":"the spoken opening line",' +
    '"pattern":"the pattern id you used",' +
    '"why":"one line on why it works for THIS audience"}]}\n\n' +
    "Rules:\n" +
    (only
      ? `- Every hook must use the "${only}" pattern below. Vary the angle ` +
        "within it; do not drift to another pattern.\n"
      : "- Use a DIFFERENT pattern for each hook, chosen from the list below. " +
        "Three hooks that are the same mechanism reworded are one hook.\n") +
    "- `pattern` must be one of the ids listed, copied exactly.\n" +
    "- A hook is spoken out loud in under 3 seconds. No hashtags, no emoji, " +
    "no stage directions, no quotation marks around the line.\n" +
    "- Be concrete. A hook that would fit any video in the niche is a bad hook.\n" +
    "- `why` explains the mechanism on this audience, not a restatement of the " +
    "hook.\n" +
    "- Output JSON and nothing else." +
    hookPatternBlock(only) +
    projectContextSection(input.context ?? "");

  const parts: string[] = [];
  if (input.title) parts.push(`Title: ${input.title}`);
  if (input.originalNote?.trim()) {
    parts.push(`The creator's own words:\n${input.originalNote.trim()}`);
  }
  (input.blocks ?? []).forEach((block) => {
    const body = block.items?.length
      ? block.items.map((i) => `- ${i}`).join("\n")
      : (block.text ?? "");
    if (body.trim()) parts.push(`${block.label}:\n${body}`);
  });

  return { system, user: `${parts.join("\n\n")}\n\nWrite the hooks.` };
}

/**
 * Parse and sanitize generated hooks.
 *
 * A `pattern` the library does not know is dropped to null rather than stored:
 * a made-up archetype would render as a chip that explains nothing, and the
 * whole point of tagging is that the label means something.
 *
 * Throws when nothing usable came back, because the route charges only when
 * this returns.
 */
export function parseHooks(
  content: string,
  only?: string | null,
): ContentHook[] {
  const s = content.indexOf("{");
  const e = content.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("hooks_unparseable");

  let raw: { hooks?: unknown };
  try {
    raw = JSON.parse(content.slice(s, e + 1)) as { hooks?: unknown };
  } catch {
    throw new Error("hooks_unparseable");
  }

  const hooks = Array.isArray(raw.hooks)
    ? raw.hooks.flatMap((entry): ContentHook[] => {
        if (!entry || typeof entry !== "object") return [];
        const value = entry as Record<string, unknown>;
        const text =
          typeof value.text === "string" ? value.text.trim().slice(0, 300) : "";
        if (!text) return [];
        const claimed =
          typeof value.pattern === "string" ? value.pattern.trim() : "";
        // When one pattern was requested, that is the truth regardless of what
        // the model labelled the line: it was told to write only that.
        const pattern = only
          ? (hookPattern(only)?.id ?? null)
          : (hookPattern(claimed)?.id ?? null);
        const why =
          typeof value.why === "string" ? value.why.trim().slice(0, 300) : "";
        return [{ text, pattern, why: why || null }];
      })
    : [];

  if (!hooks.length) throw new Error("hooks_empty");
  return hooks.slice(0, MAX_COUNT);
}

/** Generate tagged hook variations via the Surplus gateway. */
export async function generateHooks(
  input: HooksInput,
  signal?: AbortSignal,
): Promise<ContentHook[]> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  if (!input.title?.trim() && !input.originalNote?.trim()) {
    throw new Error("no_input");
  }
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.GENERATE_MODEL ?? "gpt-5.4-mini";

  const { system, user } = buildHooksMessages(input);
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
        // Higher than the other calls: hooks should vary between runs, because
        // "give me three more" is the whole interaction.
        temperature: 0.9,
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
  if (!response.ok) throw new Error(`generate_${response.status}`);
  return parseHooks(
    data.choices?.[0]?.message?.content ?? "{}",
    input.patternId ?? null,
  );
}
