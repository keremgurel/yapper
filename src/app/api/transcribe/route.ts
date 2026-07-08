import type { RawWord } from "@/lib/studio/transcribe-remote";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Backend transcription, returning word-level timings. Runs an ordered failover
 * chain: Deepgram (nova-3) is the transcriber of record; Groq (whisper-large-v3)
 * is the backup, invoked only if Deepgram actually errors at runtime. Both
 * return per-word timings, so either result drives the editor unchanged.
 * Responds 501 when no provider key is configured.
 */
export async function POST(req: Request): Promise<Response> {
  const deepgram = process.env.DEEPGRAM_API_KEY;
  const groq = process.env.GROQ_API_KEY;

  const audio = await req.arrayBuffer();
  if (audio.byteLength === 0) {
    return Response.json({ error: "empty_audio" }, { status: 400 });
  }

  const providers: { name: string; run: () => Promise<RawWord[]> }[] = [];
  if (deepgram) {
    providers.push({
      name: "deepgram",
      run: () => viaDeepgram(audio, deepgram),
    });
  }
  if (groq) {
    providers.push({
      name: "groq",
      run: () =>
        viaOpenAiCompatible(
          audio,
          groq,
          "https://api.groq.com/openai/v1",
          "whisper-large-v3",
        ),
    });
  }
  if (providers.length === 0) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }

  let lastError: unknown;
  for (const provider of providers) {
    try {
      return Response.json({ words: await provider.run() });
    } catch (e) {
      lastError = e;
      console.error(`[transcribe] ${provider.name} failed`, e);
    }
  }
  return Response.json(
    {
      error:
        lastError instanceof Error ? lastError.message : "transcribe_failed",
    },
    { status: 502 },
  );
}

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  punctuated_word?: string;
}

async function viaDeepgram(
  audio: ArrayBuffer,
  key: string,
): Promise<RawWord[]> {
  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true",
    {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": "audio/wav" },
      body: audio,
    },
  );
  if (!res.ok) throw new Error(`deepgram_${res.status}`);
  const json = await res.json();
  const words: DeepgramWord[] =
    json?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
  return words.map((w) => ({
    text: w.punctuated_word ?? w.word,
    start: w.start,
    end: w.end,
  }));
}

interface OpenAiWord {
  word: string;
  start: number;
  end: number;
}

async function viaOpenAiCompatible(
  audio: ArrayBuffer,
  key: string,
  base: string,
  model: string,
): Promise<RawWord[]> {
  const form = new FormData();
  form.append("file", new File([audio], "audio.wav", { type: "audio/wav" }));
  form.append("model", model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`asr_${res.status}`);
  const json = await res.json();
  const words: OpenAiWord[] = json?.words ?? [];
  return words.map((w) => ({ text: w.word, start: w.start, end: w.end }));
}
