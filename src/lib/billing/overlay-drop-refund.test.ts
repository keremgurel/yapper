import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
import { refundDroppedOverlay } from "./overlay-drop-refund";

const RUN = "00000000-0000-4000-8000-000000000001";
const BATCH = "00000000-0000-4000-8000-000000000002";
const LATER = "00000000-0000-4000-8000-000000000003";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30_000);
beforeEach(async () => {
  await client.exec("TRUNCATE users CASCADE");
  await db.insert(schema.users).values([
    { id: "owner", creditsBalance: 0 },
    { id: "other", creditsBalance: 0 },
  ]);
});
afterAll(async () => {
  await client.close();
});

/** What the routes write: one planning charge and design batches tagged with it. */
async function charge(
  usageId: string,
  action: string,
  credits: number,
  extra: Record<string, unknown> = {},
) {
  await db.insert(schema.creditLedger).values({
    userId: "owner",
    delta: -credits,
    reason: "deduction",
    balanceAfter: 0,
    metadata: { action, usageId, billingVersion: 2, ...extra },
  });
}
const balance = async (id = "owner") =>
  (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0]
    .creditsBalance;

it("partial failure: refunds the dropped card and keeps the planning charge", async () => {
  await charge(RUN, "direct_overlays", 10);
  await charge(BATCH, "design_overlay", 90, { quantity: 3, run: RUN });

  expect(
    await refundDroppedOverlay(
      "owner",
      { usageId: BATCH, id: "b" },
      "review_failed",
    ),
  ).toEqual({ credits: 30, run: 0 });
  expect(await balance()).toBe(30);
});

it("total failure: every card dropped returns the planning charge too", async () => {
  await charge(RUN, "direct_overlays", 10);
  await charge(BATCH, "design_overlay", 60, { quantity: 2, run: RUN });

  expect(
    await refundDroppedOverlay(
      "owner",
      { usageId: BATCH, id: "a" },
      "review_failed",
    ),
  ).toEqual({ credits: 30, run: 0 });
  expect(
    await refundDroppedOverlay(
      "owner",
      { usageId: BATCH, id: "b" },
      "review_failed",
    ),
  ).toEqual({ credits: 30, run: 10 });
  expect(await balance()).toBe(70);
});

it("total failure counts designs the designer already refunded", async () => {
  // The benchmark's run 1 shape after design-time failures: one batch was
  // refunded by the design route, the other card is dropped at review.
  await charge(RUN, "direct_overlays", 10);
  await charge(BATCH, "design_overlay", 30, { quantity: 1, run: RUN });
  await charge(LATER, "design_overlay", 30, { quantity: 1, run: RUN });
  await db.insert(schema.creditLedger).values({
    userId: "owner",
    delta: 30,
    reason: "refund",
    balanceAfter: 30,
    metadata: { action: "design_overlay", usageId: LATER },
  });

  expect(
    await refundDroppedOverlay(
      "owner",
      { usageId: BATCH, id: "a" },
      "review_failed",
    ),
  ).toEqual({ credits: 30, run: 10 });
});

it("all pass: nothing is refunded when no card is dropped", async () => {
  await charge(RUN, "direct_overlays", 10);
  await charge(BATCH, "design_overlay", 60, { quantity: 2, run: RUN });
  expect(await balance()).toBe(0);
  const refunds = await db
    .select()
    .from(schema.creditLedger)
    .where(eq(schema.creditLedger.reason, "refund"));
  expect(refunds).toHaveLength(0);
});

it("refunds each card once, even when reviews race", async () => {
  await charge(BATCH, "design_overlay", 60, { quantity: 2, run: RUN });
  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      refundDroppedOverlay("owner", { usageId: BATCH, id: "a" }, "x"),
    ),
  );
  expect(results.map((r) => r.credits).sort()).toEqual([0, 0, 0, 0, 0, 30]);
  expect(await balance()).toBe(30);
});

it("never refunds more than the charge took", async () => {
  await charge(BATCH, "design_overlay", 30, { quantity: 1 });
  await refundDroppedOverlay("owner", { usageId: BATCH, id: "a" }, "x");
  expect(
    await refundDroppedOverlay("owner", { usageId: BATCH, id: "b" }, "x"),
  ).toEqual({ credits: 0, run: 0 });
  expect(await balance()).toBe(30);
});

it("ignores charges that are someone else's, old, or not a design", async () => {
  await charge(RUN, "direct_overlays", 10);
  expect(
    await refundDroppedOverlay("owner", { usageId: RUN, id: "a" }, "x"),
  ).toEqual({ credits: 0, run: 0 });
  await charge(BATCH, "design_overlay", 30, { quantity: 1 });
  expect(
    await refundDroppedOverlay("other", { usageId: BATCH, id: "a" }, "x"),
  ).toEqual({ credits: 0, run: 0 });
  await client.exec(
    "update credit_ledger set created_at = now() - interval '2 days'",
  );
  expect(
    await refundDroppedOverlay("owner", { usageId: BATCH, id: "a" }, "x"),
  ).toEqual({ credits: 0, run: 0 });
  expect(await balance()).toBe(0);
  expect(await balance("other")).toBe(0);
});
