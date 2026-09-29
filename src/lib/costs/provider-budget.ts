import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

export class ProviderBudgetError extends Error {
  constructor() {
    super("provider_budget_unavailable");
    this.name = "ProviderBudgetError";
  }
}

function limit(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  // A typo must close the gate, never silently remove the ceiling. Zero is a kill switch.
  if (!Number.isFinite(value) || value < 0 || value > 100_000)
    throw new ProviderBudgetError();
  return Math.floor(value * 1_000_000);
}

/** Reserve before every paid attempt, including retries and background work.
 * Reservations are deliberately never refunded: a timeout/customer refund is
 * not evidence that the provider did no billable work. Fixed UTC windows avoid
 * a token bucket's burst-plus-refill exceeding the advertised daily ceiling. */
export async function reserveProviderBudget(
  microusd: number,
  now = new Date(),
): Promise<void> {
  if (!Number.isSafeInteger(microusd) || microusd <= 0)
    throw new ProviderBudgetError();
  const day = now.toISOString().slice(0, 10);
  const windows = [
    { key: `day:${day}`, cap: limit("PROVIDER_DAILY_BUDGET_USD", 25) },
    {
      key: `month:${day.slice(0, 7)}`,
      cap: limit("PROVIDER_MONTHLY_BUDGET_USD", 250),
    },
  ];
  try {
    await getDb().transaction(async (tx) => {
      for (const window of windows) {
        if (microusd > window.cap) throw new ProviderBudgetError();
        const result = await tx.execute(sql`
          insert into provider_spend_windows ("window", reserved_microusd, attempts, updated_at)
          values (${window.key}, ${microusd}, 1, ${now})
          on conflict ("window") do update set
            reserved_microusd = provider_spend_windows.reserved_microusd + ${microusd},
            attempts = provider_spend_windows.attempts + 1, updated_at = ${now}
          where provider_spend_windows.reserved_microusd + ${microusd} <= ${window.cap}
          returning "window"
        `);
        if (result.rows.length !== 1) throw new ProviderBudgetError();
      }
    });
  } catch {
    console.error("[costs] provider admission refused", {
      day,
      reservedMicrousd: microusd,
    });
    throw new ProviderBudgetError();
  }
}

/** A conservative admission allowance, not an exact cost estimator. Text uses
 * UTF-8 bytes as an upper bound for tokens and an intentionally high rate.
 * Images/audio/video use fixed safety allowances; provider dashboards still
 * need billing alerts and spend limits because third-party rates can change. */
export function providerAllowance(
  input: RequestInfo | URL,
  init: RequestInit,
): number | null {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = (
    init.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  if (url.hostname === "r.jina.ai") return 50_000;
  if (method !== "POST") return null;
  if (url.pathname.endsWith(["", "chat", "completions"].join("/"))) {
    if (typeof init.body !== "string") throw new ProviderBudgetError();
    const body = JSON.parse(init.body);
    const tokens = body.max_completion_tokens;
    if (
      !Number.isSafeInteger(tokens) ||
      tokens <= 0 ||
      tokens > 32_768 ||
      (body.n ?? 1) !== 1
    )
      throw new ProviderBudgetError();
    // Count image inputs separately; base64 length is not a text-token estimate.
    let imageTokens = 0;
    const text = JSON.stringify(body, (key, value) => {
      if (key === "image_url") {
        imageTokens += 16_384;
        return "";
      }
      return value;
    });
    const model = String(body.model ?? "");
    const [inputRate, outputRate] =
      model === "gpt-5.4-mini"
        ? [0.75, 4.5]
        : model === "gpt-5.4"
          ? [2.5, 15]
          : [10, 50];
    return Math.ceil(
      (Buffer.byteLength(text) + imageTokens) * inputRate + tokens * outputRate,
    );
  }
  if (url.hostname === "api.deepgram.com" && url.pathname === "/v1/listen")
    return 1_000_000;
  if (url.pathname.endsWith("/audio/transcriptions")) return 1_000_000;
  if (
    url.hostname === "generativelanguage.googleapis.com" &&
    url.pathname.endsWith(":generateContent")
  )
    return 1_000_000;
  if (url.hostname === "api.apify.com" && url.pathname.includes("/run-sync"))
    return 500_000;
  return null;
}

export function guardProviderEgress(
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<void> | null {
  const allowance = providerAllowance(input, init);
  return allowance === null ? null : reserveProviderBudget(allowance);
}
