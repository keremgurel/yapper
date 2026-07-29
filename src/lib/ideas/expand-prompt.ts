import type { IdeaExpansion, IdeaInput, IdeaType } from "@/lib/ideas/types";

/**
 * Build the chat messages that turn a raw idea into a shoot-ready expansion.
 * Kept pure and separate from the network call so the prompt and the parser can
 * both be tested without hitting a provider.
 */
export function buildExpandMessages(
  input: IdeaInput,
  type: IdeaType,
  pillars: string[],
): { system: string; user: string } {
  const system =
    "You are a short-form content strategist for a talking-head creator. " +
    "You turn a raw idea into a shoot-ready plan. Return STRICT JSON only, no " +
    "prose, no code fences:\n" +
    '{"title":"<=8 words, punchy, no quotes",' +
    '"pillar":"the single best-fit content pillar",' +
    '"hooks":["3 scroll-stopping opener lines"],' +
    '"outline":["3-6 ordered beats the video moves through"],' +
    '"keyPoints":["3-5 concrete talking points"],' +
    '"script":"a full first-person teleprompter script, spoken-word, 45-90s"}\n\n' +
    "Rules:\n" +
    "- Keep the creator's angle and meaning. Do not invent a different topic.\n" +
    "- The script is what they will read aloud: natural, spoken, no stage " +
    "directions or headings.\n" +
    (pillars.length
      ? `- Pick pillar from this list when one fits: ${pillars.join(", ")}. ` +
        "Only invent a new pillar if none fit.\n"
      : "") +
    "- Output JSON and nothing else.";

  const parts: string[] = [];
  if (type === "inspiration") {
    parts.push(
      "The creator dropped this as inspiration to riff on (no added take yet).",
    );
  } else if (type === "semi-original") {
    parts.push("The creator dropped a reference and added their own take.");
  } else {
    parts.push("The creator brain-dumped an original idea.");
  }
  if (input.source?.title) parts.push(`Reference title: ${input.source.title}`);
  if (input.source?.transcript)
    parts.push(`Reference transcript:\n${input.source.transcript}`);
  if (input.source?.url) parts.push(`Reference link: ${input.source.url}`);
  if (input.transcript) parts.push(`The creator's words:\n${input.transcript}`);

  return { system, user: parts.join("\n\n") };
}

const strArr = (v: unknown, max: number): string[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, max)
    : [];

/** Strip accidental ```json fences the model sometimes adds despite the rule. */
function unfence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
}

/**
 * Parse a model response into a validated expansion. Tolerant of extra prose or
 * fences around the JSON, and of missing fields (each falls back to a safe
 * empty value) so a partial response never throws into the capture flow.
 */
export function parseExpansion(raw: string): IdeaExpansion | null {
  const text = unfence(raw);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  if (!title) return null;
  const pillar =
    typeof obj.pillar === "string" && obj.pillar.trim()
      ? obj.pillar.trim()
      : null;
  return {
    title: title.slice(0, 120),
    pillar,
    hooks: strArr(obj.hooks, 5),
    outline: strArr(obj.outline, 8),
    keyPoints: strArr(obj.keyPoints, 6),
    script: typeof obj.script === "string" ? obj.script.trim() : "",
  };
}
