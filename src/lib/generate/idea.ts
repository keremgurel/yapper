export interface GeneratedIdea {
  hooks: string[];
  points: string[];
  example: string;
  cta: string;
}

export interface IdeaInput {
  topic?: string;
  sourceTitle?: string;
  transcript?: string;
}

const SYSTEM =
  "You are a short-form video content strategist for creators " +
  "(TikTok/Reels/Shorts). Given a topic or a reference clip, produce ONE tight " +
  "video idea. Return STRICT JSON only:\n" +
  '{"hooks": ["...", "...", "..."], "points": ["...", "..."], ' +
  '"example": "<one vivid example or line the creator can say>", ' +
  '"cta": "<a natural call to action>"}\n' +
  "3 distinct scroll-stopping hook variants (different angles: bold claim, " +
  "question, story open). 3-5 punchy talking points. Keep it concrete and in " +
  "the creator's voice, not corporate. No prose outside the JSON.";

function parseIdea(content: string): GeneratedIdea {
  const s = content.indexOf("{");
  const e = content.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("idea_unparseable");
  const raw = JSON.parse(content.slice(s, e + 1)) as Partial<GeneratedIdea>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const result = {
    hooks: arr(raw.hooks),
    points: arr(raw.points),
    example: typeof raw.example === "string" ? raw.example : "",
    cta: typeof raw.cta === "string" ? raw.cta : "",
  };
  // Empty-but-valid JSON (content filter, wrong shape) must NOT count as success
  // — the route only charges when this returns, so throw to trigger no-charge.
  if (result.hooks.length === 0 && result.points.length === 0) {
    throw new Error("idea_empty");
  }
  return result;
}

/** Generate a video idea (hooks/points/example/cta) via the Surplus gateway. */
export async function generateIdea(input: IdeaInput): Promise<GeneratedIdea> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.GENERATE_MODEL ?? "gpt-5.4-mini";

  const parts = [
    input.topic ? `Topic: ${input.topic}` : "",
    input.sourceTitle ? `Reference clip: ${input.sourceTitle}` : "",
    input.transcript ? `Reference transcript:\n${input.transcript}` : "",
  ].filter(Boolean);
  if (parts.length === 0) throw new Error("no_input");

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `${parts.join("\n\n")}\n\nGenerate the idea.`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`generate_${res.status}`);
  const json = await res.json();
  return parseIdea(json?.choices?.[0]?.message?.content ?? "{}");
}
