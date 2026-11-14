import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));

import { GET } from "./route";

beforeEach(() => {
  vi.unstubAllEnvs();
  mocks.auth.mockReset().mockResolvedValue({ userId: "user_test" });
});

it("refuses a signed-out caller", async () => {
  mocks.auth.mockResolvedValue({ userId: null });
  const response = await GET();
  expect(response.status).toBe(401);
});

it("answers with overlapping pieces while Deepgram is first", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({
    pieceSeconds: 120,
    overlapSeconds: 30,
  });
});

it("answers with long pieces while Scribe is first", async () => {
  vi.stubEnv("TRANSCRIPTION_PRIMARY", "elevenlabs");
  vi.stubEnv("ELEVENLABS_API_KEY", "el_test");
  const response = await GET();
  await expect(response.json()).resolves.toEqual({
    pieceSeconds: 600,
    overlapSeconds: 5,
  });
});
