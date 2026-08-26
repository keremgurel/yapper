import { afterEach, describe, expect, it, vi } from "vitest";
import { generateThumbnail, inlineImage } from "@/lib/publish/thumbnail";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("thumbnail image input", () => {
  it("accepts the image formats sent by the browser", () => {
    expect(inlineImage("data:image/jpeg;base64,YWJj")).toEqual({
      mimeType: "image/jpeg",
      data: "YWJj",
    });
    expect(inlineImage(undefined)).toBeUndefined();
  });

  it("rejects arbitrary data URLs and oversized images", () => {
    expect(() => inlineImage("data:text/html;base64,YWJj")).toThrow(
      "thumbnail_bad_image",
    );
    expect(() =>
      inlineImage(`data:image/png;base64,${"a".repeat(8.5 * 1024 * 1024)}`),
    ).toThrow("thumbnail_image_too_large");
  });
});

describe("Gemini thumbnail generation", () => {
  it("labels frame and reference separately and requests a vertical image", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini_test");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  thought: true,
                  inlineData: { mimeType: "image/png", data: "draft" },
                },
                { inlineData: { mimeType: "image/png", data: "final" } },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateThumbnail({
        prompt: "Bright editorial portrait",
        frame: "data:image/jpeg;base64,ZnJhbWU=",
        reference: "data:image/png;base64,cmVm",
      }),
    ).resolves.toBe("data:image/png;base64,final");

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const request = JSON.parse(String(init.body)) as {
      contents: { parts: { text?: string; inlineData?: unknown }[] }[];
      generationConfig: {
        responseModalities: string[];
        responseFormat: { image: { aspectRatio: string; imageSize: string } };
      };
    };
    expect(
      request.contents[0].parts.map((part) => part.text).filter(Boolean),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Bright editorial portrait"),
        "SELECTED VIDEO FRAME:",
        "EXAMPLE THUMBNAIL (style reference only):",
      ]),
    );
    expect(request.generationConfig).toEqual({
      responseModalities: ["IMAGE"],
      responseFormat: {
        image: {
          aspectRatio: "ASPECT_RATIO_NINE_BY_SIXTEEN",
          imageSize: "IMAGE_SIZE_TWO_K",
        },
      },
    });
  });

  it("fails instead of returning an interim thought image", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini_test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    thought: true,
                    inlineData: { mimeType: "image/png", data: "draft" },
                  },
                ],
              },
            },
          ],
        }),
      ),
    );
    await expect(generateThumbnail({ prompt: "portrait" })).rejects.toThrow(
      "thumbnail_empty",
    );
  });
});
