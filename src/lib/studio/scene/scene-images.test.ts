import { beforeEach, expect, it, vi } from "vitest";
import { fetchBoundedJson } from "@/lib/http/outbound";
import { generateSceneImage } from "./generate-scene-image";
import { deliverScene } from "./scene-delivery";

vi.mock("@/lib/http/outbound", () => ({ fetchBoundedJson: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

it("asks for a real plain backdrop, not simulated alpha", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.mocked(fetchBoundedJson).mockResolvedValue({
    response: new Response(),
    data: {
      candidates: [
        {
          content: {
            parts: [
              { inlineData: { mimeType: "image/png", data: "cGljdHVyZQ==" } },
            ],
          },
        },
      ],
    },
  });
  await generateSceneImage({ prompt: "Stack of creative cards", aspect: 1 });
  const body = JSON.parse(
    String(vi.mocked(fetchBoundedJson).mock.calls[0][1]?.body),
  );
  expect(body.contents[0].parts[0].text).toContain(
    "solid plain white background",
  );
  expect(body.contents[0].parts[0].text).toContain("no checkerboard");
});

it("does not deliver a hollow composition when its picture is missing", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  const release = vi.fn();
  const result = await deliverScene({
    id: "illustration",
    reply: JSON.stringify({
      name: "Creative cards",
      description: "A stack of cards",
      scene: {
        version: 1,
        duration: 4,
        nodes: [
          {
            id: "title",
            type: "text",
            text: "Creatives",
            x: 0,
            y: 0,
            width: 1,
            height: 0.2,
          },
          {
            id: "hero",
            type: "image",
            asset: "image:hero",
            x: 0,
            y: 0.2,
            width: 1,
            height: 0.8,
          },
        ],
        animations: [],
      },
      images: [{ key: "hero", prompt: "Creative cards", aspect: 1 }],
    }),
    fallback: { brief: "Creative cards", quote: "a library of creatives" },
    frameHeightPx: 1080,
    boxHeightPx: 300,
    takenNames: [],
    reserveImage: async () => ({ release }),
  });
  expect(result).toEqual({
    ok: false,
    failed: { id: "illustration", reason: "image_failed" },
  });
  expect(release).toHaveBeenCalledWith("no_provider");
});
