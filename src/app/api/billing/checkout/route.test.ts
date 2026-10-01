import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getBillingState: vi.fn(),
  setStripeCustomerId: vi.fn(),
  ensureUser: vi.fn(),
  createCustomer: vi.fn(),
  createSession: vi.fn(),
  retrievePrice: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  currentUser: mocks.currentUser,
}));
vi.mock("@/lib/db/billing", () => ({
  getBillingState: mocks.getBillingState,
  setStripeCustomerId: mocks.setStripeCustomerId,
}));
vi.mock("@/lib/db/users", () => ({ ensureUser: mocks.ensureUser }));
vi.mock("@/lib/stripe", () => ({
  stripeConfigured: () => true,
  getStripe: () => ({
    customers: { create: mocks.createCustomer },
    prices: { retrieve: mocks.retrievePrice },
    checkout: { sessions: { create: mocks.createSession } },
  }),
}));

import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from "@/lib/billing/plans";
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.retrievePrice.mockImplementation(async (id: string) =>
    id === "price_pack"
      ? { active: true, currency: "usd", unit_amount: 1200, type: "one_time" }
      : {
          active: true,
          currency: "usd",
          unit_amount: 2900,
          recurring: { interval: "month", interval_count: 1 },
        },
  );
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.currentUser.mockResolvedValue(null);
  mocks.getBillingState.mockResolvedValue(null);
  mocks.createCustomer.mockResolvedValue({ id: "cus_new" });
  mocks.createSession.mockResolvedValue({
    url: "https://checkout.stripe.test",
  });
  vi.spyOn(SUBSCRIPTION_PLANS[2], "priceId", "get").mockReturnValue(
    "price_monthly",
  );
  vi.spyOn(CREDIT_PACKS[0], "priceId", "get").mockReturnValue("price_pack");
});

function request(body: Record<string, string>) {
  return new NextRequest("https://yapper.test/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("Checkout tax and customer location", () => {
  it("collects and saves a first subscriber's address for tax and renewals", async () => {
    const response = await POST(request({ plan: "studio_creator_monthly" }));
    expect(response.status).toBe(200);
    expect(mocks.setStripeCustomerId).toHaveBeenCalledWith(
      "user_test",
      "cus_new",
    );
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_new",
        mode: "subscription",
        automatic_tax: { enabled: true },
        customer_update: { address: "auto" },
        billing_address_collection: "required",
        subscription_data: {
          trial_period_days: 7,
          metadata: { userId: "user_test" },
        },
      }),
    );
  });

  it("uses the checkout address when a returning subscriber has a saved customer", async () => {
    mocks.getBillingState.mockResolvedValue({
      stripeCustomerId: "cus_existing",
      subscriptionStatus: "canceled",
      currentPeriodEnd: null,
    });
    await POST(request({ plan: "studio_creator_monthly" }));
    expect(mocks.createCustomer).not.toHaveBeenCalled();
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        automatic_tax: { enabled: true },
        customer_update: { address: "auto" },
        billing_address_collection: "required",
        subscription_data: { metadata: { userId: "user_test" } },
      }),
    );
  });

  it("also calculates tax on one-time credit packs for active subscribers", async () => {
    mocks.getBillingState.mockResolvedValue({
      stripeCustomerId: "cus_existing",
      subscriptionStatus: "active",
      currentPeriodEnd: null,
    });
    const response = await POST(request({ pack: "topup_100" }));
    expect(response.status).toBe(200);
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        mode: "payment",
        line_items: [{ price: "price_pack", quantity: 1 }],
        automatic_tax: { enabled: true },
        customer_update: { address: "auto" },
        billing_address_collection: "required",
      }),
    );
  });
});

describe("public catalog protections", () => {
  it("rejects retired weekly and previous catalog offers", async () => {
    for (const plan of [
      "creator_weekly",
      "creator_monthly",
      "creator_yearly",
    ]) {
      expect((await POST(request({ plan }))).status).toBe(400);
    }
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
  it("refuses a Stripe amount that differs from the displayed price", async () => {
    mocks.retrievePrice.mockResolvedValue({
      active: true,
      currency: "usd",
      unit_amount: 9900,
      recurring: { interval: "month", interval_count: 1 },
    });
    expect(
      (await POST(request({ plan: "studio_creator_monthly" }))).status,
    ).toBe(503);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
  it("refuses ambiguous plan plus pack requests", async () => {
    expect(
      (
        await POST(
          request({ plan: "studio_creator_monthly", pack: "topup_100" }),
        )
      ).status,
    ).toBe(400);
  });
});
