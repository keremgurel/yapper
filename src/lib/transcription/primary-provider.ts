/**
 * Which transcriber a take is offered to first.
 *
 * Deepgram unless `TRANSCRIPTION_PRIMARY` is `elevenlabs` and a key for it is
 * set. The others stay in the chain behind it, so turning this on never
 * leaves a take with fewer transcribers than it had. Measured comparison:
 * docs/transcription-and-edit-eval-2026-11.md.
 */
export function elevenLabsPrimaryKey(): string | undefined {
  if (process.env.TRANSCRIPTION_PRIMARY !== "elevenlabs") return undefined;
  return process.env.ELEVENLABS_API_KEY || undefined;
}
