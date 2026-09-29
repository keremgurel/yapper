/** Account-scoped repair. Dry run unless --apply is supplied.
 * node --env-file=.env.local --import tsx scripts/cleanup-poster-media.ts --user-id USER [--apply]
 */
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../src/lib/db/client";
import {
  findSupersededMedia,
  releasePostedMedia,
} from "../src/lib/db/posted-media-retention";
import {
  claimNextR2Object,
  completeR2Deletion,
  processR2LifecycleBatch,
  retryR2Deletion,
} from "../src/lib/db/r2-lifecycle";
import { r2Objects, users } from "../src/lib/db/schema";
import { deleteObject, headObjectBytes } from "../src/lib/r2";

async function main() {
  const args = process.argv.slice(2);
  const userIndex = args.indexOf("--user-id");
  const userId = userIndex >= 0 ? args[userIndex + 1] : undefined;
  if (!userId || userId.startsWith("--"))
    throw new Error("--user-id is required");
  const db = getDb();
  const [owner] = await db
    .select({ id: users.id, bytes: users.storageBytes })
    .from(users)
    .where(eq(users.id, userId));
  if (!owner) throw new Error("Account not found");
  const candidates = await findSupersededMedia(500, owner.id);
  const inventory = await db.execute<{
    media_key: string;
    title: string | null;
    bytes: number;
  }>(sql`
    select r.media_key, coalesce(
      (select s.title from submissions s where s.user_id = r.user_id and s.media_key = r.media_key limit 1),
      (select i.title from imported_platform_media i where i.user_id = r.user_id and i.media_key = r.media_key limit 1)
    ) as title, r.media_bytes::double precision as bytes
    from r2_objects r where r.user_id = ${owner.id} and r.state = 'active'
  `);
  console.log(
    JSON.stringify(
      {
        mode: args.includes("--apply") ? "apply" : "dry-run",
        beforeBytes: owner.bytes,
        candidates: candidates.map(
          (c) => inventory.rows.find((r) => r.media_key === c.mediaKey) ?? c,
        ),
      },
      null,
      2,
    ),
  );
  if (!args.includes("--apply")) return;
  const released: string[] = [];
  for (const candidate of candidates) {
    if ((await releasePostedMedia(candidate, "superseded")) === "released")
      released.push(candidate.mediaKey);
  }
  const deletion = await processR2LifecycleBatch(
    { limit: 500, deadlineAt: Date.now() + 45_000 },
    {
      claim: (now, leaseMs, tokenFactory) =>
        claimNextR2Object(now, leaseMs, tokenFactory, owner.id),
      remove: deleteObject,
      complete: completeR2Deletion,
      retry: retryR2Deletion,
      now: () => new Date(),
      tokenFactory: randomUUID,
    },
  );
  const verification = await Promise.all(
    released.map(async (key) => ({
      key,
      absent: (await headObjectBytes(key)) === null,
    })),
  );
  const [after] = await db
    .select({ bytes: users.storageBytes })
    .from(users)
    .where(eq(users.id, owner.id));
  const remaining = await db
    .select({
      purpose: r2Objects.purpose,
      state: r2Objects.state,
      bytes: r2Objects.mediaBytes,
    })
    .from(r2Objects)
    .where(eq(r2Objects.userId, owner.id));
  console.log(
    JSON.stringify(
      {
        released: released.length,
        deletion,
        verification,
        afterBytes: after.bytes,
        active: remaining.filter((row) => row.state === "active"),
      },
      null,
      2,
    ),
  );
  if (verification.some((row) => !row.absent) || deletion.retried)
    throw new Error("Some physical deletions remain queued for retry");
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Cleanup failed");
    process.exit(1);
  });
