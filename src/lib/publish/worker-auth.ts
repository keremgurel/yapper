import { timingSafeEqual } from "node:crypto";

/** True when the request carries `Bearer <secret>` for one of the worker
 * secrets: Vercel Cron's CRON_SECRET or the publish clock's own secret. */
export function isWorkerRequest(request: Request): boolean {
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return [process.env.CRON_SECRET, process.env.PUBLISH_SCHEDULER_SECRET].some(
    (secret) => {
      if (!secret) return false;
      const expected = Buffer.from(`Bearer ${secret}`);
      return (
        actual.length === expected.length && timingSafeEqual(actual, expected)
      );
    },
  );
}
