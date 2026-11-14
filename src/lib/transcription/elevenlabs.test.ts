import { beforeEach, describe, expect, it, vi } from "vitest";

const outbound = vi.hoisted(() => vi.fn());
vi.mock("@/lib/http/outbound", async (original) => ({
  ...(await original<typeof import("@/lib/http/outbound")>()),
  fetchBoundedJson: outbound,
}));

import { scribeKeyterms, viaElevenLabs } from "./elevenlabs";

const audio = new Uint8Array([1, 2, 3]).buffer;
const call = (keyterms: string[] = [], contentType = "audio/mp4") =>
  viaElevenLabs(
    audio,
    "el_test",
    contentType,
    keyterms,
    new AbortController().signal,
    5_000,
  );

beforeEach(() => {
  vi.unstubAllEnvs();
  outbound.mockReset().mockResolvedValue({
    response: new Response(null, { status: 200 }),
    data: { audio_duration_secs: 12.5, words: [] },
  });
});

describe("scribeKeyterms", () => {
  it("drops terms Scribe would refuse the whole request over", () => {
    expect(
      scribeKeyterms([
        "CELPIP",
        "tefpractice.ca",
        "a".repeat(51),
        "one two three four five six",
        "curly {brace}",
        "back\\slash",
        "TEF Canada",
      ]),
    ).toEqual(["CELPIP", "tefpractice.ca", "TEF Canada"]);
  });
});

describe("viaElevenLabs", () => {
  it("asks for verbatim word timings and names the file for its container", async () => {
    await call(["Yapper", "x".repeat(60)], "audio/webm");
    const [url, init, limits] = outbound.mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect(init.headers).toEqual({ "xi-api-key": "el_test" });
    const form = init.body as FormData;
    expect(form.get("model_id")).toBe("scribe_v2");
    expect(form.get("language_code")).toBe("en");
    expect(form.get("timestamps_granularity")).toBe("word");
    expect(form.get("tag_audio_events")).toBe("false");
    expect(form.has("no_verbatim")).toBe(false);
    expect(form.getAll("keyterms")).toEqual(["Yapper"]);
    const file = form.get("file") as File;
    expect(file.name).toBe("audio.webm");
    expect(file.type).toBe("audio/webm");
    expect(limits.timeoutMs).toBe(5_000);
    expect(limits.maxBytes).toBe(4_000_000);
  });

  it("keeps spoken words with both times and nothing else", async () => {
    outbound.mockResolvedValue({
      response: new Response(null, { status: 200 }),
      data: {
        audio_duration_secs: 3.2,
        words: [
          { text: "Alread-", start: 0.1, end: 0.4, type: "word" },
          { text: " ", start: 0.4, end: 0.5, type: "spacing" },
          { text: "(coughs)", start: 0.5, end: 0.9, type: "audio_event" },
          { text: "Already", start: 1.0, end: 1.3, type: "word" },
          { text: "booked", start: null, end: null, type: "word" },
        ],
      },
    });
    await expect(call()).resolves.toEqual({
      heardSec: 3.2,
      words: [
        { text: "Alread-", start: 0.1, end: 0.4 },
        { text: "Already", start: 1.0, end: 1.3 },
      ],
    });
  });

  it("reports no heard audio when the reply carries no duration", async () => {
    outbound.mockResolvedValue({
      response: new Response(null, { status: 200 }),
      data: {},
    });
    await expect(call()).resolves.toEqual({ heardSec: 0, words: [] });
  });

  it("fails with the provider's status so the chain can fall through", async () => {
    outbound.mockResolvedValue({
      response: new Response(null, { status: 429 }),
      data: {},
    });
    await expect(call()).rejects.toThrow("elevenlabs_429");
  });

  it("uses the model named in the environment", async () => {
    vi.stubEnv("ELEVENLABS_STT_MODEL", "scribe_v3");
    await call();
    const form = outbound.mock.calls[0][1].body as FormData;
    expect(form.get("model_id")).toBe("scribe_v3");
  });
});
