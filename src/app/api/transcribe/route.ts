import type { RawWord } from "@/lib/studio/transcribe";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Backend transcription. Sends the posted WAV to whichever hosted provider has
 * a key configured (Deepgram > Groq > OpenAI), returning word-level timings.
 * Responds 501 when no key is set, so the client can fall back to on-device.
 */
export async function POST(req: Request): Promise<Response> {
  const deepgram = process.env.DEEPGRAM_API_KEY;
  const groq = process.env.GROQ_API_KEY;
  const openai = process.env.OPENAI_API_KEY;
  if (!deepgram && !groq && !openai) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }

  const audio = await req.arrayBuffer();
  if (audio.byteLength === 0) {
    return Response.json({ error: "empty_audio" }, { status: 400 });
  }

  try {
    let words: RawWord[];
    if (deepgram) words = await viaDeepgram(audio, deepgram);
    else if (groq)
      words = await viaOpenAiCompatible(
        audio,
        groq,
        "https://api.groq.com/openai/v1",
        "whisper-large-v3",
      );
    else
      words = await viaOpenAiCompatible(
        audio,
        openai as string,
        "https://api.openai.com/v1",
        "whisper-1",
      );
    return Response.json({ words });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "transcribe_failed" },
      { status: 502 },
    );
  }
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
    "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true",
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
