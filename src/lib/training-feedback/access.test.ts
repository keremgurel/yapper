import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: vi.fn(),
  spendable: vi.fn(),
  today: vi.fn(),
}));
vi.mock("@/lib/db/billing", () => ({ getBillingState: mocks.state }));
vi.mock("@/lib/db/train-wallet", () => ({
  getTrainSpendable: mocks.spendable,
}));
vi.mock("@/lib/db/train-usage", () => ({
  countTrainSessionsToday: mocks.today,
}));

import { TRAIN_FAIR_USE_DAILY_SESSIONS } from "@/lib/billing/train-fair-use";
import { resolveTrainFeedbackAccess } from "./access";

const now = new Date("2026-10-02T10:00:00Z");
const active = {
  subscriptionStatus: "active",
  plan: "train_plus_monthly",
  currentPeriodEnd: new Date("2026-11-01T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.mockResolvedValue(null);
  mocks.spendable.mockResolvedValue(0);
  mocks.today.mockResolvedValue(0);
});

describe("who may run a Train feedback session", () => {
  it("lets a Train Plus subscriber through without credits", async () => {
    mocks.state.mockResolvedValue(active);
    expect(await resolveTrainFeedbackAccess("user", now)).toBe("plan");
    expect(mocks.state).toHaveBeenCalledWith("user", "train");
    expect(mocks.spendable).not.toHaveBeenCalled();
  });
  it("stops a subscriber at the daily ceiling and says when it resets", async () => {
    mocks.state.mockResolvedValue(active);
    mocks.today.mockResolvedValue(TRAIN_FAIR_USE_DAILY_SESSIONS);
    const refused = (await resolveTrainFeedbackAccess("user", now)) as Response;
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({
      error: "fair_use_limit",
      resetsAt: "2026-10-03T00:00:00.000Z",
    });
  });
  it("charges credits when there is no plan, such as the welcome session", async () => {
    mocks.spendable.mockResolvedValue(3);
    expect(await resolveTrainFeedbackAccess("user", now)).toBe("credits");
  });
  it("refuses a free account with nothing left", async () => {
    const refused = (await resolveTrainFeedbackAccess("user", now)) as Response;
    expect(refused.status).toBe(402);
    expect(await refused.json()).toEqual({ error: "insufficient_credits" });
  });
  it("treats a lapsed plan as no plan", async () => {
    mocks.state.mockResolvedValue({
      ...active,
      subscriptionStatus: "canceled",
    });
    expect(
      ((await resolveTrainFeedbackAccess("user", now)) as Response).status,
    ).toBe(402);
  });
});
