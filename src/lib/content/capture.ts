/** Turn a rough, spoken-or-typed idea into a structured content-library entry.
 * This is the FREE capture funnel (no credits) — light classification + a
 * concise title and starter hooks. The heavy, credited idea generation still
 * lives in the workbench (lib/generate/idea.ts). */

export interface CapturedIdea {
  title: string;
  /** One-line angle / what makes it worth making. */
  angle: string;
  hooks: string[];
  points: string[];
  /** The pillar we classified it under, chosen from the caller's list (or a
   * sensible new one). */
  pillar?: string;
}

export interface CaptureInput {
  text: string;
  /** The user's existing content pillars, so we classify into one they use. */
  pillars?: string[];
}

const SYSTEM =
  "You are a short-form content strategist. A creator just brain-dumped a rough " +
  "video idea (often messy, spoken out loud). Turn it into a clean library entry. " +
  "Return STRICT JSON only:\n" +
  '{"title":"<=8 words, punchy, no quotes","angle":"one sentence on why it works",' +
  '"hooks":["3 scroll-stopping opener variants"],"points":["2-4 talking points"],' +
  '"pillar":"the single best-fit pillar"}\n' +
  "For pillar: if a list of the creator's pillars is provided, pick the closest " +
  "one VERBATIM; only invent a new short pillar name if none fit. Keep everything " +
  "concrete and in the creator's voice. No prose outside the JSON.";

function parse(content: string, pillars: string[]): CapturedIdea {
  const s = content.indexOf("{");
  const e = content.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("capture_unparseable");
  const raw = JSON.parse(content.slice(s, e + 1)) as Partial<CapturedIdea>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) throw new Error("capture_empty");

  // Snap the pillar back to an existing one when the model paraphrased it.
  let pillar = typeof raw.pillar === "string" ? raw.pillar.trim() : undefined;
  if (pillar && pillars.length) {
    const hit = pillars.find((p) => p.toLowerCase() === pillar!.toLowerCase());
    pillar = hit ?? pillar;
  }

  return {
    title: title.slice(0, 120),
    angle: typeof raw.angle === "string" ? raw.angle.slice(0, 300) : "",
    hooks: arr(raw.hooks).slice(0, 5),
    points: arr(raw.points).slice(0, 6),
    pillar,
  };
}

export async function captureIdea(input: CaptureInput): Promise<CapturedIdea> {
  const text = input.text.trim();
  if (!text) throw new Error("no_input");

  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.GENERATE_MODEL ?? "gpt-5.4-mini";

  const pillars = (input.pillars ?? []).slice(0, 12);
  const userMsg = [
    pillars.length ? `My content pillars: ${pillars.join(", ")}` : "",
    `Rough idea:\n${text.slice(0, 4000)}`,
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
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg },
      ],
    }),
  });
  if (!res.ok) throw new Error(`capture_${res.status}`);
  const json = await res.json();
  return parse(json?.choices?.[0]?.message?.content ?? "{}", pillars);
}
