export interface ScriptInput {
  title?: string;
  hooks?: string[];
  points?: string[];
  example?: string;
  cta?: string;
}

const SYSTEM =
  "You are a short-form video scriptwriter for creators (TikTok/Reels/Shorts). " +
  "Turn the given idea into a tight, spoken-word script the creator reads off a " +
  "teleprompter. Rules: open with the single strongest hook, deliver the key " +
  "points as natural spoken lines (contractions, short sentences, NO bullet " +
  "formatting or headers), weave in the example, end on the CTA. 130-200 words " +
  "(~45-75s spoken). Write ONLY the words to say aloud — no stage directions, " +
  "scene labels, or notes. Return STRICT JSON only: " +
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
export async function generateScript(input: ScriptInput): Promise<string> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.GENERATE_MODEL ?? "gpt-5.4-mini";

  const bullets = (label: string, items?: string[]) =>
    items?.length ? `${label}:\n${items.map((x) => `- ${x}`).join("\n")}` : "";
  const parts = [
    input.title ? `Title: ${input.title}` : "",
    bullets("Hooks", input.hooks),
    bullets("Key points", input.points),
    input.example ? `Example: ${input.example}` : "",
    input.cta ? `CTA: ${input.cta}` : "",
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
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `${parts.join("\n\n")}\n\nWrite the script.`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`generate_${res.status}`);
  const json = await res.json();
  return parseScript(json?.choices?.[0]?.message?.content ?? "{}");
}
