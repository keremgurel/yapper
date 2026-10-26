/**
 * Tells the publish clock (a Cloudflare Durable Object, see `scheduler/`) when
 * the next post is due, so it wakes at that minute instead of polling.
 *
 * Best effort by design: the clock also sweeps on its own every hour, and each
 * sweep returns the next due time, so a lost wake delays a post rather than
 * dropping it. Never throws.
 */
export async function wakePublishClock(at: Date): Promise<void> {
  const url = process.env.PUBLISH_SCHEDULER_URL;
  const secret = process.env.PUBLISH_SCHEDULER_SECRET;
  if (!url || !secret) return;
  try {
    const response = await fetch(new URL("/wake", url), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ at: at.toISOString() }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok)
      console.warn("[publish-clock] wake rejected", response.status);
  } catch (error) {
    console.warn("[publish-clock] wake failed", error);
  }
}
