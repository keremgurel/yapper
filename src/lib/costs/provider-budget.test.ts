import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
vi.unmock("@/lib/costs/provider-budget");
const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
import {
  providerAllowance,
  reserveProviderBudget,
  reserveTikTokImportBudget,
  settleProviderBudget,
} from "./provider-budget";
import { fetchBoundedJson } from "@/lib/http/outbound";
const now = new Date("2026-09-29T12:00:00Z");
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30_000);
beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await client.exec("TRUNCATE provider_spend_windows");
});
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await client.close();
});
it("atomically caps concurrent admissions and rolls back the daily claim when the month is full", async () => {
  vi.stubEnv("PROVIDER_DAILY_BUDGET_USD", "10");
  vi.stubEnv("PROVIDER_MONTHLY_BUDGET_USD", "2");
  const attempts = await Promise.allSettled(
    Array.from({ length: 12 }, () => reserveProviderBudget(1_000_000, now)),
  );
  expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(2);
  for (const window of await db.select().from(schema.providerSpendWindows)) {
    expect(window.reservedMicrousd).toBe(2_000_000);
    expect(window.attempts).toBe(2);
  }
});
it("UTC daily rollover does not replenish the monthly allowance", async () => {
  vi.stubEnv("PROVIDER_DAILY_BUDGET_USD", "1");
  vi.stubEnv("PROVIDER_MONTHLY_BUDGET_USD", "2");
  await reserveProviderBudget(1_000_000, now);
  await expect(reserveProviderBudget(1, now)).rejects.toThrow(
    "provider_budget_unavailable",
  );
  await reserveProviderBudget(1_000_000, new Date("2026-09-30T00:00:00Z"));
  await expect(
    reserveProviderBudget(1, new Date("2026-09-30T12:00:00Z")),
  ).rejects.toThrow();
  await reserveProviderBudget(1_000_000, new Date("2026-10-01T00:00:00Z"));
});
it("zero and malformed limits stop paid HTTP before any network request", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  for (const value of ["0", "typo", "-1"]) {
    vi.stubEnv("PROVIDER_DAILY_BUDGET_USD", value);
    await expect(
      fetchBoundedJson(
        "https://api.deepgram.com/v1/listen",
        { method: "POST", body: new ArrayBuffer(1) },
        { timeoutMs: 1000, maxBytes: 100 },
      ),
    ).rejects.toThrow("provider_budget_unavailable");
  }
  expect(fetch).not.toHaveBeenCalled();
});
it("failed HTTP attempts retain their reservation and retries need a new allowance", async () => {
  vi.stubEnv("PROVIDER_DAILY_BUDGET_USD", "1");
  const fetch = vi.fn().mockRejectedValue(new Error("network"));
  vi.stubGlobal("fetch", fetch);
  const send = () =>
    fetchBoundedJson(
      "https://api.deepgram.com/v1/listen",
      { method: "POST" },
      { timeoutMs: 1000, maxBytes: 100 },
    );
  await expect(send()).rejects.toThrow("network_error");
  await expect(send()).rejects.toThrow("provider_budget_unavailable");
  expect(fetch).toHaveBeenCalledOnce();
});
it("covers each paid provider and leaves ordinary storage/social reads alone", () => {
  for (const url of [
    "https://api.deepgram.com/v1/listen",
    "https://api.groq.com/openai/v1/audio/transcriptions",
    "https://generativelanguage.googleapis.com/v1/models/image:generateContent",
    "https://api.surplusintelligence.ai/v1/images/edits",
    "https://api.surplusintelligence.ai/v1/images/generations",
    "https://api.apify.com/v2/acts/foo/run-sync-get-dataset-items",
  ])
    expect(providerAllowance(url, { method: "POST" })).toBeGreaterThan(0);
  expect(providerAllowance("https://storage.example/video", {})).toBeNull();
  expect(() =>
    providerAllowance("https://provider.example/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ max_completion_tokens: 999_999 }),
    }),
  ).toThrow();
});

it("caps concurrent TikTok fallback reservations independently of the global budget", async () => {
  vi.stubEnv("TIKTOK_IMPORT_DAILY_BUDGET_USD", "0.04");
  vi.stubEnv("TIKTOK_IMPORT_MONTHLY_BUDGET_USD", "0.06");
  const attempts = await Promise.allSettled(
    Array.from({ length: 8 }, () => reserveTikTokImportBudget(now)),
  );
  expect(
    attempts.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(2);
  await reserveTikTokImportBudget(new Date("2026-09-30T00:00:00Z"));
  await expect(
    reserveTikTokImportBudget(new Date("2026-09-30T01:00:00Z")),
  ).rejects.toThrow("provider_budget_unavailable");
  const rows = await db.select().from(schema.providerSpendWindows);
  expect(
    rows.find((row) => row.window === "tiktok-import:month:2026-09")
      ?.reservedMicrousd,
  ).toBe(60_000);
});

it("settles a reservation down to actual cost, never below zero", async () => {
  const reservation = await reserveProviderBudget(1_000_000, now);
  await settleProviderBudget(reservation, 250_000);
  for (const window of await db.select().from(schema.providerSpendWindows))
    expect(window.reservedMicrousd).toBe(250_000);
  // A cost above the reservation leaves the window alone.
  await settleProviderBudget(reservation, 5_000_000);
  for (const window of await db.select().from(schema.providerSpendWindows))
    expect(window.reservedMicrousd).toBe(250_000);
  await settleProviderBudget({ microusd: 9_000_000, at: now }, 0);
  for (const window of await db.select().from(schema.providerSpendWindows)) {
    expect(window.reservedMicrousd).toBe(0);
    expect(window.attempts).toBe(1);
  }
});

it("a Chat Completions reply settles its worst-case admission to the tokens it used", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        choices: [{ message: { content: "{}" } }],
        usage: { prompt_tokens: 1000, completion_tokens: 100 },
      }),
    ),
  );
  await fetchBoundedJson(
    "https://api.surplusintelligence.ai/v1/chat/completions",
    {
      method: "POST",
      body: JSON.stringify({
        model: "gpt-5.4",
        max_completion_tokens: 6000,
        messages: [{ role: "user", content: "x".repeat(20_000) }],
      }),
    },
    { timeoutMs: 1000, maxBytes: 10_000 },
  );
  // Admission claimed about 140,000; the reply used 1000 x 2.5 + 100 x 15.
  const windows = await db.select().from(schema.providerSpendWindows);
  expect(windows).toHaveLength(2);
  for (const window of windows) expect(window.reservedMicrousd).toBe(4000);
});
