import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "./schema";
const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("./client", () => ({ getDb: () => db }));
import {
  grantDueAllowances,
  refillAnnualAllowances,
} from "./subscription-allowances";
import { allowanceSchedule } from "@/lib/billing/allowances";
import { planByKey } from "@/lib/billing/plans";
const start = Date.parse("2026-01-31T12:00:00Z") / 1000;
const end = Date.parse("2027-01-31T12:00:00Z") / 1000;
const schedule = allowanceSchedule(
  planByKey("studio_creator_yearly")!,
  "sub_1",
  start,
  end,
);
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30000);
beforeEach(async () => {
  await client.exec("TRUNCATE users CASCADE");
  await db.insert(schema.users).values({
    id: "user",
    creditsBalance: 0,
    plan: "studio_creator_yearly",
    subscriptionStatus: "active",
    currentPeriodEnd: new Date(end * 1000),
  });
});
afterAll(async () => {
  await client.close();
});
async function balance() {
  return (
    await db.select().from(schema.users).where(eq(schema.users.id, "user"))
  )[0].creditsBalance;
}
it("uses the same unique grant across webhook replays and cron refills", async () => {
  await grantDueAllowances("user", schedule, start);
  await grantDueAllowances("user", schedule, start);
  expect(await balance()).toBe(500);
  const now = new Date("2026-03-31T12:00:00Z");
  expect(await refillAnnualAllowances(now)).toEqual({ scanned: 1, granted: 2 });
  expect(await refillAnnualAllowances(now)).toEqual({ scanned: 1, granted: 0 });
  expect(await balance()).toBe(1500);
});
it("does not refill a canceled subscription or a replaced plan", async () => {
  await grantDueAllowances("user", schedule, start);
  await db
    .update(schema.users)
    .set({ subscriptionStatus: "canceled" })
    .where(eq(schema.users.id, "user"));
  expect(
    (await refillAnnualAllowances(new Date("2026-03-31T12:00:00Z"))).granted,
  ).toBe(0);
  await db
    .update(schema.users)
    .set({ subscriptionStatus: "active", plan: "studio_pro_monthly" })
    .where(eq(schema.users.id, "user"));
  expect(
    (await refillAnnualAllowances(new Date("2026-03-31T12:00:00Z"))).granted,
  ).toBe(0);
  expect(await balance()).toBe(500);
});
it("stops grants at the end of the paid annual period", async () => {
  await grantDueAllowances("user", schedule, start);
  expect(
    (await refillAnnualAllowances(new Date("2027-02-01T12:00:00Z"))).granted,
  ).toBe(0);
});

it("does not revive an old schedule when the same plan is purchased in a new period", async () => {
  await grantDueAllowances("user", schedule, start);
  await db
    .update(schema.users)
    .set({ currentPeriodEnd: new Date("2027-03-31T12:00:00Z") })
    .where(eq(schema.users.id, "user"));
  expect(
    (await refillAnnualAllowances(new Date("2026-03-31T12:00:00Z"))).granted,
  ).toBe(0);
  expect(await balance()).toBe(500);
});
