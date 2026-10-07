import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateThumbnail, inlineImage } from "@/lib/publish/thumbnail";

const frame = "data:image/jpeg;base64,ZnJhbWU=";
const reference = "data:image/png;base64,cmVm";
let encoded: string;
beforeEach(async () => {
  vi.stubEnv("SURPLUS_API_KEY", "surplus_test");
  vi.stubEnv("GEMINI_API_KEY", "");
  encoded = (
    await sharp({
      create: { width: 90, height: 160, channels: 3, background: "#f97316" },
    })
      .png()
      .toBuffer()
  ).toString("base64");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function provider() {
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ data: [{ b64_json: encoded }] }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("thumbnail image input", () => {
  it("accepts native and browser data URLs", () => {
    expect(inlineImage(frame)).toEqual({
      mimeType: "image/jpeg",
      data: "ZnJhbWU=",
    });
    expect(inlineImage(undefined)).toBeUndefined();
  });
  it("rejects remote URLs, non-images, and oversized images before sending", async () => {
    const fetch = provider();
    for (const value of [
      "https://example.com/image.png",
      "data:text/html;base64,YWJj",
    ]) {
      await expect(
        generateThumbnail({ prompt: "portrait", frame: value }),
      ).rejects.toThrow("thumbnail_bad_image");
    }
    expect(() =>
      inlineImage(`data:image/png;base64,${"a".repeat(8.5 * 1024 * 1024)}`),
    ).toThrow("thumbnail_image_too_large");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Surplus thumbnails", () => {
  it("uses the reference as the editing canvas and the frame as the identity source", async () => {
    const fetch = provider();
    const image = await generateThumbnail({
      prompt: "Building Apps to $10K MRR, Ep. 14",
      frame,
      reference,
    });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.surplusintelligence.ai/v1/images/edits");
    expect(init.headers.Authorization).toBe("Bearer surplus_test");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: "gpt-image-2-edit",
      n: 1,
      quality: "high",
      resolution: "2K",
      aspect_ratio: "9:16",
      response_format: "b64_json",
      input_images: [
        { url: reference, role: "start" },
        { url: frame, role: "reference" },
      ],
    });
    expect(body.prompt).toContain("Image 1 is the REFERENCE THUMBNAIL");
    expect(body.prompt).toContain("Image 2 is the SELECTED VIDEO FRAME");
    expect(body.prompt).toContain("Building Apps to $10K MRR, Ep. 14");
    expect(image).toMatch(/^data:image\/jpeg;base64,/);
    expect(
      await sharp(Buffer.from(image.split(",")[1], "base64")).metadata(),
    ).toMatchObject({
      format: "jpeg",
      width: 90,
      height: 160,
    });
  });
  it.each(["frame", "reference"] as const)(
    "uses the edit endpoint with only a %s attachment",
    async (field) => {
      const fetch = provider();
      await generateThumbnail({ prompt: "portrait", [field]: frame });
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.model).toBe("gpt-image-2-edit");
      expect(body.input_images).toEqual([{ url: frame, role: "start" }]);
      expect(body.prompt).toContain(
        `Image 1 is the ${field === "frame" ? "SELECTED VIDEO FRAME" : "REFERENCE THUMBNAIL"}`,
      );
      expect(body.prompt).not.toContain("Image 2");
    },
  );
  it("uses the cheaper generation model only when there are no attachments", async () => {
    const fetch = provider();
    await generateThumbnail({ prompt: "portrait" });
    expect(fetch.mock.calls[0][0]).toBe(
      "https://api.surplusintelligence.ai/v1/images/generations",
    );
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.model).toBe("venice-gpt-image-2");
    expect(body.input_images).toBeUndefined();
  });
  it("supports separate edit and generation model overrides", async () => {
    const fetch = provider();
    vi.stubEnv("SURPLUS_API_BASE", "https://surplus.example/v1/");
    vi.stubEnv("SURPLUS_IMAGE_EDIT_MODEL", "nano-banana-pro-edit");
    vi.stubEnv("SURPLUS_IMAGE_MODEL", "venice-nano-banana-pro");
    await generateThumbnail({ prompt: "portrait", frame });
    expect(fetch.mock.calls[0][0]).toBe(
      "https://surplus.example/v1/images/edits",
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body).model).toBe(
      "nano-banana-pro-edit",
    );
    // Each response body can be consumed only once.
    fetch.mockResolvedValue(Response.json({ data: [{ b64_json: encoded }] }));
    await generateThumbnail({ prompt: "portrait" });
    expect(JSON.parse(fetch.mock.calls[1][1].body).model).toBe(
      "venice-nano-banana-pro",
    );
  });
  it("retains safe diagnostics and never retries a failed paid request", async () => {
    vi.stubEnv("SURPLUS_API_KEY", "private-key");
    const fetch = vi.fn().mockResolvedValue(
      Response.json(
        {
          error: {
            code: "provider_error",
            message: `private-key private prompt ZnJhbWU= cmVm ${"x".repeat(1000)}`,
          },
        },
        { status: 502, headers: { "x-request-id": "request-123" } },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await generateThumbnail({
      prompt: "private prompt",
      frame,
      reference,
    }).catch((error: Error) => error);
    expect(result).toBeInstanceOf(Error);
    const error = result as Error;
    expect(error.message).toBe("thumbnail_502");
    expect(error.cause).toMatchObject({
      code: "provider_error",
      requestId: "request-123",
    });
    const message = (error.cause as { message: string }).message;
    expect(message).toHaveLength(500);
    for (const secret of ["private-key", "private prompt", "ZnJhbWU=", "cmVm"])
      expect(message).not.toContain(secret);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each([
    {},
    { data: [] },
    { data: [{ url: "https://example.com/image" }] },
    { data: [{ b64_json: "not base64" }] },
  ])("rejects absent or malformed inline results", async (data) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data)));
    await expect(generateThumbnail({ prompt: "portrait" })).rejects.toThrow(
      "thumbnail_empty",
    );
  });
  it("rejects non-image bytes in a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          data: [{ b64_json: Buffer.from("not an image").toString("base64") }],
        }),
      ),
    );
    await expect(generateThumbnail({ prompt: "portrait" })).rejects.toThrow(
      "thumbnail_invalid_output",
    );
  });
  it("requires Surplus configuration even if a Gemini key exists", async () => {
    vi.stubEnv("SURPLUS_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "unused");
    const fetch = provider();
    await expect(generateThumbnail({ prompt: "portrait" })).rejects.toThrow(
      "no_provider",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
