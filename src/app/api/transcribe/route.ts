import { isAudioTruncated } from "@/lib/studio/transcribe-guard";
import type { RawWord } from "@/lib/studio/transcribe-remote";

export const runtime = "nodejs";
export const maxDuration = 120;

/** An ASR result plus how many seconds of audio the provider actually heard. */
interface AsrResult {
  words: RawWord[];
  heardSec: number;
}

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
  // How many seconds of audio the client built. The proxy/middleware layer caps
  // the request body at `experimental.proxyClientMaxBodySize` and truncates it
  // SILENTLY past that (rewriting Content-Length to the short size, so byte
  // counts can't catch it) — the ASR then transcribes only the first N seconds
  // and the tail of the video goes quietly missing from the transcript. We
  // compare this against the duration the ASR actually heard, below.
  const expectedDuration = Number(req.headers.get("x-audio-duration") ?? 0);
  // Forward the payload's own type (audio/aac for native AAC, audio/wav for
  // decoded PCM) so Deepgram parses the container correctly.
  const contentType = req.headers.get("content-type") || "audio/wav";

  const providers: { name: string; run: () => Promise<AsrResult> }[] = [];
  if (deepgram) {
    providers.push({
      name: "deepgram",
      run: () => viaDeepgram(audio, deepgram, contentType),
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
          contentType,
        ),
    });
  }
  if (providers.length === 0) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }

  let lastError: unknown;
  for (const provider of providers) {
    try {
      const { words, heardSec } = await provider.run();
      if (isAudioTruncated(expectedDuration, heardSec)) {
        // The ASR heard less than the client sent: the body was truncated in
        // transit. Refuse rather than return a transcript missing its tail.
        return Response.json(
          {
            error: "audio_truncated",
            expectedSec: expectedDuration,
            heardSec,
          },
          { status: 413 },
        );
      }
      return Response.json({ words });
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
  contentType: string,
): Promise<AsrResult> {
  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true",
    {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": contentType },
      body: audio,
    },
  );
  if (!res.ok) throw new Error(`deepgram_${res.status}`);
  const json = await res.json();
  const words: DeepgramWord[] =
    json?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
  return {
    // metadata.duration is the length of audio Deepgram actually decoded — the
    // truncation signal.
    heardSec: Number(json?.metadata?.duration ?? 0),
    words: words.map((w) => ({
      text: w.punctuated_word ?? w.word,
      start: w.start,
      end: w.end,
    })),
  };
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
  contentType: string,
): Promise<AsrResult> {
  const ext = contentType.includes("aac") ? "aac" : "wav";
  const form = new FormData();
  form.append("file", new File([audio], `audio.${ext}`, { type: contentType }));
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
  return {
    heardSec: Number(json?.duration ?? 0),
    words: words.map((w) => ({ text: w.word, start: w.start, end: w.end })),
  };
}
