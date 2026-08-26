import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planChunks, uploadTikTokDraft } from "./tiktok";
import { createPublishWorkflow } from "./workflow";

const MB = 1024 * 1024;

afterEach(() => vi.unstubAllGlobals());

// Mirror uploadTikTokDraft's PUT loop to reconstruct the byte ranges a plan
// produces, so we can assert they tile the whole file.
function ranges(size: number): [number, number][] {
  const { chunkSize, count } = planChunks(size);
  const out: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const start = i * chunkSize;
    const end = i === count - 1 ? size - 1 : start + chunkSize - 1;
    out.push([start, end]);
  }
  return out;
}

describe("planChunks", () => {
  it("uploads a whole file as one chunk through 64MB", () => {
    expect(planChunks(5 * MB)).toEqual({ chunkSize: 5 * MB, count: 1 });
    expect(planChunks(64 * MB)).toEqual({ chunkSize: 64 * MB, count: 1 });
  });

  it("uses multiple 32MB chunks for every file over 64MB", () => {
    expect(planChunks(65 * MB)).toEqual({ chunkSize: 32 * MB, count: 2 });
    expect(planChunks(100 * MB)).toEqual({ chunkSize: 32 * MB, count: 3 });
    expect(planChunks(128 * MB)).toEqual({ chunkSize: 32 * MB, count: 4 });
    expect(planChunks(200 * MB)).toEqual({ chunkSize: 32 * MB, count: 6 });
  });

  it("tiles the whole file with contiguous chunks between 5MB and 64MB", () => {
    for (const size of [5 * MB, 65 * MB, 100 * MB, 200 * MB, 260 * MB + 7]) {
      const rs = ranges(size);
      expect(rs[0][0]).toBe(0);
      expect(rs[rs.length - 1][1]).toBe(size - 1);
      for (let i = 1; i < rs.length; i++) {
        expect(rs[i][0]).toBe(rs[i - 1][1] + 1); // no gap, no overlap
      }
      for (const [s, e] of rs) {
        const len = e - s + 1;
        expect(len).toBeGreaterThan(0);
        expect(len).toBeLessThanOrEqual(64 * MB);
        if (size > 64 * MB) expect(len).toBeGreaterThanOrEqual(5 * MB);
      }
    }
  });
});

describe("uploadTikTokDraft", () => {
  it("streams the announced file range and requires TikTok's final status", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tiktok-upload-test-"));
    const filePath = join(directory, "video.mp4");
    await writeFile(filePath, new Uint8Array([4, 3, 2, 1]));
    let uploadedBytes: number[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            publish_id: "publish-1",
            upload_url: "https://upload.example/tiktok",
          },
        }),
      )
      .mockImplementationOnce(async (_url, init: RequestInit) => {
        uploadedBytes = Array.from(
          new Uint8Array(await new Response(init.body).arrayBuffer()),
        );
        return new Response(null, { status: 201 });
      });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(
        uploadTikTokDraft(
          {
            accessToken: "token",
            filePath,
            byteLength: 4,
            contentType: "video/mp4",
          },
          createPublishWorkflow(new AbortController().signal),
        ),
      ).resolves.toEqual({ publishId: "publish-1" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }

    const init = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    ) as { source_info: { video_size: number; total_chunk_count: number } };
    expect(init.source_info).toMatchObject({
      video_size: 4,
      total_chunk_count: 1,
    });
    const upload = fetchMock.mock.calls[1][1] as RequestInit;
    expect(upload.headers).toMatchObject({
      "Content-Length": "4",
      "Content-Range": "bytes 0-3/4",
    });
    expect(uploadedBytes).toEqual([4, 3, 2, 1]);
  });

  it("resolves an ambiguous final response against the same publish id", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tiktok-status-test-"));
    const filePath = join(directory, "video.mp4");
    await writeFile(filePath, new Uint8Array([4, 3, 2, 1]));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            publish_id: "publish-ambiguous",
            upload_url: "https://upload.example/tiktok",
          },
        }),
      )
      .mockRejectedValueOnce(new TypeError("connection reset"))
      .mockResolvedValueOnce(
        Response.json({
          data: { status: "PROCESSING_UPLOAD", uploaded_bytes: 4 },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(
        uploadTikTokDraft(
          {
            accessToken: "token",
            filePath,
            byteLength: 4,
            contentType: "video/mp4",
          },
          createPublishWorkflow(new AbortController().signal),
        ),
      ).resolves.toEqual({ publishId: "publish-ambiguous" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe(
      "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
    );
    expect(
      JSON.parse(String((fetchMock.mock.calls[2][1] as RequestInit).body)),
    ).toEqual({ publish_id: "publish-ambiguous" });
  });

  it("keeps a disconnect racing final upload in the pending state", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tiktok-abort-test-"));
    const filePath = join(directory, "video.mp4");
    await writeFile(filePath, new Uint8Array([4, 3, 2, 1]));
    const controller = new AbortController();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            publish_id: "publish-aborted",
            upload_url: "https://upload.example/tiktok",
          },
        }),
      )
      .mockImplementationOnce(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    const result = uploadTikTokDraft(
      {
        accessToken: "token",
        filePath,
        byteLength: 4,
        contentType: "video/mp4",
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
