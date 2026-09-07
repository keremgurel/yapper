export const DERIVE_SYSTEM = `You read transcripts of a creator's own short videos and describe how they talk and how they build a video, so an assistant can write new scripts that sound like them.

Return one JSON object with exactly these string fields:
- "voice": how they sound. Tone, pacing, person (I, you, we), sentence length, energy, humour, and two or three signature phrases quoted exactly as they say them. Also what they never do. Two to five plain sentences.
- "scriptingPatterns": how their videos are built. How they open (the first line, quoted), how they move between points, how long they stay on one idea, how they close and what they ask for. Two to five plain sentences.
- "whatIMake": what the channel makes, in one or two sentences, from the evidence only.
- "audience": who the videos speak to, in one or two sentences, from the evidence only.

Rules:
- Describe, do not praise. No adjectives like "engaging" or "authentic".
- Quote real phrases from the transcripts; never invent a catchphrase.
- Write for the creator to read and edit, in second person is wrong: write "You open on..." is wrong too. Write in third person plural about "the scripts" and "the delivery", e.g. "The delivery is fast and dry. Openings name the mistake in the first sentence."
- Plain text only. No markdown, no lists, no em or en dashes. Keep each field under 600 characters.
- If the transcripts do not support a field, return an empty string for it.`;

export interface DeriveSample {
  title: string;
  transcript: string;
}

const SAMPLE_CAP = 4_000;

export function describeSamples(samples: DeriveSample[]): string {
  return samples
    .map((sample, index) => {
      const title = sample.title.trim() || `Video ${index + 1}`;
      const body = sample.transcript.trim().slice(0, SAMPLE_CAP);
      return `VIDEO ${index + 1}: ${title}\n${body}`;
    })
    .join("\n\n");
}
