import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  construct: vi.fn(),
  grant: vi.fn(),
  trial: vi.fn(),
  retrieve: vi.fn(),
  sessions: vi.fn(),
  apply: vi.fn(),
  link: vi.fn(),
}));
vi.mock("@/lib/db/credits", () => ({
  grantCreditsIdempotent: mocks.grant,
  grantTrialCredits: mocks.trial,
}));
vi.mock("@/lib/db/billing", () => ({
  applySubscriptionState: mocks.apply,
  findUserIdByStripeCustomer: async () => "owner",
  setStripeCustomerId: mocks.link,
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mocks.construct },
    subscriptions: { retrieve: mocks.retrieve },
    checkout: { sessions: { list: mocks.sessions } },
  }),
}));
import { POST } from "./route";
import { SUBSCRIPTION_PLANS } from "@/lib/billing/plans";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "test");
  vi.spyOn(SUBSCRIPTION_PLANS[2], "priceId", "get").mockReturnValue("yearly");
  mocks.retrieve.mockResolvedValue({ status: "trialing" });
});
async function send(type: string, object: unknown) {
  mocks.construct.mockReturnValue({ type, data: { object } });
  return POST(
    new NextRequest("https://example.test/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "test" },
      body: "event",
    }),
  );
}
const invoice = {
  id: "in_1",
  customer: "cus_1",
  status: "paid",
  amount_paid: 19999,
  billing_reason: "subscription_create",
  parent: { subscription_details: { metadata: { creditGrantVersion: "2" } } },
  lines: { data: [{ pricing: { price_details: { price: "yearly" } } }] },
};
it("annual free trial gets 30 credits, never the 6000 annual allotment", async () => {
  expect(
    (
      await send("checkout.session.completed", {
        id: "cs_1",
        mode: "subscription",
        client_reference_id: "owner",
        payment_status: "no_payment_required",
        subscription: "sub_1",
        metadata: { plan: "creator_yearly" },
      })
    ).status,
  ).toBe(200);
  expect(mocks.trial).toHaveBeenCalledWith("owner", 30);
  expect(mocks.grant).not.toHaveBeenCalled();
});
it("paid checkout defers the full allotment to its paid invoice", async () => {
  await send("checkout.session.completed", {
    id: "cs_1",
    mode: "subscription",
    client_reference_id: "owner",
    payment_status: "paid",
    metadata: { plan: "creator_yearly" },
  });
  expect(mocks.grant).not.toHaveBeenCalled();
  await send("invoice.paid", invoice);
  expect(mocks.grant).toHaveBeenCalledWith(
    "owner",
    6000,
    "subscription_grant",
    "inv_in_1",
    expect.anything(),
  );
});
it("trial zero invoices, unpaid invoices and legacy initial deliveries do not double-grant", async () => {
  for (const change of [
    { amount_paid: 0 },
    { status: "open" },
    { parent: null },
    { billing_reason: "subscription_update" },
  ])
    await send("invoice.paid", { ...invoice, ...change });
  expect(mocks.grant).not.toHaveBeenCalled();
});
it("paid renewal uses the invoice identity for both event orders and re-deliveries", async () => {
  await send("invoice.paid", {
    ...invoice,
    billing_reason: "subscription_cycle",
    parent: null,
  });
  await send("invoice.paid", {
    ...invoice,
    billing_reason: "subscription_cycle",
    parent: null,
  });
  expect(mocks.grant.mock.calls.map((call) => call[3])).toEqual([
    "inv_in_1",
    "inv_in_1",
  ]);
});

it("credits a checkout opened before deployment with the legacy deduplication key", async () => {
  mocks.sessions.mockResolvedValue({ data: [{ id: "cs_legacy" }] });
  await send("invoice.paid", {
    ...invoice,
    parent: { subscription_details: { subscription: "sub_old", metadata: {} } },
  });
  expect(mocks.grant).toHaveBeenCalledWith(
    "owner",
    6000,
    "subscription_grant",
    "sess_cs_legacy",
    expect.anything(),
  );
});
