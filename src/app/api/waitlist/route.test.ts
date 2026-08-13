import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  contactsCreate: vi.fn(),
  guardWaitlistEmail: vi.fn(),
  guardWaitlistIp: vi.fn(),
  identify: vi.fn(),
  resendConstructor: vi.fn(),
}));

vi.mock("@/lib/public-rate-limit", () => ({
  guardWaitlistEmail: mocks.guardWaitlistEmail,
  guardWaitlistIp: mocks.guardWaitlistIp,
}));
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({
    capture: mocks.capture,
    identify: mocks.identify,
  }),
}));
vi.mock("resend", () => ({
  Resend: class {
    contacts = { create: mocks.contactsCreate };
    constructor(...args: unknown[]) {
      mocks.resendConstructor(...args);
    }
  },
}));

import { POST } from "./route";

function request(email = "person@example.com"): Request {
  return new Request("https://ypr.app/api/waitlist", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-vercel-forwarded-for": "192.0.2.1",
    },
    body: JSON.stringify({ email }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "resend_test");
  mocks.guardWaitlistIp.mockResolvedValue(null);
  mocks.guardWaitlistEmail.mockResolvedValue(null);
  mocks.contactsCreate.mockResolvedValue({ error: null });
});

describe("POST /api/waitlist rate limits", () => {
  it("stops at the IP limit before email identity and Resend", async () => {
    mocks.guardWaitlistIp.mockResolvedValue(
      Response.json({ error: "rate_limited" }, { status: 429 }),
    );

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(mocks.guardWaitlistEmail).not.toHaveBeenCalled();
    expect(mocks.resendConstructor).not.toHaveBeenCalled();
  });

  it("normalizes a valid email before limiting and stops before Resend", async () => {
    mocks.guardWaitlistEmail.mockResolvedValue(
      Response.json({ error: "rate_limited" }, { status: 429 }),
    );

    const response = await POST(request(" PERSON@Example.COM "));

    expect(response.status).toBe(429);
    expect(mocks.guardWaitlistEmail).toHaveBeenCalledWith("person@example.com");
    expect(mocks.resendConstructor).not.toHaveBeenCalled();
  });

  it("calls Resend only after both limits allow the request", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.contactsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: "person@example.com" }),
    );
  });
});
