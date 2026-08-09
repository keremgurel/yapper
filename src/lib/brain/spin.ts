import { projectContextSection } from "@/lib/content/project-context";
import type { SpinCombination } from "@/lib/brain/reels";

/**
 * One idea, dealt by the slot machine.
 *
 * Deliberately small. A spin is a nudge, not a script: the creator either likes
 * it enough to send it to the Idea Bank or pulls again, and a wall of text
 * makes both of those decisions slower.
 */
export interface SpunIdea {
  title: string;
  /** Why this could work for this creator specifically. */
  angle: string;
  /** One opener they could actually say out loud. */
  hook: string;
  pillar: string | null;
  /** The combination it came from, so the reels can show what they landed on. */
  combination: SpinCombination;
}

export interface SpinInput {
  combination: SpinCombination;
  /** The creator's compiled standing context. */
  context?: string;
  pillars: string[];
  /** Titles already in their bank and library, so a pull does not deal back
   * something they wrote last week. */
  avoid: string[];
}

const SYSTEM =
  "You deal a single short-form video idea to a creator, for a combination " +
  "they just span on a slot machine. You know them: their context block is " +
  "ground truth, and the idea has to be one THEY could post this week, in " +
  "their voice, to their audience.\n\n" +
  "Rules:\n" +
  "- Honour the pillar, angle and format you were dealt. That is the point of " +
  "the spin; do not quietly write a safer idea in a different shape.\n" +
  "- Be specific to this creator. An idea that any account in the niche could " +
  "post is a failed pull.\n" +
  "- The hook is a line they say out loud in the first two seconds. No " +
  "'in this video', no throat-clearing.\n" +
  "- Never repeat an idea from the avoid list, in substance or in wording.\n\n" +
  'Return STRICT JSON only: {"title":"<=8 words","angle":"one sentence on why ' +
  'this works for them","hook":"the opening line, verbatim","pillar":"the ' +
  'pillar it belongs to"}. No prose outside the JSON.';

/** Guarded against untrusted model output: a spin with no title is a failed
 * pull rather than an empty card on the page. */
export function parseSpunIdea(
  content: string,
  combination: SpinCombination,
  pillars: string[],
): SpunIdea {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("spin_unparseable");
  const raw = JSON.parse(content.slice(start, end + 1)) as Record<
    string,
    unknown
  >;

  const text = (value: unknown, max: number): string =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

  const title = text(raw.title, 120);
  if (!title) throw new Error("spin_empty");

  // Snapped back to a real pillar when the model paraphrased one, so a spun
  // idea sent to the bank lands in a bucket that already exists.
  const claimed = text(raw.pillar, 80);
  const pillar =
    pillars.find((p) => p.toLowerCase() === claimed.toLowerCase()) ??
    (combination.pillar || claimed || null);

  return {
    title,
    angle: text(raw.angle, 400),
    hook: text(raw.hook, 300),
    pillar: pillar || null,
    combination,
  };
}

export async function spinIdea(input: SpinInput): Promise<SpunIdea> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.GENERATE_MODEL ?? "gpt-5.4-mini";

  const { combination } = input;
  const dealt = [
    combination.pillar ? `Pillar: ${combination.pillar}` : "",
    `Angle: ${combination.angle}`,
    `Format: ${combination.format}`,
  ]
    .filter(Boolean)
    .join("\n");

  const userMsg = [
    `You were dealt:\n${dealt}`,
    !input.context && input.pillars.length
      ? `My content pillars: ${input.pillars.join(", ")}`
      : "",
    input.avoid.length
      ? `Already in my bank, do not repeat:\n${input.avoid.map((t) => `- ${t}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      // High, on purpose: the reels already fixed what the idea is about, so
      // the spread here buys variety in the writing rather than in the topic.
      temperature: 0.95,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: SYSTEM + projectContextSection(input.context ?? ""),
        },
        { role: "user", content: userMsg },
      ],
    }),
  });
  if (!res.ok) throw new Error(`spin_${res.status}`);
  const json = await res.json();
  return parseSpunIdea(
    json?.choices?.[0]?.message?.content ?? "{}",
    combination,
    input.pillars,
  );
}
