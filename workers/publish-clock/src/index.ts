import { DurableObject } from "cloudflare:workers";

/** Never wake sooner than this after a sweep, so clock skew between Cloudflare
 * and Vercel turns into a short wait instead of a tight loop. */
const MIN_GAP_MS = 5_000;

/**
 * Yapper's publish clock: one Durable Object holding one alarm, set to the
 * next moment a scheduled post is due.
 *
 * Yapper calls `/wake` whenever a post is scheduled or moved. At the alarm the
 * clock asks Yapper to send whatever is due, and Yapper answers with the next
 * due time, which becomes the next alarm. So the database is only touched when
 * there is work, instead of every minute. An hourly cron sweeps anyway in case
 * a wake was lost.
 */
export class PublishClock extends DurableObject<Env> {
  /** Moves the alarm earlier when `at` is sooner, never later: a later post
   * must not hide an earlier one. */
  async wake(at: number): Promise<number> {
    const target = Math.max(at, Date.now());
    const current = await this.ctx.storage.getAlarm();
    if (current === null || target < current)
      await this.ctx.storage.setAlarm(target);
    return Math.min(current ?? target, target);
  }

  async next(): Promise<number | null> {
    return this.ctx.storage.getAlarm();
  }

  /** Throwing makes Cloudflare retry the alarm with backoff; if every retry
   * fails, the hourly cron starts it again. */
  async alarm(): Promise<void> {
    const response = await fetch(this.env.SWEEP_URL, {
      headers: {
        Authorization: `Bearer ${this.env.PUBLISH_SCHEDULER_SECRET}`,
      },
    });
    if (!response.ok) throw new Error(`sweep failed: ${response.status}`);
    const result = (await response.json()) as {
      claimed?: number;
      nextDueAt?: string | null;
    };
    console.log("sweep", JSON.stringify(result));
    const next = result.nextDueAt ? Date.parse(result.nextDueAt) : NaN;
    // A wake that arrived during the sweep may already have set an earlier
    // alarm; wake() keeps whichever is sooner.
    if (Number.isFinite(next))
      await this.wake(Math.max(next, Date.now() + MIN_GAP_MS));
  }
}

const clock = (env: Env) => env.CLOCK.get(env.CLOCK.idFromName("publishing"));

function authorized(request: Request, env: Env): boolean {
  const secret = env.PUBLISH_SCHEDULER_SECRET;
  const header = request.headers.get("Authorization") ?? "";
  if (!secret) return false;
  const expected = new TextEncoder().encode(`Bearer ${secret}`);
  const actual = new TextEncoder().encode(header);
  return (
    actual.byteLength === expected.byteLength &&
    crypto.subtle.timingSafeEqual(actual, expected)
  );
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (!authorized(request, env))
      return Response.json({ error: "unauthorized" }, { status: 401 });
    if (request.method === "POST" && pathname === "/wake") {
      const body = (await request.json().catch(() => null)) as {
        at?: unknown;
      } | null;
      const at = typeof body?.at === "string" ? Date.parse(body.at) : NaN;
      if (!Number.isFinite(at))
        return Response.json({ error: "invalid_body" }, { status: 400 });
      const alarm = await clock(env).wake(at);
      return Response.json({ alarm: new Date(alarm).toISOString() });
    }
    if (request.method === "GET" && pathname === "/status") {
      const alarm = await clock(env).next();
      return Response.json({
        alarm: alarm === null ? null : new Date(alarm).toISOString(),
      });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(clock(env).wake(Date.now()));
  },
} satisfies ExportedHandler<Env>;
