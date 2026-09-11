import { afterEach, expect, it, vi } from "vitest";
import { transcribeVoiceCapture } from "./transcribe-capture";
import { VOICE_CAPTURE_DIRECT_UPLOAD_BYTES } from "./capture-media";

afterEach(() => vi.unstubAllGlobals());

it("posts small recordings directly with their audio type", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ words: [{ text: "A" }, { text: "thought" }] }),
    );
  vi.stubGlobal("fetch", fetcher);
  const audio = new Blob(["audio"], { type: "audio/webm;codecs=opus" });
  const { signal } = new AbortController();

  expect(await transcribeVoiceCapture(audio, signal)).toBe("A thought");
  expect(fetcher).toHaveBeenCalledExactlyOnceWith("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "audio/webm" },
    body: audio,
    signal,
  });
});

it.each(["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"])(
  "uploads large %s recordings intact before requesting transcription",
  async (type) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ key: "u/me/asr/take.m4a", url: "https://r2.test/put" }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        Response.json({ words: [{ text: "Everything" }] }),
      );
    vi.stubGlobal("fetch", fetcher);
    const audio = new Blob(
      [new Uint8Array(VOICE_CAPTURE_DIRECT_UPLOAD_BYTES + 1)],
      { type },
    );
    const contentType = type.split(";")[0];
    const { signal } = new AbortController();

    expect(await transcribeVoiceCapture(audio, signal)).toBe("Everything");
    expect(fetcher.mock.calls).toEqual([
      [
        "/api/transcribe/upload-url",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bytes: audio.size, contentType }),
          signal,
        },
      ],
      [
        "https://r2.test/put",
        {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: audio,
          signal,
        },
      ],
      [
        "/api/transcribe",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "u/me/asr/take.m4a", contentType }),
          signal,
        },
      ],
    ]);
  },
);

it("does not request transcription when a large audio upload fails", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ key: "take", url: "https://r2.test/put" }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  const audio = new Blob(
    [new Uint8Array(VOICE_CAPTURE_DIRECT_UPLOAD_BYTES + 1)],
    {
      type: "audio/webm",
    },
  );

  await expect(
    transcribeVoiceCapture(audio, new AbortController().signal),
  ).rejects.toThrow("audio_upload_failed");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
