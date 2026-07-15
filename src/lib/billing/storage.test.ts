import { describe, expect, it } from "vitest";
import { storageQuotaFor } from "@/lib/billing/storage";
import { FREE_STORAGE_BYTES } from "@/lib/db/constants";
import { planByKey } from "@/lib/billing/plans";

const NOW = new Date("2026-01-01T00:00:00Z");
const FUTURE = new Date("2026-02-01T00:00:00Z");
const PAST = new Date("2025-12-01T00:00:00Z");

const proBytes = planByKey("pro")!.storageBytes;
const starterBytes = planByKey("starter")!.storageBytes;

describe("storageQuotaFor", () => {
  it("gives the free-tier quota when there is no subscription", () => {
    expect(storageQuotaFor(null, NOW)).toBe(FREE_STORAGE_BYTES);
  });

  it("gives an active subscriber their tier's storage", () => {
    expect(
      storageQuotaFor(
        {
          subscriptionStatus: "active",
          plan: "pro",
          currentPeriodEnd: FUTURE,
        },
        NOW,
      ),
    ).toBe(proBytes);
  });

  it("grants tier storage during a trial", () => {
    expect(
      storageQuotaFor(
        {
          subscriptionStatus: "trialing",
          plan: "starter",
          currentPeriodEnd: FUTURE,
        },
        NOW,
      ),
    ).toBe(starterBytes);
  });

  it("drops a lapsed subscriber back to the free quota", () => {
    // Canceled status is not entitled, so no tier storage even with a plan set.
    expect(
      storageQuotaFor(
        {
          subscriptionStatus: "canceled",
          plan: "pro",
          currentPeriodEnd: FUTURE,
        },
        NOW,
      ),
    ).toBe(FREE_STORAGE_BYTES);
  });

  it("drops to the free quota once the paid period plus grace has passed", () => {
    // Entitled status but the period ended well before now (past the 3-day grace).
    expect(
      storageQuotaFor(
        {
          subscriptionStatus: "active",
          plan: "pro",
          currentPeriodEnd: PAST,
        },
        NOW,
      ),
    ).toBe(FREE_STORAGE_BYTES);
  });

  it("falls back to the free quota for an unknown plan key", () => {
    expect(
      storageQuotaFor(
        {
          subscriptionStatus: "active",
          plan: "legacy_gold",
          currentPeriodEnd: FUTURE,
        },
        NOW,
      ),
    ).toBe(FREE_STORAGE_BYTES);
  });
});
