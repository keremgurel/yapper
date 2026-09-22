import { fetchBoundedJson } from "@/lib/http/outbound";
import type { ProjectTextFieldKey } from "@/lib/project/client";

/**
 * Setting the Brain up from one document.
 *
 * A creator who already wrote down their content system should not retype it
 * into six boxes and a pillar list. The document is read once, and every
 * Essentials field, every pillar, and every section worth keeping as knowledge
 * comes back as a proposal the creator reviews against what is there now.
 * Nothing is saved here; applying is the ordinary project patch and block
 * creates.
 */

export const SETUP_DOCUMENT_MAX = 60_000;
const PROVIDER_TIMEOUT_MS = 70_000;
const MAX_COMPLETION_TOKENS = 4_000;
const MAX_PROVIDER_RESPONSE_BYTES = 512 * 1024;

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

export type SetupEssentialKey = "name" | ProjectTextFieldKey;

export const SETUP_ESSENTIAL_KEYS: SetupEssentialKey[] = [
  "name",
  "whatIMake",
  "audience",
  "voice",
  "scriptingPatterns",
  "offers",
  "doNots",
];

export interface SetupPillar {
  name: string;
  description: string;
  examples: string[];
}

export interface SetupBlock {
  title: string;
  digest: string;
  body: string;
  tags: string[];
  usage: "core" | "auto";
}

export interface BrainSetupProposal {
  essentials: Partial<Record<SetupEssentialKey, string>>;
  pillars: SetupPillar[];
  blocks: SetupBlock[];
  /** What the document did not cover, so the creator knows what to fill by hand. */
  notes: string;
}

export interface BrainSetupInput {
  document: string;
  current: {
    essentials: Partial<Record<SetupEssentialKey, string>>;
    pillars: { name: string; description: string }[];
  };
}

const SYSTEM =
  "A content creator pasted a document that describes their content system: " +
  "who they are, who they make things for, how they sound, what they promote, " +
  "and the pillars their content falls into. Turn it into their app's Brain, " +
  "which every AI feature reads before writing for them.\n\n" +
  "Return STRICT JSON with this shape and nothing else:\n" +
  '{"essentials":{"name":"","whatIMake":"","audience":"","voice":"",' +
  '"scriptingPatterns":"","offers":"","doNots":""},' +
  '"pillars":[{"name":"","description":"","examples":[""]}],' +
  '"blocks":[{"title":"","digest":"","body":"","tags":[""],"usage":"auto"}],' +
  '"notes":""}\n\n' +
  "Essentials: fill only the fields the document actually covers and leave the " +
  "others out entirely. Write each as the creator describing themselves, " +
  "concrete and specific, under 700 characters, using the document's own " +
  "wording where it is good. name is what they call the channel or brand. " +
  "whatIMake is what the content is; when the document lays out pillars or " +
  "formats, summarise them here rather than leaving it empty. audience is who it is for, with the " +
  "behavioural trait that defines them. voice is how they sound and the " +
  "phrases they use. scriptingPatterns is how a script opens, moves and " +
  "closes. offers is what is being promoted. doNots is what must never be " +
  "said or done. Never invent facts the document does not state.\n\n" +
  "Pillars: one entry per content pillar in the document, in the document's " +
  "order. name is the short label. description is one paragraph, under 600 " +
  "characters, covering purpose, format, what belongs and the litmus test, so " +
  "an idea can be classified into it and written to it. examples are up to " +
  "four concrete video ideas or sub-topics the document names, verbatim where " +
  "possible.\n\n" +
  "Blocks: the parts of the document that carry rules or reference detail " +
  "beyond the fields above, such as audience segments, series structures, " +
  "danger zones or litmus tests. Each block is one section: title 2 to 6 " +
  "words, digest ONE line under 110 characters saying what it is and when it " +
  "matters, body the section's substance in the document's words (up to 3000 " +
  "characters), tags 2 to 4 lowercase words, usage 'core' only if it applies " +
  "to every piece the creator makes, otherwise 'auto'. Do not repeat the " +
  "essentials as blocks. Up to eight blocks.\n\n" +
  "notes: one or two sentences on what the document did not cover, or empty.\n\n" +
  "The current Brain is supplied for reference only; the document is the " +
  "source of truth for everything it covers.";

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const tagList = (value: unknown) =>
  (Array.isArray(value) ? value : [])
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 32))
    .filter(Boolean)
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, 4);

/**
 * Guarded against untrusted model output. Anything malformed degrades to an
 * empty section rather than a failed setup, except a reply with nothing in
 * it at all, which is a failure the creator should see.
 */
export function parseSetupProposal(content: string): BrainSetupProposal {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("setup_unparseable");
  const raw = JSON.parse(content.slice(start, end + 1)) as Record<
    string,
    unknown
  >;

  const essentials: BrainSetupProposal["essentials"] = {};
  const rawEssentials =
    raw.essentials && typeof raw.essentials === "object"
      ? (raw.essentials as Record<string, unknown>)
      : {};
  for (const key of SETUP_ESSENTIAL_KEYS) {
    const value = text(rawEssentials[key], key === "name" ? 80 : 1_200);
    if (value) essentials[key] = value;
  }

  const seen = new Set<string>();
  const pillars = (Array.isArray(raw.pillars) ? raw.pillars : [])
    .map((item): SetupPillar | null => {
      if (!item || typeof item !== "object") return null;
      const pillar = item as Record<string, unknown>;
      const name = text(pillar.name, 60);
      if (!name || seen.has(name.toLowerCase())) return null;
      seen.add(name.toLowerCase());
      return {
        name,
        description: text(pillar.description, 1_000),
        examples: (Array.isArray(pillar.examples) ? pillar.examples : [])
          .map((example) => text(example, 160))
          .filter(Boolean)
          .slice(0, 4),
      };
    })
    .filter((pillar): pillar is SetupPillar => pillar !== null)
    .slice(0, 12);

  const blocks = (Array.isArray(raw.blocks) ? raw.blocks : [])
    .map((item): SetupBlock | null => {
      if (!item || typeof item !== "object") return null;
      const block = item as Record<string, unknown>;
      const title = text(block.title, 80);
      const body = text(block.body, 3_000);
      if (!title || !body) return null;
      return {
        title,
        digest: text(block.digest, 200),
        body,
        tags: tagList(block.tags),
        usage: block.usage === "core" ? "core" : "auto",
      };
    })
    .filter((block): block is SetupBlock => block !== null)
    .slice(0, 8);

  if (!Object.keys(essentials).length && !pillars.length && !blocks.length) {
    throw new Error("setup_empty");
  }
  return { essentials, pillars, blocks, notes: text(raw.notes, 400) };
}

export async function proposeBrainSetup(
  input: BrainSetupInput,
  signal?: AbortSignal,
): Promise<BrainSetupProposal> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.AI_BRAIN_SETUP_MODEL ?? "gpt-5.4";

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
        temperature: 0.2,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: JSON.stringify({
              currentBrain: input.current,
              document: input.document.slice(0, SETUP_DOCUMENT_MAX),
            }),
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
  if (!response.ok) throw new Error(`setup_${response.status}`);
  return parseSetupProposal(data.choices?.[0]?.message?.content ?? "{}");
}
