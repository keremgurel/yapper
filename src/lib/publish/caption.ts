export interface CaptionInput {
  title: string;
  context?: string;
  /** Past captions to mimic — present ONLY when the user opts into matching
   * their usual format. Empty/absent means write a clean caption from scratch. */
  styleSamples?: string[];
}

export interface GeneratedCaption {
  title: string;
  description: string;
}

const SYSTEM =
  "You write YouTube Shorts titles and descriptions for a creator. Return " +
  "STRICT JSON only:\n" +
  '{"title": "<= 100 chars, punchy>", "description": "<2-4 lines, natural, ' +
  'may include a few relevant hashtags>"}\n' +
  "Write in the creator's voice, concrete not corporate. No prose outside JSON.";

/**
 * Pull the caption object out of a model response and clamp it to what the
 * platform accepts. Exported so its guards can be unit-tested against untrusted
 * LLM output: titles over 100 chars and descriptions over 5000 are rejected by
 * the YouTube API, and an all-empty result must throw so a paid caller isn't
 * billed for nothing.
 */
export function parseCaption(content: string): GeneratedCaption {
  const s = content.indexOf("{");
  const e = content.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("caption_unparseable");
  const raw = JSON.parse(content.slice(s, e + 1)) as Partial<GeneratedCaption>;
  const title = typeof raw.title === "string" ? raw.title.slice(0, 100) : "";
  const description =
    typeof raw.description === "string" ? raw.description.slice(0, 5000) : "";
  // Empty result must throw so a paid caller isn't charged for nothing.
  if (!title && !description) throw new Error("caption_empty");
  return { title, description };
}

/** Generate a YouTube title + description via the Surplus gateway. When
 * `styleSamples` are supplied, mimic their format; otherwise write fresh. */
export async function generateCaption(
  input: CaptionInput,
): Promise<GeneratedCaption> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.GENERATE_MODEL ?? "gpt-5.4-mini";

  const samples = (input.styleSamples ?? []).filter(Boolean).slice(0, 12);
  const parts = [
    `Video title: ${input.title}`,
    input.context ? `About: ${input.context}` : "",
    samples.length
      ? `Match the format and voice of the creator's recent titles:\n- ${samples.join("\n- ")}`
      : "",
  ].filter(Boolean);

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `${parts.join("\n\n")}\n\nWrite the caption.`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`caption_${res.status}`);
  const json = await res.json();
  return parseCaption(json?.choices?.[0]?.message?.content ?? "{}");
}
