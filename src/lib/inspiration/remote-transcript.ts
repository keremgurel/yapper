interface DeepgramWord {
  word?: string;
  punctuated_word?: string;
}

interface DeepgramAlternative {
  transcript?: string;
  words?: DeepgramWord[];
}

/** Extract the complete readable transcript from Deepgram's response. */
export function readRemoteTranscript(payload: unknown): string | null {
  const alternative = (
    payload as {
      results?: { channels?: Array<{ alternatives?: DeepgramAlternative[] }> };
    }
  )?.results?.channels?.[0]?.alternatives?.[0];
  const transcript = alternative?.transcript?.trim();
  if (transcript) return transcript;

  const words = (alternative?.words ?? [])
    .map((word) => word.punctuated_word ?? word.word ?? "")
    .map((word) => word.trim())
    .filter(Boolean);
  return words.length ? words.join(" ") : null;
}

/**
 * Ask Deepgram to transcribe a public remote audio/video URL. Sending the URL
 * directly avoids downloading a Reel into the Next.js function and uploading
 * the same bytes again.
 */
export async function transcribeRemoteMedia(
  mediaUrl: string,
  key: string,
): Promise<string | null> {
  const endpoint = new URL("https://api.deepgram.com/v1/listen");
  endpoint.searchParams.set("model", "nova-3");
  endpoint.searchParams.set("smart_format", "true");
  endpoint.searchParams.set("punctuate", "true");
  endpoint.searchParams.set("filler_words", "true");
  for (const term of ["CELPIP", "Yapper"]) {
    endpoint.searchParams.append("keyterm", term);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: mediaUrl }),
  });
  if (!response.ok) throw new Error(`deepgram_${response.status}`);
  return readRemoteTranscript(await response.json());
}
