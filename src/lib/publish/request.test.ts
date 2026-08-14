import { describe, expect, it } from "vitest";
import {
  readInstagramPublishRequest,
  readYouTubePublishRequest,
} from "./request";

const request = (body: unknown) =>
  new Request("https://example.test/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("bounded publish requests", () => {
  it("accepts a bounded YouTube request", async () => {
    await expect(
      readYouTubePublishRequest(
        request({ title: "Video", tags: ["one"], privacyStatus: "public" }),
      ),
    ).resolves.toMatchObject({ title: "Video", tags: ["one"] });
  });

  it("rejects malformed field types before provider work", async () => {
    await expect(
      readYouTubePublishRequest(request({ title: { value: "Video" } })),
    ).rejects.toMatchObject({ code: "invalid_body" });
    await expect(
      readInstagramPublishRequest(request({ caption: "x".repeat(2_201) })),
    ).rejects.toMatchObject({ code: "invalid_body" });
  });

  it("rejects a request body above the 16 KiB ingress budget", async () => {
    await expect(
      readYouTubePublishRequest(request({ title: "x".repeat(17_000) })),
    ).rejects.toMatchObject({ code: "payload_too_large" });
  });
});
