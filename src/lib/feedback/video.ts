import { sanitizeCoaching, type Coaching } from "./coach";
import { geminiGenerate, VIDEO_MODEL } from "./gemini";

const SYSTEM =
  "You are an on-camera delivery coach for short-form video creators. You are " +
  "given a video of someone talking to camera. Judge ON-CAMERA presence: eye " +
  "contact with the lens, framing/composition, facial expression, energy/" +
  "enthusiasm, hand gestures/body language, posture, and background. Also factor " +
  "how their delivery (pace, emphasis, pauses) reads on video. Be specific, warm, " +
  "and concrete — reference what you actually see.\n\n" +
  "Return STRICT JSON only:\n" +
  '{"score": <0-100 overall on-camera delivery>, "summary": "<2-3 sentence read>", ' +
  '"strengths": ["..."], "improvements": ["..."], ' +
  '"upgradeLines": [{"before":"<a moment/habit>","after":"<what to do instead>"}]}\n' +
  "3-5 items in strengths/improvements; 2-4 upgradeLines framed as concrete " +
  "on-camera adjustments. No prose outside the JSON.";

/** Parse + sanitize the video model's coaching JSON. Exported for testing. */
export function parseVideoCoaching(content: string): Coaching {
  const s = content.indexOf("{");
  const e = content.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("video_unparseable");
  const coaching = sanitizeCoaching(
    JSON.parse(content.slice(s, e + 1)) as Record<string, unknown>,
  );
  if (!coaching.summary && coaching.strengths.length === 0) {
    throw new Error("video_empty");
  }
  return coaching;
}

/** On-camera coaching from a Gemini-hosted video file (native video + audio). */
export async function coachOnCamera(
  fileUri: string,
  mimeType: string,
): Promise<Coaching> {
  const text = await geminiGenerate(
    [
      { fileData: { fileUri, mimeType } },
      {
        text: "Coach this on-camera delivery. Return the JSON from the system prompt.",
      },
    ],
    SYSTEM,
    VIDEO_MODEL,
  );
  return parseVideoCoaching(text);
}
