import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
import { claimIncludedOverlayReview } from "./included-overlay-review";
import { grantTrialCredits } from "@/lib/db/credits";
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30_000);
beforeEach(async () => {
  await client.exec("TRUNCATE users CASCADE");
  await db.insert(schema.users).values([{ id: "owner" }, { id: "other" }]);
});
afterAll(async () => {
  await client.close();
});
it("caps a paid overlay's included checks under concurrent requests", async () => {
  expect(await claimIncludedOverlayReview("owner")).toBe(false);
  await db.insert(schema.creditLedger).values({
    userId: "owner",
    delta: -60,
    reason: "deduction",
    balanceAfter: 0,
    metadata: {
      action: "design_overlay",
      usageId: "u1",
      billingVersion: 2,
      quantity: 1,
    },
  });
  expect(await claimIncludedOverlayReview("other")).toBe(false);
  const results = await Promise.all(
    Array.from({ length: 8 }, () => claimIncludedOverlayReview("owner")),
  );
  expect(results.filter(Boolean)).toHaveLength(3);
});
it("refunded work does not open another free provider allowance", async () => {
  await db.insert(schema.creditLedger).values([
    {
      userId: "owner",
      delta: -60,
      reason: "deduction",
      balanceAfter: 0,
      metadata: {
        action: "design_overlay",
        usageId: "u1",
        billingVersion: 2,
        quantity: 1,
      },
    },
    {
      userId: "owner",
      delta: 60,
      reason: "refund",
      balanceAfter: 60,
      metadata: { usageId: "u1" },
    },
  ]);
  expect(await claimIncludedOverlayReview("owner")).toBe(false);
});
it("grants only one small trial even when checkout deliveries race", async () => {
  await Promise.all(
    Array.from({ length: 8 }, () => grantTrialCredits("owner", 30)),
  );
  const rows = await db.select().from(schema.creditLedger);
  expect(rows).toHaveLength(1);
  expect(rows[0].delta).toBe(30);
});
it("historic subscription grants disqualify an account from another trial", async () => {
  await db.insert(schema.creditLedger).values({
    userId: "owner",
    delta: 6000,
    reason: "subscription_grant",
    balanceAfter: 6000,
    metadata: { source: "checkout" },
  });
  await grantTrialCredits("owner", 30);
  expect(await db.select().from(schema.creditLedger)).toHaveLength(1);
});

it("refunded batch units cannot fund extra checks, while paid planning keeps its checks", async () => {
  await db.insert(schema.creditLedger).values([
    {
      userId: "owner",
      delta: -480,
      reason: "deduction",
      balanceAfter: 0,
      metadata: {
        action: "design_overlay",
        usageId: "batch",
        billingVersion: 2,
        quantity: 8,
      },
    },
    {
      userId: "owner",
      delta: 420,
      reason: "refund",
      balanceAfter: 420,
      metadata: { usageId: "batch", partial: true },
    },
    {
      userId: "other",
      delta: -60,
      reason: "deduction",
      balanceAfter: 0,
      metadata: {
        action: "design_overlay",
        usageId: "planning",
        billingVersion: 2,
        quantity: 1,
      },
    },
    {
      userId: "other",
      delta: 40,
      reason: "refund",
      balanceAfter: 40,
      metadata: { usageId: "planning", partial: true },
    },
  ]);
  for (const user of ["owner", "other"]) {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => claimIncludedOverlayReview(user)),
    );
    expect(results.filter(Boolean)).toHaveLength(3);
  }
});
