import type { VersionFormat } from "@/lib/content/formats";
import { undash } from "@/lib/text/undash";
import type { PromptContext } from "@/lib/ideas/expand-prompt";

/**
 * Writing one format of an idea: a short-form, a long-form or an article,
 * either from another version of the same idea or straight from its source.
 *
 * The shapes follow docs/video-scripting-research.md: long-form is one
 * word-for-word script with `## ` chapter lines and no timestamps, an article
 * answers early and has one section per idea, and a short ends on its payoff.
 * Kept pure so the prompt and the parser can be tested without a provider.
 */

/** What the idea has to work with besides the version being adapted. */
export interface IdeaMaterial {
  title: string;
  note?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  sourceTranscript?: string | null;
  sourceSummary?: string | null;
  recordedTranscript?: string | null;
}

/** An existing version, as the writer of another one reads it. */
export interface VersionSource {
  format: VersionFormat;
  title: string | null;
  /** Hooks for a short; title or headline options for the others. */
  alternatives: string[];
  script: string;
  keyPoints: string[];
}

export interface WrittenVersion {
  title: string;
  /** Short: hooks, the first is used. Long: titles. Article: headlines. */
  alternatives: string[];
  script: string;
  /** Article only: the one line under the headline. */
  dek: string | null;
  keyPoints: string[];
  /** Only on a first draft, where the idea itself is still being filed. */
  pillar: string | null;
  summary: string | null;
}

const NAMES: Record<VersionFormat, string> = {
  short: "short-form video",
  long: "long-form video",
  article: "article",
};

const SHARED_RULES =
  "- Never use em dashes or en dashes; use a comma, a colon, or a new sentence.\n" +
  "- Whoever the material introduces with credentials (a person, brand, study, " +
  "tool, or number) keeps that setup on first mention: who they are and why " +
  "the audience should care, in the material's own specifics.\n" +
  "- Keep the material's strongest specifics: named examples, results, " +
  "numbers. A vaguer paraphrase is a failure.\n" +
  "- Never invent facts, figures, quotes, or stories about real people or " +
  "companies beyond the material. An illustrative example is fine only when " +
  "it is plainly hypothetical ('imagine a startup that...').\n" +
  "- First person only for what the creator's own words or the context block " +
  "support. Never claim the creator did something only a source's creator did; " +
  "attribute it instead.\n" +
  "- Connect beats with 'but' or 'therefore', never 'and then'.\n" +
  "- Plain words. No filler, no hype, no generic marketing lines.\n";

const SHAPES: Record<VersionFormat, string> = {
  short:
    '{"title":"<=8 words","alternatives":["3 to 5 hooks: one spoken sentence each, different mechanisms, the first is the one to use"],' +
    '"script":"everything said AFTER the hook","keyPoints":["3 to 5 bullets"]',
  long:
    '{"title":"the best video title, <=70 characters","alternatives":["the same title plus 2 more options, the best first"],' +
    '"script":"the full spoken script with ## chapter lines","keyPoints":["one bullet per chapter: its claim"]',
  article:
    '{"title":"the headline","alternatives":["the same headline plus 2 more options, the best first"],' +
    '"dek":"one sentence under the headline: who it is for and what they get",' +
    '"script":"the article body in Markdown with ## section headings","keyPoints":["3 to 6 bullets"]',
};

const FORMAT_RULES: Record<VersionFormat, string> = {
  short:
    "- The hook is spoken first and the script continues from it. Never " +
    "restate or paraphrase a hook in the script.\n" +
    "- 80 to 130 spoken words after the hook (about 35 to 55 seconds). Up to " +
    "200 only for a story or a multi-step explainer that needs the room.\n" +
    "- The script's first line says where this is going in one short sentence.\n" +
    "- One idea. Include one specific takeaway a viewer would send to a friend.\n" +
    "- End on the payoff. No outro, no recap.\n" +
    "- Spoken words only: no headers, bullets, or stage directions.\n",
  long:
    "- Word for word, in the creator's voice, ready for a teleprompter: one " +
    "thought per line, paragraphs of one or two sentences.\n" +
    "- Chapters are lines that start with '## ' followed by a 2 to 6 word " +
    "title that states the chapter's claim or question. No timestamps. The " +
    "very first line is a chapter line, and the first chapter is the hook: " +
    "give it a real name, never 'Intro'. Use 4 to 8 chapters.\n" +
    "- First chapter, about 30 seconds: no greeting, no channel name, no 'in " +
    "this video'. The first line delivers or visibly promises what the title " +
    "promises. State the stakes in one sentence and tease the best moment. " +
    "Then say why it matters to this viewer and, where it fits, the common " +
    "belief this video will overturn.\n" +
    "- Put the second strongest point in the first body chapter. Order the " +
    "rest so the stakes rise.\n" +
    "- Every chapter opens with a question or claim that makes the viewer " +
    "want the answer, and closes on a 'but' or 'therefore' line that opens the " +
    "next one. Every point gets a concrete example or a short story.\n" +
    "- The last chapter pays off what the first one opened and calls back to " +
    "its opening line or story. Then one line pointing to a next video that " +
    "answers a question this one raised, and stop. No summary, no 'that's it " +
    "for today', no subscribe request in the first minute.\n" +
    "- Notes that are not spoken go on their own line as [B-ROLL: ...] or " +
    "[ON SCREEN: ...], only where a visual genuinely helps.\n" +
    "- About 150 spoken words a minute. Aim for 8 to 12 minutes unless the " +
    "material clearly supports more or less.\n",
  article:
    "- Markdown body. Open with 2 to 4 short paragraphs, about 120 words in " +
    "all: the question or problem, the common belief, then the answer stated " +
    "plainly. A reader who stops there still has the answer.\n" +
    "- Then 3 to 5 sections, each under a '## ' heading written as a claim, " +
    "each 150 to 250 words, whose first sentence carries the point.\n" +
    "- Add what video cannot carry when the material has it: exact numbers, " +
    "quotes, steps a reader can copy, caveats and edge cases.\n" +
    "- Close with two or three lines that restate the answer and one next " +
    "action. The whole body is 800 to 1,400 words: cut the weakest section " +
    "rather than run long. Written for readers: never mention video, " +
    "viewers, or 'this video', and no open-loop teasers.\n",
};

/** How to carry a version across formats, from the research's repurposing rules. */
function adaptRule(from: VersionFormat, to: VersionFormat): string {
  if (from === to) return "";
  if (to === "short") {
    return (
      "- Take the single strongest idea from the version below with its best " +
      "example and rebuild it as a short: a new hook, one idea, end on the " +
      "payoff. Drop every reference back to other parts ('like I said').\n"
    );
  }
  if (from === "short") {
    return (
      "- The short below is the thesis. Expand it: the stakes, the common " +
      "belief it overturns, 3 to 5 supporting beats each with an example or " +
      "story, the strongest counterargument, and practical steps. Use the " +
      "source material for depth the short had to cut.\n"
    );
  }
  if (to === "article") {
    return (
      "- Keep the video's chapters as sections. Cut everything that exists " +
      "only to hold a viewer: re-hooks, teasers, recaps. Put the answer first.\n"
    );
  }
  return (
    "- Turn the article's sections into chapters. Each section's first " +
    "sentence becomes a spoken claim; cut lists down to the best 3 to 5 items, " +
    "each with a story. Add a cold open and plan the ending first.\n"
  );
}

export function buildVersionMessages(
  target: VersionFormat,
  material: IdeaMaterial,
  from: VersionSource | null,
  context: PromptContext,
): { system: string; user: string } {
  const firstDraft = from === null;
  const shape =
    SHAPES[target] +
    (firstDraft
      ? ',"pillar":"best-fit pillar or null","summary":"2 to 4 sentences: what this piece is and the angle for this creator"}'
      : "}");
  const pillarRule = !firstDraft
    ? ""
    : context.pillarNames.length
      ? "- Set pillar to one name from the creator's PILLARS list below, the " +
        "name before the colon, copied exactly. Pick the closest even if the " +
        "fit is loose; a new one only if nothing fits, as 1 to 3 words.\n"
      : "- Set pillar to a 1 to 3 word label, or null.\n";

  const system =
    `You write the ${NAMES[target]} version of a creator's idea, in their ` +
    "voice, ready to record or publish. Return STRICT JSON only, no prose or " +
    `code fences:\n${shape}\n\nRules:\n` +
    FORMAT_RULES[target] +
    (from ? adaptRule(from.format, target) : "") +
    SHARED_RULES +
    pillarRule +
    "- Output JSON and nothing else." +
    context.section;

  const parts: string[] = [`Idea: ${material.title}`];
  if (from) {
    parts.push(
      [
        `The ${NAMES[from.format]} version to work from:`,
        from.title ? `Title: ${from.title}` : "",
        from.alternatives.length
          ? `${from.format === "short" ? "Hooks" : "Title options"}:\n- ${from.alternatives.join("\n- ")}`
          : "",
        from.script ? `Script:\n${from.script}` : "",
        from.keyPoints.length
          ? `Key points:\n- ${from.keyPoints.join("\n- ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (material.note) parts.push(`The creator's own words:\n${material.note}`);
  if (material.recordedTranscript)
    parts.push(
      `What the creator said on camera:\n${material.recordedTranscript}`,
    );
  if (material.sourceTitle)
    parts.push(`Reference title: ${material.sourceTitle}`);
  if (material.sourceTranscript)
    parts.push(`Reference transcript:\n${material.sourceTranscript}`);
  if (material.sourceSummary)
    parts.push(
      `Reference summary (a written source, not speech):\n${material.sourceSummary}`,
    );
  if (material.sourceUrl) parts.push(`Reference link: ${material.sourceUrl}`);

  return { system, user: parts.join("\n\n") };
}

// Every string the model returns lands on screen, so dashes go here.
const text = (v: unknown, max: number): string =>
  typeof v === "string" ? undash(v.trim()).slice(0, max) : "";

const list = (v: unknown, max: number): string[] =>
  Array.isArray(v)
    ? v
        .map((x) => text(x, 400))
        .filter(Boolean)
        .slice(0, max)
    : [];

/** The model's JSON as a version, or null when it is unusable. */
export function parseVersionOutput(
  target: VersionFormat,
  raw: string,
): WrittenVersion | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const script = text(data.script, 60_000);
  const alternatives = list(data.alternatives, 6);
  const title = text(data.title, 300) || alternatives[0] || "";
  if (!script || !title) return null;
  return {
    title,
    alternatives: alternatives.length ? alternatives : [title],
    script,
    dek: target === "article" ? text(data.dek, 400) || null : null,
    keyPoints: list(data.keyPoints, 8),
    pillar: text(data.pillar, 60) || null,
    summary: text(data.summary, 1200) || null,
  };
}
