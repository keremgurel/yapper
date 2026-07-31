import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadYouTubeVideo, youtubeSnippetText } from "@/lib/publish/youtube";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("youtubeSnippetText", () => {
  it("strips the angle brackets YouTube's API rejects", () => {
    // "<3" and "A > B" would 400 the upload (invalidTitle) if sent as-is.
    expect(youtubeSnippetText("Follow for more <3", 100)).toBe(
      "Follow for more 3",
    );
    expect(youtubeSnippetText("Before > After", 100)).toBe("Before  After");
    expect(youtubeSnippetText("<script>", 100)).toBe("script");
  });

  it("clamps to the field length limit, after stripping", () => {
    expect(youtubeSnippetText("t".repeat(150), 100)).toHaveLength(100);
    // Brackets are removed before the count, so they don't eat into the budget.
    expect(youtubeSnippetText("<".repeat(50) + "a".repeat(100), 100)).toBe(
      "a".repeat(100),
    );
  });

  it("treats an absent value as an empty string", () => {
    expect(youtubeSnippetText(undefined, 5000)).toBe("");
  });

  it("leaves clean text untouched", () => {
    expect(youtubeSnippetText("My great video", 100)).toBe("My great video");
  });
});

describe("uploadYouTubeVideo", () => {
  it("requests public publishing by default", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { location: "https://upload.example/session" },
        }),
      )
      .mockResolvedValueOnce(Response.json({ id: "video-1" }, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await uploadYouTubeVideo({
      accessToken: "token",
      bytes: new ArrayBuffer(4),
      title: "Public video",
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const metadata = JSON.parse(String(init.body)) as {
      status: { privacyStatus: string };
    };
    expect(metadata.status.privacyStatus).toBe("public");
  });
});
