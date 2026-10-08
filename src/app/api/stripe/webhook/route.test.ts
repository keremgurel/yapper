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
import { SUBSCRIPTION_PLANS, LEGACY_STUDIO_PLANS } from "@/lib/billing/plans";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "test");
  vi.spyOn(
    SUBSCRIPTION_PLANS.find((plan) => plan.key === "creator_yearly")!,
    "priceId",
    "get",
  ).mockReturnValue("yearly");
  vi.spyOn(
    SUBSCRIPTION_PLANS.find((plan) => plan.key === "train_plus_monthly")!,
    "priceId",
    "get",
  ).mockReturnValue("train_monthly");
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
    "studio",
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
    "studio",
  );
});

const subscription = (
  price: string,
  metadata: Record<string, string> = {},
) => ({
  customer: "cus_1",
  status: "active",
  metadata,
  items: { data: [{ price: { id: price }, current_period_end: 1800000000 }] },
});
it("mirrors a Train Plus subscription into the Train fields only", async () => {
  await send("customer.subscription.created", subscription("train_monthly"));
  expect(mocks.apply).toHaveBeenCalledWith(
    "owner",
    expect.objectContaining({
      plan: "train_plus_monthly",
      subscriptionStatus: "active",
    }),
    "train",
  );
});
it("mirrors a Studio subscription into the Studio fields", async () => {
  await send("customer.subscription.updated", subscription("yearly"));
  expect(mocks.apply).toHaveBeenCalledWith(
    "owner",
    expect.objectContaining({ plan: "creator_yearly" }),
    "studio",
  );
});
it("uses the product stamped at checkout when the price is no longer mapped", async () => {
  await send(
    "customer.subscription.deleted",
    subscription("retired_price", { product: "train" }),
  );
  expect(mocks.apply).toHaveBeenCalledWith(
    "owner",
    expect.objectContaining({ plan: null }),
    "train",
  );
});
it("treats an unmapped subscription with no stamp as Studio", async () => {
  await send("customer.subscription.updated", subscription("retired_price"));
  expect(mocks.apply).toHaveBeenCalledWith(
    "owner",
    expect.anything(),
    "studio",
  );
});
it("a paid Train Plus invoice grants no credits", async () => {
  await send("invoice.paid", {
    ...invoice,
    amount_paid: 900,
    lines: {
      data: [{ pricing: { price_details: { price: "train_monthly" } } }],
    },
  });
  expect(mocks.grant).not.toHaveBeenCalled();
});
it("a Train Plus checkout never receives the Studio trial credits", async () => {
  await send("checkout.session.completed", {
    id: "cs_train",
    mode: "subscription",
    client_reference_id: "owner",
    payment_status: "no_payment_required",
    subscription: "sub_train",
    metadata: { plan: "train_plus_monthly" },
  });
  expect(mocks.trial).not.toHaveBeenCalled();
});

it("continues granting credits to an existing weekly subscriber on renewal", async () => {
  const spy = vi
    .spyOn(LEGACY_STUDIO_PLANS[0], "priceId", "get")
    .mockReturnValue("weekly");
  await send("invoice.paid", {
    ...invoice,
    amount_paid: 799,
    billing_reason: "subscription_cycle",
    lines: { data: [{ pricing: { price_details: { price: "weekly" } } }] },
  });
  expect(mocks.grant).toHaveBeenCalledWith(
    "owner",
    100,
    "subscription_grant",
    "inv_in_1",
    expect.anything(),
    "studio",
  );
  spy.mockRestore();
});
