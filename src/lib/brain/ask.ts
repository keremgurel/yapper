import { projectContextSection } from "@/lib/content/project-context";
import { fetchBoundedJson } from "@/lib/http/outbound";

const PROVIDER_TIMEOUT_MS = 35_000;
const MAX_COMPLETION_TOKENS = 1_500;
const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;
interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

export interface AskMessage {
  role: "user" | "assistant";
  content: string;
}

/** A section the coach thinks belongs in the brain, offered rather than
 * written: the brain is the creator's, and nothing goes in it without them
 * saying so. */
export interface BlockSuggestion {
  title: string;
  kind: "note" | "list";
  body: string;
  items: string[];
}

export interface AskReply {
  reply: string;
  suggestions: BlockSuggestion[];
}

export interface AskInput {
  messages: AskMessage[];
  /** The creator's compiled standing context: their brain, as prompts see it. */
  context?: string;
  pillars: string[];
}

const SYSTEM =
  "You are the creator's content coach. You have their brain in front of you: " +
  "what they make, who it is for, how they sound, their pillars, and the " +
  "sections they have written themselves.\n\n" +
  "Answer as a coach who knows this account, not as a search engine. Be " +
  "specific, use what is in the brain, and say plainly when the brain does not " +
  "contain the answer rather than inventing one. Keep replies tight: short " +
  "paragraphs or bullets, no preamble, no restating their context back at " +
  "them.\n\n" +
  "You improve the brain as you go. When the conversation produces something " +
  "worth keeping — a goal they just articulated, a hook pattern that keeps " +
  "working, a rule they want to hold to — offer it as a section. Offer at most " +
  "two, only when they are genuinely new, and never offer one that just " +
  "restates a section they already have.\n\n" +
  'Return STRICT JSON only: {"reply":"your answer in markdown","suggestions":' +
  '[{"title":"<=6 words","kind":"note"|"list","body":"prose, or empty for a ' +
  'list","items":["lines, or empty for a note"]}]}. Use an empty suggestions ' +
  "array when nothing is worth saving. No prose outside the JSON.";

/** Guarded against untrusted output: a reply is required, suggestions are not,
 * and a malformed suggestion is dropped rather than rendered half-built. */
export function parseAskReply(content: string): AskReply {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("ask_unparseable");
  const raw = JSON.parse(content.slice(start, end + 1)) as Record<
    string,
    unknown
  >;

  const reply = typeof raw.reply === "string" ? raw.reply.trim() : "";
  if (!reply) throw new Error("ask_empty");

  const suggestions: BlockSuggestion[] = Array.isArray(raw.suggestions)
    ? raw.suggestions
        .map((value): BlockSuggestion | null => {
          if (!value || typeof value !== "object") return null;
          const candidate = value as Record<string, unknown>;
          const title =
            typeof candidate.title === "string" ? candidate.title.trim() : "";
          if (!title) return null;
          const items = Array.isArray(candidate.items)
            ? candidate.items
                .filter((item): item is string => typeof item === "string")
                .map((item) => item.trim())
                .filter(Boolean)
                .slice(0, 20)
            : [];
          const body =
            typeof candidate.body === "string" ? candidate.body.trim() : "";
          if (!body && !items.length) return null;
          return {
            title: title.slice(0, 80),
            kind: candidate.kind === "list" || items.length ? "list" : "note",
            body: body.slice(0, 2000),
            items,
          };
        })
        .filter(
          (suggestion): suggestion is BlockSuggestion => suggestion !== null,
        )
        .slice(0, 2)
    : [];

  return { reply, suggestions };
}

export async function askBrain(
  input: AskInput,
  signal?: AbortSignal,
): Promise<AskReply> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.GENERATE_MODEL ?? "gpt-5.4-mini";

  const history = input.messages.slice(-12).map((message) => ({
    role: message.role,
    content: message.content.slice(0, 4000),
  }));

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
          {
            role: "system",
            content: SYSTEM + projectContextSection(input.context ?? ""),
          },
          ...history,
        ],
      }),
    },
    {
      timeoutMs: PROVIDER_TIMEOUT_MS,
      maxBytes: MAX_PROVIDER_RESPONSE_BYTES,
      signal,
    },
  );
  if (!response.ok) throw new Error(`ask_${response.status}`);
  return parseAskReply(data.choices?.[0]?.message?.content ?? "{}");
}
