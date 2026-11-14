import { describe, expect, it } from "vitest";
import { readAudioUsage } from "./audio-usage";

const bytes = (body: unknown) => new TextEncoder().encode(JSON.stringify(body));
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
};

describe("readAudioUsage", () => {
  it("prices a Deepgram reply by the audio it decoded", () => {
    expect(
      readAudioUsage(
        new URL("https://api.deepgram.com/v1/listen?model=nova-3"),
        { method: "POST" },
        bytes({ metadata: { duration: 120 } }),
      ),
    ).toEqual({ model: "nova-3", audioSeconds: 120, listCostMicrousd: 8_600 });
  });

  it("adds Deepgram's keyterm price when terms were sent", () => {
    for (const param of ["keyterm=Yapper", "keywords=Yapper"])
      expect(
        readAudioUsage(
          new URL(`https://api.deepgram.com/v1/listen?model=nova-3&${param}`),
          { method: "POST" },
          bytes({ metadata: { duration: 60 } }),
        )?.listCostMicrousd,
      ).toBe(5_600);
  });

  it("prices a Scribe reply, a quarter more with keyterms", () => {
    const url = new URL("https://api.elevenlabs.io/v1/speech-to-text");
    const reply = bytes({ audio_duration_secs: 90 });
    expect(
      readAudioUsage(
        url,
        { method: "POST", body: form({ model_id: "scribe_v2" }) },
        reply,
      ),
    ).toEqual({
      model: "scribe_v2",
      audioSeconds: 90,
      listCostMicrousd: 5_000,
    });
    expect(
      readAudioUsage(
        url,
        {
          method: "POST",
          body: form({ model_id: "scribe_v2", keyterms: "Yapper" }),
        },
        reply,
      )?.listCostMicrousd,
    ).toBe(6_250);
  });

  it("prices Groq's whisper and never below its ten second minimum", () => {
    const url = new URL("https://api.groq.com/openai/v1/audio/transcriptions");
    const init = { method: "POST", body: form({ model: "whisper-large-v3" }) };
    expect(readAudioUsage(url, init, bytes({ duration: 600 }))).toEqual({
      model: "whisper-large-v3",
      audioSeconds: 600,
      listCostMicrousd: 18_500,
    });
    expect(
      readAudioUsage(url, init, bytes({ duration: 3 }))?.listCostMicrousd,
    ).toBe(309);
  });

  it("gives no cost for a reply without a usable length", () => {
    const url = new URL("https://api.deepgram.com/v1/listen");
    for (const body of [
      {},
      { metadata: {} },
      { metadata: { duration: 0 } },
      { metadata: { duration: "12" } },
      null,
    ])
      expect(readAudioUsage(url, { method: "POST" }, bytes(body))).toBeNull();
    expect(
      readAudioUsage(
        url,
        { method: "POST" },
        new TextEncoder().encode("<html>"),
      ),
    ).toBeNull();
  });

  it("leaves a transcriber it has no price for alone", () => {
    expect(
      readAudioUsage(
        new URL("https://api.surplusintelligence.ai/v1/audio/transcriptions"),
        { method: "POST" },
        bytes({ duration: 60 }),
      ),
    ).toBeNull();
  });
});
