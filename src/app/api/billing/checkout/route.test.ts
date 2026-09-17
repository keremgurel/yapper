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
    checkout: { sessions: { create: mocks.createSession } },
  }),
}));

import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from "@/lib/billing/plans";
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.currentUser.mockResolvedValue(null);
  mocks.getBillingState.mockResolvedValue(null);
  mocks.createCustomer.mockResolvedValue({ id: "cus_new" });
  mocks.createSession.mockResolvedValue({
    url: "https://checkout.stripe.test",
  });
  vi.spyOn(SUBSCRIPTION_PLANS[1], "priceId", "get").mockReturnValue(
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
    const response = await POST(request({ plan: "creator_monthly" }));
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
    await POST(request({ plan: "creator_monthly" }));
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
    const response = await POST(request({ pack: "credits_100" }));
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
