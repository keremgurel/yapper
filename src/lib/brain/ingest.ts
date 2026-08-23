import { fetchBoundedJson } from "@/lib/http/outbound";
import type { BrainBlockUsage } from "@/lib/db/schema";
import { brainBlockUsages } from "@/lib/db/schema";

/**
 * Naming what a creator pasted.
 *
 * The shape is already known by the time this runs: `detect.ts` parsed the CSV
 * or found the bullets, for free and in full. What a model is genuinely better
 * at is the part that decides whether the section is ever useful again, which
 * is the title, the one-line digest, and the tags the router will match on.
 *
 * So the model never sees the whole import and never retypes any of it. It sees
 * twenty rows and answers four questions about them.
 */

const PROVIDER_TIMEOUT_MS = 25_000;
const MAX_COMPLETION_TOKENS = 300;
const MAX_PROVIDER_RESPONSE_BYTES = 128 * 1024;

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

export interface IngestProposal {
  title: string;
  digest: string;
  tags: string[];
  usage: BrainBlockUsage;
  sourceLabel: string;
}

const SYSTEM =
  "You are filing something a content creator just pasted into their brain: " +
  "the standing knowledge every AI feature of their app reads before it " +
  "writes for them. You are shown the shape it was parsed into and a sample " +
  "of it, never the whole thing.\n\n" +
  "Give it a title, a digest, tags and a usage level.\n\n" +
  "- title: what the creator would call this, 2 to 6 words. Name the thing, " +
  "not the format. 'Content gaps from TikTok search', never 'Pasted CSV data'.\n" +
  "- digest: ONE line, under 110 characters, that answers 'what is this and " +
  "when would it matter'. This line is the only part of the section that is in " +
  "every prompt, so it has to earn its place. Write the when, not just the " +
  "what: 'search terms with thin answers, use when picking a topic'.\n" +
  "- tags: 2 to 4 lowercase single words the creator would search for. These " +
  "are matched against what they are writing, so use the words that appear in " +
  "the material itself.\n" +
  "- usage: 'core' only for something true of the creator on every single " +
  "piece they make, like who they are talking to or a rule they never break. " +
  "'auto' for reference material worth pulling in when relevant, which is " +
  "almost everything. 'manual' for something they will want occasionally and " +
  "by name.\n" +
  "- sourceLabel: where it came from, if the sample says so. Empty otherwise. " +
  "Never guess a source.\n\n" +
  'Return STRICT JSON only: {"title":"","digest":"","tags":[],"usage":"auto",' +
  '"sourceLabel":""}. No prose outside the JSON.';

const isUsage = (value: unknown): value is BrainBlockUsage =>
  typeof value === "string" &&
  (brainBlockUsages as readonly string[]).includes(value);

/**
 * Guarded against untrusted output. A missing title is the only fatal case,
 * because a section with no name is one the creator cannot find again; every
 * other field degrades to something usable and editable in the preview.
 */
export function parseIngestProposal(content: string): IngestProposal {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("ingest_unparseable");
  const raw = JSON.parse(content.slice(start, end + 1)) as Record<
    string,
    unknown
  >;

  const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

  const title = text(raw.title, 80);
  if (!title) throw new Error("ingest_empty");

  const tags = (Array.isArray(raw.tags) ? raw.tags : [])
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 32))
    .filter(Boolean)
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, 4);

  return {
    title,
    digest: text(raw.digest, 200),
    tags,
    // Never trust a model with 'private': that is the creator's call about
    // their own data, and defaulting it wrong in either direction is a
    // surprise. It is not offered in the prompt and is not accepted here.
    usage: isUsage(raw.usage) && raw.usage !== "private" ? raw.usage : "auto",
    sourceLabel: text(raw.sourceLabel, 120),
  };
}

/** What the naming pass is shown: the shape the browser parsed it into, and a
 * sample of it. Never the import. */
export interface IngestSubject {
  shape: string;
  sample: string;
}

export async function proposeIngest(
  subject: IngestSubject,
  signal?: AbortSignal,
): Promise<IngestProposal> {
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
        // Naming is not a creative task, and the creator is about to see the
        // answer in a preview and edit it. Predictable beats interesting.
        temperature: 0.2,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Parsed as ${subject.shape}.\n\nSample:\n${subject.sample}`,
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
  if (!response.ok) throw new Error(`ingest_${response.status}`);
  return parseIngestProposal(data.choices?.[0]?.message?.content ?? "{}");
}
