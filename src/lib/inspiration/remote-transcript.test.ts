import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readRemoteTranscript,
  transcribeRemoteMedia,
} from "./remote-transcript";

afterEach(() => vi.unstubAllGlobals());

describe("readRemoteTranscript", () => {
  it("reads Deepgram's formatted full transcript", () => {
    expect(
      readRemoteTranscript({
        results: {
          channels: [
            { alternatives: [{ transcript: "The twelve-hook remix." }] },
          ],
        },
      }),
    ).toBe("The twelve-hook remix.");
  });

  it("falls back to punctuated words", () => {
    expect(
      readRemoteTranscript({
        results: {
          channels: [
            {
              alternatives: [
                {
                  words: [
                    { word: "remix", punctuated_word: "Remix" },
                    { word: "this", punctuated_word: "this." },
                  ],
                },
              ],
            },
          ],
        },
      }),
    ).toBe("Remix this.");
  });

  it("returns null when the provider heard no speech", () => {
    expect(readRemoteTranscript({ results: { channels: [] } })).toBeNull();
  });

  it("sends the remote Reel URL directly to Nova-3", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: {
            channels: [{ alternatives: [{ transcript: "Hook remix." }] }],
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      transcribeRemoteMedia("https://cdn/reel.mp4", "secret"),
    ).resolves.toBe("Hook remix.");
    const [requestUrl, init] = fetchMock.mock.calls[0]!;
    const parsedUrl = new URL(String(requestUrl));
    expect(parsedUrl.searchParams.get("model")).toBe("nova-3");
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({ url: "https://cdn/reel.mp4" }),
      headers: {
        Authorization: "Token secret",
        "Content-Type": "application/json",
      },
    });
  });
});
