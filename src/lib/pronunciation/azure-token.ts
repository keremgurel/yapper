/** Where the Speech resource lives, or null when it is not configured. */
export function speechCredentials(): { key: string; region: string } | null {
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  return key && region ? { key, region } : null;
}

/**
 * Exchange the subscription key for a token the browser can use for about ten
 * minutes. The key itself is never sent to a client.
 */
export async function issueSpeechToken(credentials: {
  key: string;
  region: string;
}): Promise<string> {
  const response = await fetch(
    `https://${credentials.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": credentials.key,
        "Content-Length": "0",
      },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!response.ok) throw new Error(`speech_token_${response.status}`);
  return response.text();
}
