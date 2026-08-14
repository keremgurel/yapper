import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeForFeedback } from "./transcribe";

afterEach(() => vi.unstubAllGlobals());

describe("feedback Deepgram egress", () => {
  it("passes cancellation and returns bounded word data", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        results: {
          channels: [
            {
              alternatives: [
                {
                  words: [
                    {
                      word: "hello",
                      punctuated_word: "Hello",
                      start: 0,
                      end: 0.5,
                      confidence: 0.9,
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      transcribeForFeedback(
        new Uint8Array([1]).buffer,
        "key",
        controller.signal,
        5_000,
      ),
    ).resolves.toEqual([
      { text: "Hello", start: 0, end: 0.5, confidence: 0.9 },
    ]);
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(
      AbortSignal,
    );
  });

  it("rejects a declared response above two MiB before reading it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, {
          headers: {
            "content-type": "application/json",
            "content-length": String(2 * 1024 * 1024 + 1),
          },
        }),
      ),
    );

    await expect(
      transcribeForFeedback(
        new Uint8Array([1]).buffer,
        "key",
        new AbortController().signal,
        5_000,
      ),
    ).rejects.toMatchObject({ code: "response_too_large" });
  });
});
