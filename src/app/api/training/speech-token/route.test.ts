import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  issue: vi.fn(),
  spend: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/users", () => ({ ensureUser: vi.fn() }));
vi.mock("@/lib/training-feedback/access", () => ({
  resolveTrainFeedbackAccess: mocks.access,
}));
vi.mock("@/lib/provider-rate-limit", () => ({
  guardProviderIngress: async () => null,
  guardProviderSpend: mocks.spend,
}));
vi.mock("@/lib/pronunciation/azure-token", async (original) => ({
  ...(await original<typeof import("@/lib/pronunciation/azure-token")>()),
  issueSpeechToken: mocks.issue,
}));

import { POST } from "./route";

const request = () =>
  new Request("https://yapper.test/api/training/speech-token", {
    method: "POST",
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AZURE_SPEECH_KEY", "key");
  vi.stubEnv("AZURE_SPEECH_REGION", "eastus");
  mocks.auth.mockResolvedValue({ userId: "user" });
  mocks.access.mockResolvedValue("plan");
  mocks.spend.mockResolvedValue(null);
  mocks.issue.mockResolvedValue("short-lived");
});

describe("POST /api/training/speech-token", () => {
  it("gives a token and region to someone who can run feedback", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      token: "short-lived",
      region: "eastus",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("never returns the subscription key", async () => {
    const body = JSON.stringify(await (await POST(request())).json());
    expect(body).not.toContain('"key"');
  });

  it("refuses a signed-out request before touching the provider", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.issue).not.toHaveBeenCalled();
  });

  it("refuses someone with no plan and no credits", async () => {
    mocks.access.mockResolvedValue(
      Response.json({ error: "insufficient_credits" }, { status: 402 }),
    );
    expect((await POST(request())).status).toBe(402);
    expect(mocks.issue).not.toHaveBeenCalled();
  });

  it("honors the per-user spend limit", async () => {
    mocks.spend.mockResolvedValue(new Response(null, { status: 429 }));
    expect((await POST(request())).status).toBe(429);
    expect(mocks.issue).not.toHaveBeenCalled();
  });

  it("says so when the Speech resource is not configured", async () => {
    vi.stubEnv("AZURE_SPEECH_KEY", "");
    expect((await POST(request())).status).toBe(501);
  });

  it("reports a provider failure without leaking its detail", async () => {
    mocks.issue.mockRejectedValue(new Error("speech_token_401"));
    const response = await POST(request());
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "token_failed" });
  });
});
