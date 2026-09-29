import { randomInt } from "node:crypto";
import { Pool } from "pg";
import { afterAll, expect, it, vi } from "vitest";
vi.unmock("@/lib/costs/provider-budget");
import { reserveProviderBudget } from "./provider-budget";
if (!process.env.DATABASE_URL) throw new Error("Integration database required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
// Isolated future window, never today's live budget. This suite only runs in the
// explicit integration job; no broad truncation of another test's records.
const date = new Date(Date.UTC(randomInt(3000, 9000), randomInt(0, 12), 15));
const day = date.toISOString().slice(0, 10);
afterAll(async () => {
  await pool.query(
    'delete from provider_spend_windows where "window" = any($1)',
    [[`day:${day}`, `month:${day.slice(0, 7)}`]],
  );
  await pool.end();
  vi.unstubAllEnvs();
});
it("PostgreSQL concurrent workers cannot overspend either fixed window", async () => {
  vi.stubEnv("PROVIDER_DAILY_BUDGET_USD", "10");
  vi.stubEnv("PROVIDER_MONTHLY_BUDGET_USD", "3");
  const results = await Promise.allSettled(
    Array.from({ length: 24 }, () => reserveProviderBudget(1_000_000, date)),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  const rows = await pool.query(
    'select reserved_microusd, attempts from provider_spend_windows where "window" = any($1)',
    [[`day:${day}`, `month:${day.slice(0, 7)}`]],
  );
  expect(rows.rows).toHaveLength(2);
  for (const row of rows.rows) {
    expect(Number(row.reserved_microusd)).toBe(3_000_000);
    expect(row.attempts).toBe(3);
  }
});
