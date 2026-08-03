import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clipDocumentContent,
  publicWebUrl,
  resolveWebResource,
} from "./web-resource";

afterEach(() => {
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

describe("resolveWebResource", () => {
  it("reads the source and stores the provider's faithful summary", async () => {
    vi.stubEnv("SURPLUS_API_KEY", "provider-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            data: {
              title: "The Pause Study",
              content: "Participants who paused deliberately retained more.",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
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
          { status: 200 },
        ),
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
});
