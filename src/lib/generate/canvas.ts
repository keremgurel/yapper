import type { ContentBlock } from "@/lib/db/schema";
import { fetchBoundedJson } from "@/lib/http/outbound";
import {
  parseCanvasActions,
  type CanvasAction,
} from "@/lib/content/canvas-actions";

const PROVIDER_TIMEOUT_MS = 40_000;
const MAX_COMPLETION_TOKENS = 1_600;
const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;

interface ChatCompletionResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
}

export interface CanvasAskInput {
  /** The creator's compiled brain, already wrapped and ready to append. */
  context?: string;
  /** What the creator typed into the prompt bar. */
  instruction: string;
  title: string;
  blocks: ContentBlock[];
  hooks: string[];
  /** The creator's own words, which outrank anything written about them. */
  originalNote?: string;
  /** The block the ask is aimed at, when it is aimed at one. */
  target?: number | null;
  source?: {
    title?: string | null;
    url?: string | null;
    excerpt?: string | null;
  };
}

export interface CanvasAskResult {
  actions: CanvasAction[];
  /** One short line Chirpy says about what it did. */
  note: string | null;
}

/**
 * Chirpy writing on the canvas.
 *
 * There is no fixed job here. The creator can ask for a script, five hooks, a
 * section on objections, a tighter version of block 2, or a title. The model
 * answers with actions against the numbered blocks it was shown, and the
 * parser throws away anything that does not fit the document, so the reply
 * can add and rewrite blocks but never damage the ones it was not asked about.
 */
const SYSTEM =
  "You are Chirpy, a writing partner for a short-form video creator. You work " +
  "on a canvas: the creator's piece, as numbered blocks, each with a label and " +
  "a kind (paragraph, bullets, steps, script). The creator tells you what they " +
  "want in plain words. Do exactly that and nothing more.\n\n" +
  "Reply with STRICT JSON only, in this shape:\n" +
  '{"actions":[...],"note":"one short sentence on what you did"}\n' +
  "Each action is one of:\n" +
  '- {"type":"replace","index":N,"block":{"label":"","kind":"...","text":"..."}} ' +
  "rewrites block N. Leave label empty to keep its label.\n" +
  '- {"type":"insert","after":N,"block":{...}} adds a block after N; "after":null puts it first.\n' +
  '- {"type":"append","block":{...}} adds a block at the end.\n' +
  '- {"type":"hooks","options":["..."],"replace":false} offers opening lines. ' +
  "Use this whenever the creator asks for hooks, openers or first lines; each " +
  "option is one spoken sentence.\n" +
  '- {"type":"title","title":"..."} renames the piece, only when asked.\n' +
  "Block fields: label (short, what the block is), kind, and either text " +
  "(paragraph or script) or items (bullets or steps, one string each).\n\n" +
  "Rules:\n" +
  "- A script is the words said aloud, in the creator's voice: contractions, " +
  "short sentences, no headers, no stage directions, no bullet formatting. " +
  'Use kind "script" for it. Unless told a length, 130 to 200 words.\n' +
  "- When the ask names or clearly means an existing block, replace that block. " +
  "When it asks for something new, insert it where it belongs or append it.\n" +
  "- Never rewrite blocks the creator did not ask about. Never return the whole " +
  "document. Prefer one or two actions.\n" +
  "- The creator's own words, when given, carry their angle and meaning; keep " +
  "them over anything a summary says.\n" +
  "- If a reference source is given, draw on it but do not copy it.\n" +
  "- If the ask is a question or a chat rather than a writing task, answer it " +
  'in "note" and return no actions.';

function describe(input: CanvasAskInput): string {
  const blocks = input.blocks.length
    ? input.blocks
        .map((block, index) => {
          const body = block.items?.length
            ? block.items.map((item) => `- ${item}`).join("\n")
            : block.text || "(empty)";
          return `[${index}] ${block.label || "(untitled)"} (${block.kind})\n${body}`;
        })
        .join("\n\n")
    : "(empty)";
  const parts = [
    `Title: ${input.title || "(untitled)"}`,
    input.hooks.length
      ? `Current hooks (first is chosen):\n${input.hooks.map((h) => `- ${h}`).join("\n")}`
      : "",
    input.originalNote?.trim()
      ? `The creator's own words:\n${input.originalNote.trim()}`
      : "",
    input.source?.title || input.source?.url
      ? `Reference: ${input.source.title ?? ""} ${input.source.url ?? ""}`.trim() +
        (input.source.excerpt ? `\n${input.source.excerpt}` : "")
      : "",
    `Canvas:\n${blocks}`,
    input.target !== null && input.target !== undefined
      ? `The ask is about block [${input.target}].`
      : "",
    `The creator asks: ${input.instruction.trim()}`,
  ];
  return parts.filter(Boolean).join("\n\n");
}

function parseReply(content: string, blockCount: number): CanvasAskResult {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("canvas_unparseable");
  let raw: unknown;
  try {
    raw = JSON.parse(content.slice(start, end + 1));
  } catch {
    throw new Error("canvas_unparseable");
  }
  const actions = parseCanvasActions(raw, blockCount);
  const note =
    raw &&
    typeof raw === "object" &&
    typeof (raw as { note?: unknown }).note === "string"
      ? (raw as { note: string }).note.trim().slice(0, 240) || null
      : null;
  // A reply with neither is a wrong-shape answer, not an empty edit. The route
  // charges only when this returns, so throwing keeps it free.
  if (actions.length === 0 && !note) throw new Error("canvas_empty");
  return { actions, note };
}

export async function askCanvas(
  input: CanvasAskInput,
  signal?: AbortSignal,
): Promise<CanvasAskResult> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.GENERATE_MODEL ?? "gpt-5.4-mini";

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
        temperature: 0.6,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM + (input.context ?? "") },
          { role: "user", content: describe(input) },
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
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") throw new Error("canvas_truncated");
  return parseReply(choice?.message?.content ?? "{}", input.blocks.length);
}
