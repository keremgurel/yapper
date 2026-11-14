// Deepgram nova-3 over fixed chunks with overlap; merge by ownership midpoint.
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
const [S, takesArg, cfgArg] = process.argv.slice(2);
const cfgs = cfgArg.split(",").map((c) => {
  const [len, ov] = c.split("/").map(Number);
  return { name: `dg-c${len}o${ov}`, len, ov };
});
async function deepgram(bytes) {
  const u = new URL("https://api.deepgram.com/v1/listen");
  for (const [k, v] of [
    ["model", "nova-3"],
    ["smart_format", "true"],
    ["punctuate", "true"],
    ["filler_words", "true"],
  ])
    u.searchParams.set(k, v);
  for (let a = 0; a < 4; a++) {
    const r = await fetch(u, {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "audio/mp4",
      },
      body: bytes,
    });
    if (r.ok) {
      const j = await r.json();
      return {
        dur: j.metadata?.duration ?? 0,
        words: (j.results?.channels?.[0]?.alternatives?.[0]?.words ?? []).map(
          (x) => ({
            text: x.punctuated_word ?? x.word,
            start: x.start,
            end: x.end,
          }),
        ),
      };
    }
    if (r.status !== 429 && r.status < 500)
      throw new Error("deepgram_" + r.status);
    await new Promise((r) => setTimeout(r, 1500 * (a + 1)));
  }
  throw new Error("deepgram_retry_exhausted");
}
for (const take of takesArg.split(",")) {
  const src = `${S}/audio/${take}.m4a`;
  const total = Number(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      src,
    ]).toString(),
  );
  for (const cfg of cfgs) {
    const out = `${S}/asr/${take}.${cfg.name}.json`;
    try {
      await fs.access(out);
      console.log(take, cfg.name, "cached");
      continue;
    } catch {}
    const step = cfg.len - cfg.ov;
    const chunks = [];
    for (let s = 0; s < total - 0.5; s += step) {
      chunks.push({ s, e: Math.min(total, s + cfg.len) });
      if (s + cfg.len >= total) break;
    }
    let billed = 0;
    const results = new Array(chunks.length);
    let next = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (next < chunks.length) {
          const i = next++;
          const c = chunks[i];
          const f = `${S}/chunks/${take}.${cfg.name}.${i}.m4a`;
          execFileSync("ffmpeg", [
            "-v",
            "error",
            "-y",
            "-ss",
            String(c.s),
            "-t",
            String(c.e - c.s),
            "-i",
            src,
            "-c",
            "copy",
            f,
          ]);
          const r = await deepgram(await fs.readFile(f));
          billed += r.dur;
          results[i] = r.words.map((w) => ({
            ...w,
            start: w.start + c.s,
            end: w.end + c.s,
          }));
          await fs.rm(f);
        }
      }),
    );
    const words = [];
    chunks.forEach((c, i) => {
      const lo = i === 0 ? -1 : (c.s + chunks[i - 1].e) / 2;
      const hi = i === chunks.length - 1 ? 1e9 : (chunks[i + 1].s + c.e) / 2;
      for (const w of results[i]) {
        const m = (w.start + w.end) / 2;
        if (m >= lo && m < hi) words.push(w);
      }
    });
    await fs.writeFile(
      out,
      JSON.stringify({
        take,
        provider: cfg.name,
        heardSec: total,
        billedSec: billed,
        words,
        text: words.map((w) => w.text).join(" "),
      }),
    );
    console.log(
      take,
      cfg.name,
      `chunks ${chunks.length}`,
      `billed ${(billed / total).toFixed(2)}x`,
      `words ${words.length}`,
    );
  }
}
