/** The conversational "make your own banger from this clip" assistant. Free
 * (no credits) — the ideation front door; deep script generation stays gated in
 * the workbench. Non-streaming for simplicity: one reply per turn. */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Everything we know about the reference clip, fed to the model as context. */
export interface ClipContext {
  title: string;
  platform?: string;
  url?: string;
  caption?: string;
  transcript?: string;
  views?: number;
  likes?: number;
  comments?: number;
  /** How much it overperformed the creator's median (e.g. 8.0). */
  outlierScore?: number;
  creator?: string;
}

export interface BrainstormInput {
  messages: ChatMessage[];
  clip: ClipContext;
  pillars?: string[];
}

const SYSTEM =
  "You are a sharp short-form video strategist helping a creator turn a " +
  "REFERENCE clip into THEIR OWN banger — not a copy. You are collaborative, " +
  "concrete, and punchy; never generic or corporate.\n\n" +
  "On the FIRST assistant turn, analyze the reference clip:\n" +
  "1. The hook — what it is and the exact mechanism that makes it stop the scroll.\n" +
  "2. The structure — the beats/pacing that keep people watching.\n" +
  "3. Why it performed — reason from the stats if given (a high outlier multiple " +
  "means the hook/topic overperformed the creator's norm).\n" +
  "4. Then propose 2-3 CONCRETE angles the user could take to make their own " +
  "version in their voice, each with a sample hook line.\n" +
  "End by asking which angle they want to run with.\n\n" +
  "On later turns: collaborate — sharpen the hook, tighten the beats, offer " +
  "specific lines. Keep replies tight (short paragraphs or bullets). Do NOT write " +
  "a full script unless explicitly asked. Stay in the creator's voice.";

function clipBlock(clip: ClipContext): string {
  const stat = (label: string, v?: number) =>
    typeof v === "number" && v > 0 ? `${label}: ${v.toLocaleString()}` : "";
  return [
    `Reference clip: ${clip.title}`,
    clip.creator ? `Creator: ${clip.creator}` : "",
    clip.platform ? `Platform: ${clip.platform}` : "",
    [
      stat("Views", clip.views),
      stat("Likes", clip.likes),
      stat("Comments", clip.comments),
    ]
      .filter(Boolean)
      .join(" · "),
    clip.outlierScore && clip.outlierScore >= 1.5
      ? `This clip got ${clip.outlierScore.toFixed(1)}x the creator's median views (a strong outlier).`
      : "",
    clip.caption ? `Caption: ${clip.caption}` : "",
    clip.transcript ? `Transcript:\n${clip.transcript.slice(0, 4000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function brainstorm(input: BrainstormInput): Promise<string> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.GENERATE_MODEL ?? "gpt-5.4-mini";

  const pillarsLine = input.pillars?.length
    ? `\n\nThe creator's content pillars: ${input.pillars.join(", ")}.`
    : "";

  const history = input.messages
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `${clipBlock(input.clip)}${pillarsLine}`,
        },
        ...history,
      ],
    }),
  });
  if (!res.ok) throw new Error(`brainstorm_${res.status}`);
  const json = await res.json();
  const reply = json?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("brainstorm_empty");
  }
  return reply.trim();
}
