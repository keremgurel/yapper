import { projectContextSection } from "@/lib/content/project-context";
import type {
  IdeaExpansion,
  IdeaExpansionSection,
  IdeaInput,
  IdeaSectionKind,
  IdeaType,
} from "@/lib/ideas/types";

/** The creator's standing context, as the prompt builders consume it. */
export interface PromptContext {
  /** The compiled context block, "" when the creator has filled nothing in. */
  block: string;
  /** Pillar names, used only to decide whether to emit the classify rule; the
   * names themselves already live in the block. */
  pillarNames: string[];
}

export const EMPTY_PROMPT_CONTEXT: PromptContext = {
  block: "",
  pillarNames: [],
};

/**
 * Build the chat messages that turn a raw idea into a faithful reference
 * dossier. The model chooses sections that fit the source instead of forcing
 * every reference through an educational talking-head template.
 * Kept pure and separate from the network call so the prompt and the parser can
 * both be tested without hitting a provider.
 */
export function buildExpandMessages(
  input: IdeaInput,
  type: IdeaType,
  context: PromptContext = EMPTY_PROMPT_CONTEXT,
): { system: string; user: string } {
  const system =
    "You are a sharp short-form creative director. Analyze the reference in " +
    "its ACTUAL creative form and preserve what makes it work. It may be a " +
    "sketch, reaction, meme, performance, trend, dialogue, audio-led joke, " +
    "screen recording, story, montage, or educational monologue. Never force " +
    "it into a talking-head lesson or invent a 45-90 second script unless that " +
    "is genuinely the source format. Return STRICT JSON only, no prose or code " +
    "fences:\n" +
    '{"title":"<=8 words, specific, no quotes",' +
    '"pillar":"best-fit pillar or null",' +
    '"format":"specific creative format, e.g. audio-led reaction sketch",' +
    '"summary":"2-4 sentences explaining what happens, what carries the idea, and the adaptation angle",' +
    '"sections":[{"label":"a reference-specific label",' +
    '"kind":"paragraph|bullets|steps|script",' +
    '"text":"for paragraph or script",' +
    '"items":["for bullets or steps"]}]}\n\n' +
    "Rules:\n" +
    "- First identify what literally happens in the source and which layer " +
    "carries it: source audio/dialogue, acting, timing, on-screen text, edit, " +
    "or visual reveal.\n" +
    "- Keep the creator's angle and meaning. Do not convert the topic into a " +
    "generic explainer.\n" +
    "- Choose 2-6 useful sections whose labels fit THIS reference. Examples " +
    "include Reference breakdown, Joke mechanics, Beat-by-beat, What to keep, " +
    "CELPIP adaptation, Audio/dialogue, Shot plan, or Draft—but use only what " +
    "actually helps.\n" +
    "- For a recreation, separate the source's reusable mechanism from the new " +
    "topic. Preserve reactions, pauses, escalation, and audio cues when those " +
    "are the point.\n" +
    "- If a reference transcript is supplied, treat it as evidence and cover " +
    "its important beats. If it is absent, never invent exact dialogue from the " +
    "source; say what is inferred from the title and creator context.\n" +
    "- If a source summary is supplied, this is a written resource rather than " +
    "a video transcript. Preserve its claims, findings, examples, and uncertainty, " +
    "then explain how those ideas can become content without pretending the source " +
    "had dialogue, shots, or edit beats.\n" +
    "- A script section may include dialogue or audio cues when appropriate. " +
    "It does not have to be first-person narration.\n" +
    "- Omit empty sections and generic marketing filler.\n" +
    // The pillar names are already in the context block below; naming them
    // again here would spend tokens restating what the model can already read.
    (context.pillarNames.length
      ? "- Set pillar to the best fit from the creator's PILLARS list below, " +
        "copied verbatim. Only invent a new pillar if none fit.\n"
      : "") +
    "- Say plainly why this could land with THIS creator's audience.\n" +
    "- Output JSON and nothing else." +
    projectContextSection(context.block);

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
  if (input.source?.summary)
    parts.push(`Source summary:\n${input.source.summary}`);
  if (input.source?.referenceType)
    parts.push(`Source type: ${input.source.referenceType}`);
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

const SECTION_KINDS = new Set<IdeaSectionKind>([
  "paragraph",
  "bullets",
  "steps",
  "script",
]);

function sections(v: unknown): IdeaExpansionSection[] {
  if (!Array.isArray(v)) return [];
  return v
    .flatMap((entry): IdeaExpansionSection[] => {
      if (!entry || typeof entry !== "object") return [];
      const value = entry as Record<string, unknown>;
      const label =
        typeof value.label === "string" ? value.label.trim().slice(0, 80) : "";
      const kind =
        typeof value.kind === "string" &&
        SECTION_KINDS.has(value.kind as IdeaSectionKind)
          ? (value.kind as IdeaSectionKind)
          : null;
      const text =
        typeof value.text === "string" ? value.text.trim().slice(0, 12000) : "";
      const items = strArr(value.items, 12);
      if (!label || !kind || (!text && items.length === 0)) return [];
      return [
        {
          label,
          kind,
          text: text || undefined,
          items: items.length ? items : undefined,
        },
      ];
    })
    .slice(0, 8);
}

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
    format:
      typeof obj.format === "string" && obj.format.trim()
        ? obj.format.trim().slice(0, 120)
        : undefined,
    summary:
      typeof obj.summary === "string" && obj.summary.trim()
        ? obj.summary.trim().slice(0, 4000)
        : undefined,
    sections: sections(obj.sections),
    hooks: strArr(obj.hooks, 5),
    outline: strArr(obj.outline, 8),
    keyPoints: strArr(obj.keyPoints, 6),
    script: typeof obj.script === "string" ? obj.script.trim() : "",
  };
}
