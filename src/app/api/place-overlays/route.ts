import { parsePlacements } from "@/lib/studio/overlay-plan";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  /** What the user asked for, in their own words. */
  instruction?: string;
  /** The transcript, in order. Only the text is sent; timings stay client-side. */
  words?: { text: string }[];
  /** The media they @mentioned, by file name. */
  files?: { name: string; kind: "video" | "image"; duration: number }[];
}

const SYSTEM =
  "You are the editor of a talking-head video. The user names some media and " +
  "says where they want it on screen. You decide which stretch of speech each " +
  "piece of media should play over, as a cutaway laid on top of the speaker.\n\n" +
  "You are given the transcript as plain speech and a list of media files.\n\n" +
  "For each placement, return the file name and a QUOTE: the speaker's own " +
  "words, copied verbatim from the transcript, marking where that media should " +
  "be on screen. Rules for the quote:\n" +
  "- Copy it EXACTLY as it appears in the transcript. Do not fix grammar, " +
  "punctuation, or wording.\n" +
  "- Between 3 and 20 words. It should start where the media should appear and " +
  "end where it should leave.\n" +
  "- Quote a stretch where the speaker is actually talking about that media's " +
  "subject. A cutaway over the wrong sentence is worse than no cutaway.\n" +
  "- Quotes must not overlap each other.\n" +
  "- Use a file at most once unless the user asks for more.\n" +
  "- If nothing in the transcript fits a file, leave that file out. Returning " +
  "no placements is a valid answer.\n\n" +
  'Reply with JSON only, in this shape: {"placements":[{"file":"name.mp4",' +
  '"quote":"exact words from the transcript","reason":"six words on why"}]}';

/**
 * "Show the reddit clip while I talk about the automation."
 *
 * The model picks the stretch of speech, quoted from the transcript, rather
 * than timestamps or word indices: counting either is exactly what a language
 * model is bad at, and an off-by-one there lands a cutaway over the wrong
 * sentence. The client aligns each quote back onto its own word timings and
 * throws away anything the transcript doesn't back, so nothing this route
 * invents can reach the timeline.
 *
 * Responds 501 when no key is configured, like the other AI passes.
 */
export async function POST(req: Request): Promise<Response> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) return Response.json({ error: "no_provider" }, { status: 501 });
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.AI_PLACE_MODEL ?? "gpt-5.4-mini";

  const { instruction, words, files } = (await req.json()) as Body;
  if (!Array.isArray(words) || words.length === 0) {
    return Response.json({ error: "no_transcript" }, { status: 400 });
  }
  if (!Array.isArray(files) || files.length === 0) {
    return Response.json({ placements: [] });
  }

  const catalogue = files
    .map((f) => `- ${f.name} (${f.kind}, ${f.duration.toFixed(1)}s)`)
    .join("\n");
  const transcript = words.map((w) => w.text).join(" ");
  const user =
    `Media:\n${catalogue}\n\n` +
    `Transcript:\n${transcript}\n\n` +
    `The user says: ${instruction?.trim() || "Place each file where it fits best."}`;

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      return Response.json({ error: `ai_${res.status}` }, { status: 502 });
    }
    const json = await res.json();
    const reply: string = json?.choices?.[0]?.message?.content ?? "";
    return Response.json({ placements: parsePlacements(reply) });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "ai_failed" },
      { status: 502 },
    );
  }
}
