import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  event: null as unknown,
  grant: vi.fn(),
  due: vi.fn(),
  retrieve: vi.fn(),
  apply: vi.fn(),
}));
vi.mock("@/lib/db/credits", () => ({ grantCreditsIdempotent: mocks.grant }));
vi.mock("@/lib/db/subscription-allowances", () => ({
  grantDueAllowances: mocks.due,
}));
vi.mock("@/lib/db/billing", () => ({
  findUserIdByStripeCustomer: vi.fn().mockResolvedValue("user"),
  setStripeCustomerId: vi.fn(),
  applySubscriptionState: mocks.apply,
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: () => mocks.event },
    subscriptions: { retrieve: mocks.retrieve },
  }),
}));
import { SUBSCRIPTION_PLANS, TRIAL_CREDITS } from "@/lib/billing/plans";
import { POST } from "./route";
const request = () =>
  new NextRequest("https://ypr.app/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "test" },
    body: "event",
  });
const invoice = (overrides = {}) => ({
  id: "in_1",
  status: "paid",
  customer: "cus_1",
  billing_reason: "subscription_cycle",
  parent: { subscription_details: { subscription: "sub_1" } },
  lines: {
    data: [
      {
        pricing: { price_details: { price: "price_yearly" } },
        period: { start: 1790841600, end: 1822377600 },
      },
    ],
  },
  ...overrides,
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "test");
  vi.spyOn(SUBSCRIPTION_PLANS[3], "priceId", "get").mockReturnValue(
    "price_yearly",
  );
  mocks.retrieve.mockResolvedValue({ status: "active" });
});
describe("subscription credit lifecycle", () => {
  it("grants only the capped trial credits, keyed once per account", async () => {
    mocks.retrieve.mockResolvedValue({ status: "trialing" });
    mocks.event = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          mode: "subscription",
          subscription: "sub_1",
          client_reference_id: "user",
          metadata: { plan: "studio_creator_yearly" },
        },
      },
    };
    expect((await POST(request())).status).toBe(200);
    expect(mocks.grant).toHaveBeenCalledWith(
      "user",
      TRIAL_CREDITS,
      "subscription_grant",
      "trial_user",
      expect.anything(),
    );
    expect(mocks.due).not.toHaveBeenCalled();
  });
  it("does not grant paid credits again at checkout", async () => {
    mocks.event = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          mode: "subscription",
          subscription: "sub_1",
          client_reference_id: "user",
          metadata: { plan: "studio_creator_monthly" },
        },
      },
    };
    expect((await POST(request())).status).toBe(200);
    expect(mocks.grant).not.toHaveBeenCalled();
    expect(mocks.due).not.toHaveBeenCalled();
  });
  it.each(["subscription_create", "subscription_cycle"])(
    "starts a monthly-release schedule on a paid %s invoice",
    async (reason) => {
      mocks.event = {
        type: "invoice.paid",
        data: { object: invoice({ billing_reason: reason }) },
      };
      expect((await POST(request())).status).toBe(200);
      expect(mocks.due).toHaveBeenCalledWith(
        "user",
        expect.objectContaining({
          credits: 500,
          months: 12,
          subscriptionId: "sub_1",
        }),
      );
    },
  );
  it("ignores trial invoices, including late delivery after conversion", async () => {
    mocks.retrieve.mockResolvedValue({
      status: "active",
      trial_end: 1822377600,
    });
    mocks.event = { type: "invoice.paid", data: { object: invoice() } };
    expect((await POST(request())).status).toBe(200);
    expect(mocks.due).not.toHaveBeenCalled();
  });
  it("does not grant a new allowance for proration", async () => {
    mocks.event = {
      type: "invoice.paid",
      data: { object: invoice({ billing_reason: "subscription_update" }) },
    };
    expect((await POST(request())).status).toBe(200);
    expect(mocks.due).not.toHaveBeenCalled();
  });
  it("retries unknown paid prices instead of silently losing credits", async () => {
    mocks.event = {
      type: "invoice.paid",
      data: { object: invoice({ lines: { data: [] } }) },
    };
    expect((await POST(request())).status).toBe(500);
  });
});
