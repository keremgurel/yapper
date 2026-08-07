import { projectContextSection } from "@/lib/content/project-context";
import { parseSections } from "@/lib/ideas/expand-prompt";
import type { IdeaExpansionSection } from "@/lib/ideas/types";

export interface GeneratedIdea {
  hooks: string[];
  /** The body the model chose for THIS idea, not a fixed set of columns. */
  sections: IdeaExpansionSection[];
}

export interface IdeaInput {
  /** The creator's compiled standing context. */
  context?: string;
  topic?: string;
  sourceTitle?: string;
  transcript?: string;
}

const SYSTEM =
  "You are a short-form video content strategist for creators " +
  "(TikTok/Reels/Shorts). Given a topic or a reference clip, produce ONE tight " +
  "video idea. Return STRICT JSON only, no prose or code fences:\n" +
  '{"hooks":["...","...","..."],' +
  '"sections":[{"label":"a label that fits THIS idea",' +
  '"kind":"paragraph|bullets|steps|script",' +
  '"text":"for paragraph or script",' +
  '"items":["for bullets or steps"]}]}\n\n' +
  "Rules:\n" +
  "- 3 distinct scroll-stopping hook variants from different angles (bold " +
  "claim, question, story open).\n" +
  "- Choose 2-5 sections whose labels fit THIS idea. Examples include Key " +
  "points, Beat-by-beat, The example, Shot plan, or Call to action, but use " +
  "only what actually helps. Do not pad with sections that say nothing.\n" +
  "- Keep it concrete and in the creator's voice, not corporate.\n" +
  "- Output JSON and nothing else.";

/**
 * Pull the idea object out of a model response. Exported so its guards can be
 * unit-tested: arrays drop non-strings, and a result with no hooks AND no points
 * throws so the route (which charges only when this returns) never bills a
 * creator for an empty or content-filtered generation.
 */
export function parseIdea(content: string): GeneratedIdea {
  const s = content.indexOf("{");
  const e = content.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("idea_unparseable");
  const raw = JSON.parse(content.slice(s, e + 1)) as Record<string, unknown>;
  const result: GeneratedIdea = {
    hooks: Array.isArray(raw.hooks)
      ? raw.hooks
          .filter((x): x is string => typeof x === "string")
          .map((h) => h.trim())
          .filter(Boolean)
      : [],
    // Same validation the reference expansion uses, so a section means the same
    // thing whichever generator produced it.
    sections: parseSections(raw.sections),
  };
  // Empty-but-valid JSON (content filter, wrong shape) must NOT count as success
  // — the route only charges when this returns, so throw to trigger no-charge.
  if (result.hooks.length === 0 && result.sections.length === 0) {
    throw new Error("idea_empty");
  }
  return result;
}

/** Generate a video idea (hooks plus an adaptive body) via the Surplus gateway. */
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
        {
          role: "system",
          content: SYSTEM + projectContextSection(input.context ?? ""),
        },
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
