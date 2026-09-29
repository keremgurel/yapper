import { eq } from "drizzle-orm";
import { listMediaObjects } from "@/lib/r2";
import { getDb } from "./client";
import { queueUntrackedR2Object } from "./r2-lifecycle";
import { maintenanceCursors } from "./schema";

const CURSOR_NAME = "r2-inventory";
const MIN_AGE_MS = 2 * 24 * 60 * 60 * 1000;

const dependencies = {
  list: listMediaObjects,
  queue: queueUntrackedR2Object,
  async readCursor() {
    const [row] = await getDb()
      .select()
      .from(maintenanceCursors)
      .where(eq(maintenanceCursors.name, CURSOR_NAME))
      .limit(1);
    return row?.cursor ?? undefined;
  },
  async writeCursor(cursor: string | null) {
    await getDb()
      .insert(maintenanceCursors)
      .values({ name: CURSOR_NAME, cursor })
      .onConflictDoUpdate({
        target: maintenanceCursors.name,
        set: { cursor, updatedAt: new Date() },
      });
  },
  now: () => Date.now(),
};

/** At most one 1,000-object page and a short time budget per daily run. Skip
 * fresh/unknown keys, quarantine legacy orphans for a day, and resume after
 * the last examined key. Never delete directly from an inventory snapshot. */
export async function reconcileR2Inventory(
  deadlineAt = Date.now() + 8_000,
  deps = dependencies,
) {
  const cursor = await deps.readCursor();
  const page = await deps.list(cursor);
  const now = new Date(deps.now());
  let scanned = 0;
  let enqueued = 0;
  let bytesQueued = 0;
  let nextCursor = cursor ?? null;
  for (const object of page.objects) {
    if (deps.now() >= deadlineAt) break;
    const match =
      /^u\/(user_[A-Za-z0-9_]+)\/[^/]+\.(?:mp4|mov|m4a|wav|webm|png|jpe?g|webp)$/i.exec(
        object.key,
      ) ?? /^asr\/(user_[A-Za-z0-9_]+)\/[^/]+\.m4a$/i.exec(object.key);
    if (
      match &&
      object.modifiedAt.getTime() <= now.getTime() - MIN_AGE_MS &&
      Number.isSafeInteger(object.bytes) &&
      object.bytes >= 0
    ) {
      if (await deps.queue(match[1], object.key, object.bytes, now)) {
        enqueued += 1;
        bytesQueued += object.bytes;
      }
    }
    scanned += 1;
    nextCursor = object.key;
  }
  const complete = scanned === page.objects.length && !page.hasMore;
  await deps.writeCursor(complete ? null : nextCursor);
  return { scanned, enqueued, bytesQueued, complete };
}
