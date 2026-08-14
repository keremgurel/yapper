import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uploadYouTubeVideo, youtubeSnippetText } from "@/lib/publish/youtube";
import { createPublishWorkflow } from "@/lib/publish/workflow";

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
    const directory = await mkdtemp(join(tmpdir(), "youtube-upload-test-"));
    const filePath = join(directory, "video.mp4");
    await writeFile(filePath, new Uint8Array([1, 2, 3, 4]));
    let uploadedBytes: number[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { location: "https://upload.example/session" },
        }),
      )
      .mockImplementationOnce(async (_url, init: RequestInit) => {
        uploadedBytes = Array.from(
          new Uint8Array(await new Response(init.body).arrayBuffer()),
        );
        return Response.json({ id: "video-1" }, { status: 200 });
      });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await uploadYouTubeVideo(
        {
          accessToken: "token",
          filePath,
          byteLength: 4,
          contentType: "video/mp4",
          title: "Public video",
        },
        createPublishWorkflow(new AbortController().signal),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const metadata = JSON.parse(String(init.body)) as {
      status: { privacyStatus: string };
    };
    expect(metadata.status.privacyStatus).toBe("public");
    const upload = fetchMock.mock.calls[1][1] as RequestInit;
    expect(upload.headers).toMatchObject({
      "Content-Length": "4",
      "Content-Range": "bytes 0-3/4",
      "Content-Type": "video/mp4",
    });
    expect(uploadedBytes).toEqual([1, 2, 3, 4]);
  });

  it("resumes the same session after an ambiguous provider failure", async () => {
    const directory = await mkdtemp(join(tmpdir(), "youtube-resume-test-"));
    const filePath = join(directory, "video.mp4");
    await writeFile(filePath, new Uint8Array([10, 11, 12, 13, 14, 15]));
    let resumedBytes: number[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { location: "https://upload.example/session" },
        }),
      )
      .mockRejectedValueOnce(new TypeError("connection reset"))
      .mockResolvedValueOnce(
        new Response(null, { status: 308, headers: { range: "bytes=0-2" } }),
      )
      .mockImplementationOnce(async (_url, init: RequestInit) => {
        resumedBytes = Array.from(
          new Uint8Array(await new Response(init.body).arrayBuffer()),
        );
        return Response.json({ id: "video-2" });
      });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(
        uploadYouTubeVideo(
          {
            accessToken: "token",
            filePath,
            byteLength: 6,
            contentType: "video/mp4",
            title: "Resume",
          },
          createPublishWorkflow(new AbortController().signal),
        ),
      ).resolves.toMatchObject({ videoId: "video-2" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect((fetchMock.mock.calls[2][1] as RequestInit).headers).toMatchObject({
      "Content-Length": "0",
      "Content-Range": "bytes */6",
    });
    const resumed = fetchMock.mock.calls[3][1] as RequestInit;
    expect(resumed.headers).toMatchObject({
      "Content-Length": "3",
      "Content-Range": "bytes 3-5/6",
    });
    expect(resumedBytes).toEqual([13, 14, 15]);
  });

  it("does not classify a disconnect racing upload acceptance as failed", async () => {
    const directory = await mkdtemp(join(tmpdir(), "youtube-abort-test-"));
    const filePath = join(directory, "video.mp4");
    await writeFile(filePath, new Uint8Array([1, 2, 3, 4]));
    const controller = new AbortController();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { location: "https://upload.example/session" },
        }),
      )
      .mockImplementationOnce(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    const result = uploadYouTubeVideo(
      {
        accessToken: "token",
        filePath,
        byteLength: 4,
        contentType: "video/mp4",
        title: "Ambiguous",
      },
      createPublishWorkflow(controller.signal),
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    controller.abort();

    try {
      await expect(result).rejects.toMatchObject({
        name: "PublishOutcomeUnknownError",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
