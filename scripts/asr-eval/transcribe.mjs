// Transcribe each take with each provider; save normalized words + timing.
import fs from "node:fs/promises";
const S = process.argv[2];
const takes = process.argv[3].split(",");
const providers = process.argv[4].split(",");
const SURPLUS = (
  process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1"
).replace(/\/$/, "");

async function deepgram(bytes, model) {
  const u = new URL("https://api.deepgram.com/v1/listen");
  u.searchParams.set("model", model);
  u.searchParams.set("smart_format", "true");
  u.searchParams.set("punctuate", "true");
  u.searchParams.set("filler_words", "true");
  const r = await fetch(u, {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": "audio/mp4",
    },
    body: bytes,
  });
  if (!r.ok)
    throw new Error(`deepgram_${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const w = j.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
  return {
    heardSec: j.metadata?.duration,
    words: w.map((x) => ({
      text: x.punctuated_word ?? x.word,
      start: x.start,
      end: x.end,
      conf: x.confidence,
    })),
  };
}
async function openaiLike(bytes, base, key, model, verbose) {
  const form = new FormData();
  form.append("file", new File([bytes], "audio.m4a", { type: "audio/mp4" }));
  form.append("model", model);
  form.append("language", "en");
  if (verbose) {
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
  } else form.append("response_format", "json");
  const r = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!r.ok)
    throw new Error(`asr_${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return {
    heardSec: j.duration,
    text: j.text,
    requestId: r.headers.get("x-request-id"),
    words: (j.words ?? []).map((x) => ({
      text: x.word,
      start: x.start,
      end: x.end,
    })),
  };
}
async function elevenlabs(bytes, model) {
  const form = new FormData();
  form.append("model_id", model);
  form.append("language_code", "en");
  form.append("timestamps_granularity", "word");
  form.append("tag_audio_events", "false");
  form.append("diarize", "false");
  form.append("file", new File([bytes], "audio.m4a", { type: "audio/mp4" }));
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" },
    body: form,
  });
  if (!r.ok)
    throw new Error(`elevenlabs_${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return {
    heardSec: j.audio_duration_secs,
    text: j.text,
    words: (j.words ?? [])
      .filter((w) => w.type === "word" && w.start != null && w.end != null)
      .map((w) => ({
        text: w.text,
        start: w.start,
        end: w.end,
        logprob: w.logprob,
      })),
  };
}
async function xai(bytes) {
  const form = new FormData();
  form.append("model", "grok-voice-transcribe-2.0");
  form.append("language", "en");
  form.append("filler_words", "true");
  // xAI requires the file to be the last field.
  form.append("file", new File([bytes], "audio.m4a", { type: "audio/mp4" }));
  const r = await fetch("https://api.x.ai/v1/stt", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.XAI_API_KEY ?? ""}` },
    body: form,
  });
  if (!r.ok)
    throw new Error(`xai_${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return {
    heardSec: j.duration,
    text: j.text,
    words: (j.words ?? []).map((w) => ({
      text: w.text,
      start: w.start,
      end: w.end,
      conf: w.confidence,
    })),
  };
}
const P = {
  "dg-nova3": (b) => deepgram(b, "nova-3"),
  "dg-nova2": (b) => deepgram(b, "nova-2"),
  "el-scribe2": (b) => elevenlabs(b, "scribe_v2"),
  "el-scribe3": (b) => elevenlabs(b, "scribe_v3"),
  xai: (b) => xai(b),
  "groq-v3": (b) =>
    openaiLike(
      b,
      "https://api.groq.com/openai/v1",
      process.env.GROQ_API_KEY,
      "whisper-large-v3",
      true,
    ),
  "groq-turbo": (b) =>
    openaiLike(
      b,
      "https://api.groq.com/openai/v1",
      process.env.GROQ_API_KEY,
      "whisper-large-v3-turbo",
      true,
    ),
  "sp-scribe": (b) =>
    openaiLike(
      b,
      SURPLUS,
      process.env.SURPLUS_API_KEY,
      "elevenlabs-scribe-v2",
      false,
    ),
  "sp-xai": (b) =>
    openaiLike(
      b,
      SURPLUS,
      process.env.SURPLUS_API_KEY,
      "venice-xai-stt-v1",
      false,
    ),
  "sp-whisper": (b) =>
    openaiLike(
      b,
      SURPLUS,
      process.env.SURPLUS_API_KEY,
      "venice-whisper-large-v3",
      false,
    ),
  "sp-parakeet": (b) =>
    openaiLike(
      b,
      SURPLUS,
      process.env.SURPLUS_API_KEY,
      "venice-parakeet-asr",
      false,
    ),
};
for (const take of takes) {
  const bytes = await fs.readFile(`${S}/audio/${take}.m4a`);
  await Promise.all(
    providers.map(async (p) => {
      const out = `${S}/asr/${take}.${p}.json`;
      try {
        await fs.access(out);
        console.log(take, p, "cached");
        return;
      } catch {}
      const t = performance.now();
      try {
        const res = await P[p](bytes);
        const ms = Math.round(performance.now() - t);
        const text = res.text ?? res.words.map((w) => w.text).join(" ");
        await fs.writeFile(
          out,
          JSON.stringify({ take, provider: p, ms, ...res, text }),
        );
        console.log(
          take,
          p,
          `${ms}ms`,
          `heard ${Number(res.heardSec ?? 0).toFixed(1)}s`,
          `words ${res.words.length || text.trim().split(/\s+/).length}${res.words.length ? "" : " (text only)"}`,
        );
      } catch (e) {
        console.log(take, p, "FAILED", e.message.slice(0, 200));
      }
    }),
  );
}
