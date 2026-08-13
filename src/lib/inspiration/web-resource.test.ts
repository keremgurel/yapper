import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clipDocumentContent,
  displayResourceTitle,
  publicWebUrl,
  resolveWebResource,
} from "./web-resource";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("publicWebUrl", () => {
  it("accepts public articles and papers", () => {
    expect(publicWebUrl("https://example.com/article")?.hostname).toBe(
      "example.com",
    );
    expect(publicWebUrl("https://arxiv.org/pdf/1234.5678")).not.toBeNull();
  });

  it("rejects credentials and local/private targets", () => {
    expect(publicWebUrl("https://user:pass@example.com")).toBeNull();
    expect(publicWebUrl("http://localhost:3000/private")).toBeNull();
    expect(publicWebUrl("http://192.168.1.4/notes")).toBeNull();
    expect(publicWebUrl("http://169.254.169.254/latest/meta-data")).toBeNull();
  });
});

describe("clipDocumentContent", () => {
  it("keeps the beginning and conclusion of long papers", () => {
    const content = `ABSTRACT:${"a".repeat(40_000)}CONCLUSION:${"z".repeat(20_000)}`;
    const clipped = clipDocumentContent(content);
    expect(clipped).toContain("ABSTRACT:");
    expect(clipped).toContain("CONCLUSION:");
    expect(clipped).toContain("Middle omitted for length");
    expect(clipped.length).toBeLessThanOrEqual(50_040);
  });
});

describe("displayResourceTitle", () => {
  it("removes the caption payload from Instagram reader titles", () => {
    expect(
      displayResourceTitle(
        'Michel Marcelino on Instagram: "A very long post caption"',
        "instagram.com",
      ),
    ).toBe("Michel Marcelino on Instagram");
  });

  it("keeps ordinary resource titles", () => {
    expect(displayResourceTitle("The Pause Study", "example.com")).toBe(
      "The Pause Study",
    );
  });
});

describe("resolveWebResource", () => {
  it("reads the source and stores the provider's faithful summary", async () => {
    vi.stubEnv("SURPLUS_API_KEY", "provider-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          code: 200,
          data: {
            title: "The Pause Study",
            content: "Participants who paused deliberately retained more.",
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary:
                    "The study reports that deliberate pauses improved recall.",
                  resourceType: "research-paper",
                }),
              },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      resolveWebResource("https://example.com/paper.pdf"),
    ).resolves.toEqual({
      title: "The Pause Study",
      summary: "The study reports that deliberate pauses improved recall.",
      referenceType: "research-paper",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://r.jina.ai/https://example.com/paper.pdf",
    );
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain(
      "Participants who paused deliberately retained more.",
    );
  });

  it("times out a stalled Reader response without starting summarization", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    const fetchMock = vi.fn().mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = resolveWebResource("https://example.com/article");
    timeoutController.abort(new DOMException("timed out", "TimeoutError"));

    await expect(pending).rejects.toMatchObject({ code: "timeout" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects an oversized Reader response before summarization", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(new Uint8Array(2 * 1024 * 1024 + 1), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      resolveWebResource("https://example.com/article"),
    ).rejects.toMatchObject({ code: "response_too_large" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("propagates caller abort during Reader without starting summarization", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = resolveWebResource(
      "https://example.com/article",
      controller.signal,
    );
    controller.abort("client_disconnected");

    await expect(pending).rejects.toMatchObject({ code: "aborted" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not start summarization after the overall workflow deadline", async () => {
    vi.stubEnv("SURPLUS_API_KEY", "provider-secret");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json({
        data: { title: "Slow source", content: "Useful evidence." },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(91_001);

    await expect(
      resolveWebResource("https://example.com/article"),
    ).rejects.toMatchObject({ code: "timeout" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
