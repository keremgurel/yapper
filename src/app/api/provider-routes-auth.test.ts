import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
}));

import { POST as cleanTranscript } from "./clean-transcript/route";
import { POST as scrapeCreator } from "./inspiration/creator/route";
import { POST as placeOverlays } from "./place-overlays/route";
import { POST as transcribe } from "./transcribe/route";

const request = (path: string) =>
  new Request(`https://ypr.app/api/${path}`, {
    method: "POST",
    body: path === "transcribe" ? new Uint8Array([1]) : JSON.stringify({}),
  });

describe("provider-backed API authentication", () => {
  it.each([
    ["clean-transcript", cleanTranscript],
    ["inspiration/creator", scrapeCreator],
    ["place-overlays", placeOverlays],
    ["transcribe", transcribe],
  ])("rejects anonymous requests to %s", async (path, handler) => {
    const response = await handler(request(path));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });
});
