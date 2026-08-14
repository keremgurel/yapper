import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OutboundHttpError } from "@/lib/http/outbound";
import { geminiGenerate, uploadFileToGemini } from "@/lib/feedback/gemini";
import { createFeedbackWorkflow } from "@/lib/feedback/workflow";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Gemini feedback egress", () => {
  it("caps generation output and consumes a bounded JSON response", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini_test");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [{ content: { parts: [{ text: '{"score":80}' }] } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await geminiGenerate(
      [{ text: "coach" }],
      "system",
      createFeedbackWorkflow(new AbortController().signal),
    );

    expect(result).toBe('{"score":80}');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      generationConfig: { maxOutputTokens: 2_000 },
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects an oversized generation response", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini_test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, {
          headers: {
            "content-type": "application/json",
            "content-length": String(1024 * 1024 + 1),
          },
        }),
      ),
    );

    await expect(
      geminiGenerate(
        [{ text: "coach" }],
        "system",
        createFeedbackWorkflow(new AbortController().signal),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<OutboundHttpError>>({
        code: "response_too_large",
      }),
    );
  });

  it("does not start generation after the shared workflow expires", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini_test");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const workflow = createFeedbackWorkflow(
      new AbortController().signal,
      1_000,
    );
    vi.spyOn(Date, "now").mockReturnValue(271_000);

    await expect(
      geminiGenerate([{ text: "coach" }], "system", workflow),
    ).rejects.toMatchObject({ code: "timeout" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts a generation request stalled before response headers", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini_test");
    const controller = new AbortController();
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    const generation = geminiGenerate(
      [{ text: "coach" }],
      "system",
      createFeedbackWorkflow(controller.signal),
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    controller.abort(new DOMException("gone", "AbortError"));

    await expect(generation).rejects.toMatchObject({ code: "aborted" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("streams a file upload and avoids polling an already-active file", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini_test");
    const directory = await mkdtemp(join(tmpdir(), "gemini-upload-test-"));
    const filePath = join(directory, "clip.webm");
    await writeFile(filePath, new Uint8Array([1, 2, 3, 4]));
    let uploaded: number[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { "x-goog-upload-url": "https://upload.example/file" },
        }),
      )
      .mockImplementationOnce(async (_url, init: RequestInit) => {
        uploaded = Array.from(
          new Uint8Array(await new Response(init.body).arrayBuffer()),
        );
        return Response.json({
          file: { name: "files/1", uri: "gemini://1", state: "ACTIVE" },
        });
      });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(
        uploadFileToGemini(
          filePath,
          4,
          "video/webm",
          createFeedbackWorkflow(new AbortController().signal),
        ),
      ).resolves.toBe("gemini://1");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(uploaded).toEqual([1, 2, 3, 4]);
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toMatchObject({
      "Content-Length": "4",
      "X-Goog-Upload-Command": "upload, finalize",
    });
  });

  it("aborts processing sleep without starting a poll", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini_test");
    const directory = await mkdtemp(join(tmpdir(), "gemini-abort-test-"));
    const filePath = join(directory, "clip.webm");
    await writeFile(filePath, new Uint8Array([1]));
    const controller = new AbortController();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { "x-goog-upload-url": "https://upload.example/file" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          file: { name: "files/1", uri: "gemini://1", state: "PROCESSING" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const upload = uploadFileToGemini(
      filePath,
      1,
      "video/webm",
      createFeedbackWorkflow(controller.signal),
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    controller.abort(new DOMException("gone", "AbortError"));

    try {
      await expect(upload).rejects.toBeDefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
