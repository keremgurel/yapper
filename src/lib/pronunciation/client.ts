import { assessPronunciation } from "./assess";
import { summarizePronunciation } from "./summarize";
import type { PronunciationReport } from "./types";
import { recordingToWav } from "./wav";

/**
 * Score how a recording sounded, from the browser. Every failure (no plan, the
 * service not configured, a format the browser cannot decode, the network)
 * resolves to null: pronunciation is an addition to a report, never a reason
 * for one to fail.
 */
export async function scorePronunciation(
  recording: Blob,
): Promise<PronunciationReport | null> {
  try {
    const response = await fetch("/api/training/speech-token", {
      method: "POST",
    });
    if (!response.ok) return null;
    const auth = (await response.json()) as { token: string; region: string };
    const wav = await recordingToWav(recording);
    return summarizePronunciation(await assessPronunciation(wav, auth));
  } catch {
    return null;
  }
}

/** Attach a finished report to its saved session. Best effort. */
export async function savePronunciation(
  submissionId: string,
  report: PronunciationReport,
): Promise<void> {
  await fetch(`/api/submissions/${submissionId}/pronunciation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(report),
  }).catch(() => {});
}
