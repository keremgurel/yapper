import { auth } from "@clerk/nextjs/server";
import {
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import {
  parsePlacements,
  parseSounds,
  parseTexts,
} from "@/lib/studio/overlay-plan";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  /** What the user asked for, in their own words. */
  instruction?: string;
  /** The transcript, in order. Only the text is sent; timings stay client-side. */
  words?: { text: string }[];
  /** The media they @mentioned, by file name. `aspect` is width over height. */
  files?: {
    name: string;
    kind: "video" | "image";
    duration: number;
    aspect?: number;
  }[];
  /** Width over height of the finished video. */
  frameAspect?: number;
  /**
   * Where the speaker's face is over the course of the video, as fractions of
   * the frame from its top left. Found on the client; no frame is ever sent.
   * Absent from the web Studio, which has no detector.
   */
  speaker?: {
    at: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  /**
   * The sound effects the client ships. The model may only name one of these,
   * so the list has to travel with the question. Absent from the web Studio,
   * which has no sound library, and then no sounds are asked for.
   */
  effects?: { id: string; name: string; detail: string }[];
  /**
   * The cutaways already on the timeline, so a sentence about "the overlays we
   * have" is about something the model can see. Without this it read that as a
   * request to place them, and placed every one of them a second time.
   */
  placed?: { name: string; at: number }[];
}

const SYSTEM =
  "You are the editor of a talking-head video. The user names some media and " +
  "says where they want it on screen. You decide which stretch of speech each " +
  "piece of media should play over, as a cutaway laid on top of the speaker, " +
  "and where on the frame it should sit.\n\n" +
  "You are given the transcript as plain speech, a list of media files, the " +
  "shape of the finished frame, and where the speaker's face is over time.\n\n" +
  "For each placement, return the file name and a QUOTE: the speaker's own " +
  "words, copied verbatim from the transcript, marking where that media should " +
  "be on screen. Rules for the quote:\n" +
  "- Copy it EXACTLY as it appears in the transcript. Do not fix grammar, " +
  "punctuation, or wording.\n" +
  "- Between 3 and 20 words. It should start where the media should appear and " +
  "end where it should leave.\n" +
  "- Quote a stretch where the speaker is actually talking about that media's " +
  "subject. A cutaway over the wrong sentence is worse than no cutaway.\n" +
  "- Use a file at most once unless the user asks for more.\n" +
  "- Files already on the timeline are listed below as placed. Do NOT return " +
  "placements for those unless the user is plainly asking for another copy: a " +
  "sentence about what to do WITH the overlays they already have is not a " +
  "request to place them again.\n" +
  "- If nothing in the transcript fits a file, leave that file out. Returning " +
  "no placements is a valid answer.\n\n" +
  "Add a CUE when the media belongs on one word rather than over the whole " +
  'quote: "right as I say Instagram" is a cue of "Instagram". Rules for the ' +
  "cue:\n" +
  "- It must be one or two words copied from inside that placement's own " +
  "quote. A cue outside the quote is ignored.\n" +
  "- The media appears on that word and stays until the end of the quote.\n" +
  "- Leave it out when the media belongs over the whole quoted stretch.\n\n" +
  "Add a GROUP when several files belong together on screen as a row, such as " +
  "one icon per platform being named. Rules for the group:\n" +
  "- Members share a short group label, share one quote, and differ only in " +
  "their cue, so each lands on its own word.\n" +
  "- Give the row's box once, on the first member; the rest is worked out.\n" +
  "- Members are drawn at the same height side by side and leave together, so " +
  "do not try to place them apart yourself.\n\n" +
  "Also return x, y and width: where the overlay sits, as fractions of the " +
  "frame measured from its TOP LEFT corner, where x=0 is the left edge, y=0 is " +
  "the top edge, and width=1 spans the whole frame. Rules for the box:\n" +
  "- Do not cover the face rectangles listed for the seconds the overlay is on " +
  "screen. Covering the speaker's face is the one mistake worth resizing for.\n" +
  "- Never return a height. It is worked out from the width and the file's own " +
  "aspect, so a wide file at width 0.6 in a tall frame is a short strip and " +
  "fits happily above or below a face, while a tall file at the same width is " +
  "a column and belongs beside one.\n" +
  "- Size a card to the empty part of the shot, not to the smallest space it " +
  "would fit in. Somebody talking to camera usually has room above their head " +
  "and beside them, and a card that only covers wall should use it: prefer " +
  "0.55 to 0.8 wide there. A chart or a screenshot with small text is unreadable " +
  "below about 0.5.\n" +
  "- Keep width between 0.3 and 0.8 for a card, and only go under 0.45 when " +
  "the frame is genuinely crowded. Do not shrink a file to make it fit a gap: " +
  "a smaller cutaway is worse than one that grazes a shoulder.\n" +
  "- Use width 1 with x 0 and y 0 only when the user asks for a full-screen " +
  "cutaway, or when the file has the same shape as the frame.\n" +
  "- Leave about 0.04 of clearance from every edge.\n\n" +
  "Sound effects come from a fixed library, listed below. Rules for sound:\n" +
  "- Use the effect's id exactly. Never invent one. If the user asks for a " +
  "sound the library does not have, leave it out rather than substituting.\n" +
  '- A sound on a placement plays as that media appears: {"sound":"pop"}.\n' +
  "- A sound belonging to no media goes in the separate `sounds` list, and " +
  "names its moment ONE of four ways: a quote and cue for the words it lands " +
  'on, `every` set to "cut" for one at every cut in the edit, `every` set to ' +
  '"overlay" for one on every cutaway already on the timeline, or `at` in ' +
  "seconds.\n" +
  '- "A pop on every overlay" is `every` set to "overlay" and NOT a placement: ' +
  "the overlays are already there, and returning them as placements would put " +
  "second copies of them on the timeline. Several effects asked for as a " +
  "mixture are several entries, all with the same `every`, and the client " +
  "deals them round in the order you list them.\n" +
  "- Only use `at` when the user typed a time themselves, and then copy their " +
  "number exactly: 0:12 is 12, 1:05 is 65. Never work a time out for yourself " +
  "from the transcript; use a quote and cue for that. An `at` the user did not " +
  "state is discarded.\n" +
  "- Only add sounds the user actually asked for.\n" +
  "- When they ask for a sound with each overlay, or with every cutaway, that " +
  "means EVERY placement you return carries a `sound`. Do not return a " +
  "placement without one, and do not put those sounds in the separate `sounds` " +
  "list: a sound that belongs to a placement rides on it, so it lands with the " +
  "media however the client ends up timing it.\n" +
  "- Match the sound to what appears: a chart or a graph is `pop` or `whoosh`, " +
  "money or a purchase is `cha-ching`, a reveal is `magic-reveal`, a screen " +
  "recording of an interface is `mouse-click`.\n\n" +
  "ON-SCREEN TEXT is words drawn over the video, in the separate `texts` list. " +
  "Rules for text:\n" +
  "- Every entry quotes the transcript the same way a placement does, and may " +
  "name a cue word inside that quote. The words appear on that word.\n" +
  "- Keep it short. A number, a name, a phrase: it is a label on the shot, not " +
  "a subtitle, and the video already has captions.\n" +
  "- When the user asks for something to be labelled every time they say it " +
  "(“add the percentages”, “label each number”), return one entry per time it " +
  "is said, each quoting its own sentence.\n" +
  "- `until` says how long it stays: leave it out to hold to the end of its " +
  'own quoted sentence, "next" to hold until the following text appears, ' +
  '"end" to hold to the end of the video, or words copied from later in the ' +
  "transcript to hold it until those words are spoken. Copy those words " +
  "exactly, as with any other quote. Never a number of seconds.\n" +
  '- "Hold them all until X" means every entry gets the same `until`.\n\n' +
  'Reply with JSON only, in this shape: {"placements":[{"file":"name.mp4",' +
  '"quote":"exact words from the transcript","cue":"Instagram","group":"icons",' +
  '"sound":"pop","x":0.06,"y":0.05,"width":0.55,' +
  '"reason":"six words on why"}],' +
  '"sounds":[{"effect":"whoosh","every":"cut"}],' +
  '"texts":[{"text":"44%","quote":"exact words from the transcript",' +
  '"cue":"44","until":"next"}]}';

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
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const key = process.env.SURPLUS_API_KEY;
  if (!key) return Response.json({ error: "no_provider" }, { status: 501 });
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.AI_PLACE_MODEL ?? "gpt-5.4-mini";

  const { instruction, words, files, frameAspect, speaker, effects, placed } =
    (await req.json()) as Body;
  if (!Array.isArray(words) || words.length === 0) {
    return Response.json({ error: "no_transcript" }, { status: 400 });
  }
  // Nothing to place and nothing to play means there is no question to ask.
  // Media alone used to be the test, but a sentence can now be entirely about
  // sound, and those clients send an empty bin on purpose.
  const hasFiles = Array.isArray(files) && files.length > 0;
  const hasEffects = Array.isArray(effects) && effects.length > 0;
  if (!hasFiles && !hasEffects) {
    return Response.json({ placements: [], sounds: [] });
  }

  const catalogue = hasFiles
    ? "Media:\n" +
      files
        .map((f) => {
          const shape = f.aspect
            ? `, ${f.aspect.toFixed(2)} wide per tall`
            : "";
          return `- ${f.name} (${f.kind}, ${f.duration.toFixed(1)}s${shape})`;
        })
        .join("\n") +
      "\n\n"
    : "Media: none imported, so return no placements.\n\n";
  const sounds = hasEffects
    ? "Sound library, by id:\n" +
      effects.map((e) => `- ${e.id} (${e.name}: ${e.detail})`).join("\n") +
      "\n\n"
    : "";
  const alreadyPlaced =
    Array.isArray(placed) && placed.length > 0
      ? "Already on the timeline as cutaways:\n" +
        placed.map((p) => `- ${p.name} at ${p.at.toFixed(1)}s`).join("\n") +
        "\n\n"
      : "";
  const transcript = words.map((w) => w.text).join(" ");
  // Where the speaker is, at the handful of moments the client sampled. Left
  // out entirely when there is no detector or no face was found, rather than
  // sent empty: "we did not look" and "nobody is there" are different, and
  // only the first should leave the model free to place anywhere.
  const face =
    Array.isArray(speaker) && speaker.length > 0
      ? "Speaker's face, as fractions of the frame from its top left:\n" +
        speaker
          .map(
            (s) =>
              `- ${s.at.toFixed(1)}s: x ${s.x.toFixed(2)} to ` +
              `${(s.x + s.width).toFixed(2)}, y ${s.y.toFixed(2)} to ` +
              `${(s.y + s.height).toFixed(2)}`,
          )
          .join("\n") +
        "\n\n"
      : "";
  const frame = frameAspect
    ? `Frame shape: ${frameAspect.toFixed(3)} wide per tall.\n\n`
    : "";
  const user =
    frame +
    catalogue +
    alreadyPlaced +
    sounds +
    face +
    `Transcript:\n${transcript}\n\n` +
    `The user says: ${instruction?.trim() || "Place each file where it fits best."}`;

  const access = await reservePaidActionOrResponse(userId, "place_overlays");
  if (access.response) return access.response;
  const { reservation } = access;

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
      throw new Error(`ai_${res.status}`);
    }
    const json = await res.json();
    const reply: string = json?.choices?.[0]?.message?.content ?? "";
    return Response.json({
      placements: parsePlacements(reply),
      sounds: parseSounds(reply, effects?.map((e) => e.id) ?? []),
      texts: parseTexts(reply),
      balance: reservation.balance,
    });
  } catch (e) {
    await refundCreditReservation(
      userId,
      reservation,
      e instanceof Error ? e.message : "ai_failed",
    );
    return Response.json(
      { error: e instanceof Error ? e.message : "ai_failed" },
      { status: 502 },
    );
  }
}
