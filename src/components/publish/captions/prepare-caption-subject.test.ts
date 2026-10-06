import { afterEach, describe, expect, it, vi } from "vitest";
import {
  prepareUploadedCaption,
  transcribeCaptionMedia,
} from "./prepare-caption-subject";

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
    Response.json({ unexpected: true }),
    Response.json({ error: "failed" }, { status: 502 }),
  ])(
    "rejects failed and malformed transcription responses",
    async (response) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      await expect(transcribeCaptionMedia("u/me/import.mp4")).rejects.toThrow(
        "caption_transcript_failed",
      );
    },
  );
});

describe("uploaded video transcript recovery", () => {
  it("recovers a stale pending upload and shares concurrent requests", async () => {
    const item = {
      id: "recover",
      submissionId: "submission",
      transcriptStatus: "pending",
      recordedTranscript: null,
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ item }))
      .mockResolvedValueOnce(
        Response.json({ words: [{ text: "Actual speech" }] }),
      )
      .mockResolvedValueOnce(
        Response.json({
          item: {
            ...item,
            recordedTranscript: "Actual speech",
            transcriptStatus: "ready",
          },
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const [first, second] = await Promise.all([
      prepareUploadedCaption("recover", "submission"),
      prepareUploadedCaption("recover", "submission"),
    ]);
    expect(first).toEqual(second);
    expect(first.transcriptStatus).toBe("ready");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
      submissionId: "submission",
    });
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({
      recordedTranscript: "Actual speech",
      transcriptStatus: "ready",
    });
  });
  it("reuses a recorded transcript without transcribing again", async () => {
    const item = {
      id: "ready",
      submissionId: "submission",
      recordedTranscript: "Already heard",
    };
    const fetcher = vi.fn().mockResolvedValue(Response.json({ item }));
    vi.stubGlobal("fetch", fetcher);
    expect(await prepareUploadedCaption("ready", "submission")).toEqual(item);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("allows retry after failure without saving an empty transcript", async () => {
    const item = {
      id: "retry",
      submissionId: "submission",
      recordedTranscript: null,
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ item }))
      .mockResolvedValueOnce(
        Response.json({ error: "unavailable" }, { status: 502 }),
      )
      .mockResolvedValueOnce(Response.json({ item }))
      .mockResolvedValueOnce(Response.json({ words: [{ text: "Recovered" }] }))
      .mockResolvedValueOnce(
        Response.json({
          item: {
            ...item,
            recordedTranscript: "Recovered",
            transcriptStatus: "ready",
          },
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(prepareUploadedCaption("retry", "submission")).rejects.toThrow(
      "caption_transcript_failed",
    );
    expect(
      (await prepareUploadedCaption("retry", "submission")).recordedTranscript,
    ).toBe("Recovered");
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it("rejects a changed submission before transcribing", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ item: { submissionId: "changed" } }));
    vi.stubGlobal("fetch", fetcher);
    await expect(prepareUploadedCaption("changed", "old")).rejects.toThrow(
      "caption_transcript_failed",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

it("treats successful empty speech as a normal result", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ words: [] })),
  );
  expect(await transcribeCaptionMedia("silent-video")).toBe("");
});
it("persists no speech and reuses that result instead of transcribing again", async () => {
  const item = {
    id: "silent",
    submissionId: "silent-submission",
    transcriptStatus: "pending",
    recordedTranscript: null,
  };
  const ready = { ...item, transcriptStatus: "ready", recordedTranscript: "" };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ item }))
    .mockResolvedValueOnce(Response.json({ words: [] }))
    .mockResolvedValueOnce(Response.json({ item: ready }))
    .mockResolvedValueOnce(Response.json({ item: ready }));
  vi.stubGlobal("fetch", fetcher);
  expect(await prepareUploadedCaption(item.id, item.submissionId)).toEqual(
    ready,
  );
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({
    recordedTranscript: "",
    transcriptStatus: "ready",
  });
  expect(await prepareUploadedCaption(item.id, item.submissionId)).toEqual(
    ready,
  );
  expect(fetcher).toHaveBeenCalledTimes(4);
});
