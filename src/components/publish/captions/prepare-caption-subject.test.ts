import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeCaptionMedia } from "./prepare-caption-subject";

afterEach(() => vi.unstubAllGlobals());
describe("imported video transcription", () => {
  it("transcribes the stored master and returns its spoken words", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ words: [{ text: "Actual" }, { text: "speech." }] }),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await transcribeCaptionMedia("u/me/import.mp4")).toBe(
      "Actual speech.",
    );
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      mediaKey: "u/me/import.mp4",
    });
  });
  it.each([
    Response.json({ words: [] }),
    Response.json({ error: "failed" }, { status: 502 }),
  ])(
    "refuses to generate from a failed or empty transcript",
    async (response) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      await expect(transcribeCaptionMedia("u/me/import.mp4")).rejects.toThrow(
        "caption_transcript_failed",
      );
    },
  );
});
