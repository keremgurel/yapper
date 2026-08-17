import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { deleteObject } from "@/lib/r2";
import { getDb, type DbTx } from "./client";
import {
  importedPlatformMedia,
  publishJobs,
  r2Objects,
  submissions,
  users,
  type R2ObjectPurpose,
  type R2ObjectState,
} from "./schema";
import {
  lockMediaReferenceWithinTx,
  lockStorageUserWithinTx,
} from "./storage-accounting";

const ACTIVE_PUBLISH_STATES = ["queued", "uploading", "processing"] as const;
const DEFAULT_LEASE_MS = 60_000;
const DELETE_TIMEOUT_MS = 20_000;
const MAX_BATCH_SIZE = 50;
const MAX_PENDING_OBJECTS_PER_USER = 100;
const RETRY_BASE_MS = 60_000;
const RETRY_MAX_MS = 24 * 60 * 60 * 1_000;
const PUBLISH_DEFERRAL_MS = 5 * 60 * 1_000;
const PUBLISH_REFERENCE_TTL_MS = 15 * 60 * 1_000;
const MAX_ERROR_LENGTH = 2_000;

export class R2ObjectNotAttachableError extends Error {
  constructor() {
    super("r2_object_not_attachable");
    this.name = "R2ObjectNotAttachableError";
  }
}

export class R2PendingAllocationLimitError extends Error {
  constructor() {
    super("r2_pending_allocation_limit");
    this.name = "R2PendingAllocationLimitError";
  }
}

export class R2ObjectOwnerMissingError extends Error {
  constructor() {
    super("r2_object_owner_missing");
    this.name = "R2ObjectOwnerMissingError";
  }
}

export class R2PendingStorageQuotaError extends Error {
  constructor() {
    super("storage_full");
    this.name = "R2PendingStorageQuotaError";
  }
}

export interface R2DeletionClaim {
  mediaKey: string;
  userId: string;
  leaseToken: string;
  attempts: number;
}

type R2ObjectRow = typeof r2Objects.$inferSelect;

async function lockObjectRow(
  tx: DbTx,
  userId: string,
  mediaKey: string,
): Promise<R2ObjectRow | undefined> {
  await lockStorageUserWithinTx(tx, userId);
  await lockMediaReferenceWithinTx(tx, userId, mediaKey);
  const [row] = await tx
    .select()
    .from(r2Objects)
    .where(and(eq(r2Objects.userId, userId), eq(r2Objects.mediaKey, mediaKey)))
    .limit(1)
    .for("update");
  return row;
}

/** Register intent before issuing a presigned PUT or starting a server upload. */
export async function allocatePendingObject(
  userId: string,
  mediaKey: string,
  purpose: R2ObjectPurpose,
  mediaBytes: number,
  quotaBytes: number,
  deleteNotBefore: Date,
  uploadExpiresAt: Date = deleteNotBefore,
): Promise<boolean> {
  if (
    !Number.isSafeInteger(mediaBytes) ||
    mediaBytes < 0 ||
    !Number.isSafeInteger(quotaBytes) ||
    quotaBytes < 0
  ) {
    throw new Error("invalid_storage_reservation");
  }
  return getDb().transaction(async (tx) => {
    await lockStorageUserWithinTx(tx, userId);
    await lockMediaReferenceWithinTx(tx, userId, mediaKey);
    const [owner] = await tx
      .select({ storageBytes: users.storageBytes })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!owner) throw new R2ObjectOwnerMissingError();
    const [existing] = await tx
      .select({ mediaKey: r2Objects.mediaKey })
      .from(r2Objects)
      .where(eq(r2Objects.mediaKey, mediaKey))
      .limit(1);
    if (existing) return false;
    const [pending] = await tx
      .select({
        count: sql<number>`count(*)::int`,
        mediaBytes: sql<number>`coalesce(sum(${r2Objects.mediaBytes}), 0)::double precision`,
      })
      .from(r2Objects)
      .where(
        and(
          eq(r2Objects.userId, userId),
          eq(r2Objects.state, "pending_upload"),
        ),
      );
    if ((pending?.count ?? 0) >= MAX_PENDING_OBJECTS_PER_USER) {
      throw new R2PendingAllocationLimitError();
    }
    const pendingBytes = Number(pending?.mediaBytes ?? 0);
    if (!Number.isSafeInteger(pendingBytes) || pendingBytes < 0) {
      throw new Error("invalid_pending_storage_total");
    }
    if (owner.storageBytes + pendingBytes + mediaBytes > quotaBytes) {
      throw new R2PendingStorageQuotaError();
    }
    const inserted = await tx
      .insert(r2Objects)
      .values({
        userId,
        mediaKey,
        purpose,
        state: "pending_upload",
        mediaBytes,
        uploadExpiresAt,
        deleteNotBefore,
        nextAttemptAt: deleteNotBefore,
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ mediaKey: r2Objects.mediaKey });
    return inserted.length === 1;
  });
}

/** Undo allocation when URL signing fails before any presigned capability was
 * returned. The state/purpose fence prevents a delayed failure handler from
 * removing an object that another path has already activated. */
export async function abandonPendingObject(
  userId: string,
  mediaKey: string,
  expectedPurpose: R2ObjectPurpose,
): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const row = await lockObjectRow(tx, userId, mediaKey);
    if (
      !row ||
      row.state !== "pending_upload" ||
      row.purpose !== expectedPurpose
    ) {
      return false;
    }
    const removed = await tx
      .delete(r2Objects)
      .where(
        and(
          eq(r2Objects.userId, userId),
          eq(r2Objects.mediaKey, mediaKey),
          eq(r2Objects.state, "pending_upload"),
          eq(r2Objects.purpose, expectedPurpose),
        ),
      )
      .returning({ mediaKey: r2Objects.mediaKey });
    return removed.length === 1;
  });
}

/**
 * Attach an uploaded object to durable application state. The caller's
 * reference write and this transition belong in the same transaction.
 * Repeated lock calls are harmless because PostgreSQL xact locks are reentrant.
 */
export async function activateObjectWithinTx(
  tx: DbTx,
  userId: string,
  mediaKey: string,
  mediaBytes: number,
  expectedPurpose: R2ObjectPurpose = "recording",
): Promise<void> {
  if (!Number.isSafeInteger(mediaBytes) || mediaBytes < 0) {
    throw new Error("invalid_media_bytes");
  }
  const row = await lockObjectRow(tx, userId, mediaKey);
  if (
    !row ||
    row.purpose !== expectedPurpose ||
    !(
      ["pending_upload", "active", "delete_pending"] as R2ObjectState[]
    ).includes(row.state)
  ) {
    throw new R2ObjectNotAttachableError();
  }
  await tx
    .update(r2Objects)
    .set({
      state: "active",
      mediaBytes,
      uploadExpiresAt: null,
      deleteNotBefore: null,
      nextAttemptAt: null,
      leaseToken: null,
      leaseExpiresAt: null,
      deleteReason: null,
      lastError: null,
      deletedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(r2Objects.userId, userId), eq(r2Objects.mediaKey, mediaKey)));
}

export async function isActiveR2Object(
  userId: string,
  mediaKey: string,
): Promise<boolean> {
  const [row] = await getDb()
    .select({ mediaKey: r2Objects.mediaKey })
    .from(r2Objects)
    .where(
      and(
        eq(r2Objects.userId, userId),
        eq(r2Objects.mediaKey, mediaKey),
        eq(r2Objects.state, "active"),
      ),
    )
    .limit(1);
  return !!row;
}

/** Keep an allocated object alive while a bounded operation consumes it. */
export async function protectPendingObject(
  userId: string,
  mediaKey: string,
  expectedPurpose: R2ObjectPurpose,
  until: Date,
): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const row = await lockObjectRow(tx, userId, mediaKey);
    if (
      !row ||
      row.purpose !== expectedPurpose ||
      (row.state !== "pending_upload" && row.state !== "active")
    ) {
      return false;
    }
    await tx
      .update(r2Objects)
      .set({
        deleteNotBefore: sql`greatest(coalesce(${r2Objects.deleteNotBefore}, ${until}), ${until})`,
        nextAttemptAt: sql`greatest(coalesce(${r2Objects.nextAttemptAt}, ${until}), ${until})`,
        uploadExpiresAt:
          row.state === "pending_upload"
            ? sql`greatest(coalesce(${r2Objects.uploadExpiresAt}, ${until}), ${until})`
            : null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(r2Objects.userId, userId), eq(r2Objects.mediaKey, mediaKey)),
      );
    return true;
  });
}

export function protectPendingThumbnail(
  userId: string,
  mediaKey: string,
  until: Date,
): Promise<boolean> {
  return protectPendingObject(userId, mediaKey, "thumbnail", until);
}

async function hasDurableR2ReferencesWithinTx(
  tx: DbTx,
  userId: string,
  mediaKey: string,
): Promise<boolean> {
  const [submission] = await tx
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(eq(submissions.userId, userId), eq(submissions.mediaKey, mediaKey)),
    )
    .limit(1);
  if (submission) return true;

  const [imported] = await tx
    .select({ id: importedPlatformMedia.id })
    .from(importedPlatformMedia)
    .where(
      and(
        eq(importedPlatformMedia.userId, userId),
        eq(importedPlatformMedia.mediaKey, mediaKey),
      ),
    )
    .limit(1);
  return !!imported;
}

async function hasActivePublishReferenceWithinTx(
  tx: DbTx,
  userId: string,
  mediaKey: string,
  now: Date,
): Promise<boolean> {
  const [publish] = await tx
    .select({ id: publishJobs.id, updatedAt: publishJobs.updatedAt })
    .from(publishJobs)
    .where(
      and(
        eq(publishJobs.userId, userId),
        eq(publishJobs.mediaKey, mediaKey),
        inArray(publishJobs.status, ACTIVE_PUBLISH_STATES),
        sql`${publishJobs.updatedAt} >= ${new Date(now.getTime() - PUBLISH_REFERENCE_TTL_MS)}`,
      ),
    )
    .limit(1);
  return (
    !!publish &&
    publish.updatedAt >= new Date(now.getTime() - PUBLISH_REFERENCE_TTL_MS)
  );
}

export async function hasLiveR2ReferencesWithinTx(
  tx: DbTx,
  userId: string,
  mediaKey: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (await hasDurableR2ReferencesWithinTx(tx, userId, mediaKey)) return true;
  return hasActivePublishReferenceWithinTx(tx, userId, mediaKey, now);
}

export async function enqueueObjectDeletionWithinTx(
  tx: DbTx,
  userId: string,
  mediaKey: string,
  reason: string,
  notBefore: Date = new Date(),
  purpose: R2ObjectPurpose = "recording",
): Promise<"enqueued" | "referenced" | "missing" | "deleted"> {
  const row = await lockObjectRow(tx, userId, mediaKey);
  if (!row) {
    const inserted = await tx
      .insert(r2Objects)
      .values({
        userId,
        mediaKey,
        purpose,
        state: "delete_pending",
        deleteNotBefore: notBefore,
        nextAttemptAt: notBefore,
        deleteReason: reason,
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ mediaKey: r2Objects.mediaKey });
    if (inserted.length === 0) throw new Error("r2_registry_owner_conflict");
    return "enqueued";
  }
  if (row.state === "deleted") return "deleted";
  if (await hasDurableR2ReferencesWithinTx(tx, userId, mediaKey)) {
    if (row.state !== "deleting") {
      await tx
        .update(r2Objects)
        .set({
          state: "active",
          deleteNotBefore: null,
          nextAttemptAt: null,
          deleteReason: null,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(r2Objects.mediaKey, mediaKey));
    }
    return "referenced";
  }
  if (row.state === "deleting") {
    // A leased worker may already be deleting outside the transaction. Only
    // activation is allowed to cancel before a lease is issued.
    return "enqueued";
  }
  const effectiveNotBefore = [
    notBefore,
    row.uploadExpiresAt,
    row.deleteNotBefore,
  ]
    .filter((date): date is Date => !!date)
    .reduce((latest, date) => (date > latest ? date : latest), notBefore);
  const publishActive = await hasActivePublishReferenceWithinTx(
    tx,
    userId,
    mediaKey,
    notBefore,
  );
  const nextAttemptAt = publishActive
    ? new Date(
        Math.max(
          effectiveNotBefore.getTime(),
          // The instant this transaction is reasoning about, not whatever the
          // wall clock says while it runs. Everything else here is derived from
          // `notBefore`, and mixing the two made the deferral depend on the day
          // the code happened to run: the test for it had been failing on main
          // for that reason alone.
          notBefore.getTime() + PUBLISH_DEFERRAL_MS,
        ),
      )
    : effectiveNotBefore;
  await tx
    .update(r2Objects)
    .set({
      state: "delete_pending",
      deleteNotBefore: effectiveNotBefore,
      nextAttemptAt,
      leaseToken: null,
      leaseExpiresAt: null,
      deleteReason: reason,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(r2Objects.mediaKey, mediaKey));
  return "enqueued";
}

export async function enqueueObjectDeletion(
  userId: string,
  mediaKey: string,
  reason: string,
  notBefore: Date = new Date(),
  purpose: R2ObjectPurpose = "recording",
) {
  return getDb().transaction((tx) =>
    enqueueObjectDeletionWithinTx(
      tx,
      userId,
      mediaKey,
      reason,
      notBefore,
      purpose,
    ),
  );
}

/** Record a definitive HeadObject miss; deleting is fenced by its lease token. */
export async function markObjectMissingWithinTx(
  tx: DbTx,
  userId: string,
  mediaKey: string,
  reason: string,
): Promise<boolean> {
  const row = await lockObjectRow(tx, userId, mediaKey);
  if (!row || row.state === "deleting") return false;
  const now = new Date();
  await tx
    .update(r2Objects)
    .set({
      state: "deleted",
      leaseToken: null,
      leaseExpiresAt: null,
      nextAttemptAt: null,
      deleteReason: reason,
      lastError: null,
      deletedAt: now,
      updatedAt: now,
    })
    .where(eq(r2Objects.mediaKey, mediaKey));
  return true;
}

/** Force-enqueue all owned objects in the same transaction as account cleanup. */
export async function enqueueAllUserObjectsWithinTx(
  tx: DbTx,
  userId: string,
  reason: string,
): Promise<number> {
  await lockStorageUserWithinTx(tx, userId);
  const registryRows = await tx
    .select({
      mediaKey: r2Objects.mediaKey,
      purpose: r2Objects.purpose,
      mediaBytes: r2Objects.mediaBytes,
    })
    .from(r2Objects)
    .where(
      and(eq(r2Objects.userId, userId), sql`${r2Objects.state} <> 'deleted'`),
    )
    .orderBy(asc(r2Objects.mediaKey));
  const submissionRows = await tx
    .select({
      mediaKey: submissions.mediaKey,
      mediaBytes: submissions.mediaBytes,
    })
    .from(submissions)
    .where(
      and(eq(submissions.userId, userId), isNotNull(submissions.mediaKey)),
    );
  const importRows = await tx
    .select({
      mediaKey: importedPlatformMedia.mediaKey,
      mediaBytes: importedPlatformMedia.mediaBytes,
    })
    .from(importedPlatformMedia)
    .where(eq(importedPlatformMedia.userId, userId));
  const owned = new Map<
    string,
    { purpose: R2ObjectPurpose; mediaBytes: number }
  >();
  for (const row of registryRows) {
    owned.set(row.mediaKey, {
      purpose: row.purpose,
      mediaBytes: row.mediaBytes,
    });
  }
  for (const row of submissionRows) {
    if (row.mediaKey && !owned.has(row.mediaKey)) {
      owned.set(row.mediaKey, {
        purpose: "recording",
        mediaBytes: row.mediaBytes,
      });
    }
  }
  for (const row of importRows) {
    const previous = owned.get(row.mediaKey);
    owned.set(row.mediaKey, {
      purpose: "import",
      mediaBytes: Math.max(previous?.mediaBytes ?? 0, row.mediaBytes),
    });
  }
  const rows = [...owned.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const now = new Date();
  let count = 0;
  for (const [mediaKey, owner] of rows) {
    await lockMediaReferenceWithinTx(tx, userId, mediaKey);
    const [row] = await tx
      .select({
        state: r2Objects.state,
        uploadExpiresAt: r2Objects.uploadExpiresAt,
        deleteNotBefore: r2Objects.deleteNotBefore,
      })
      .from(r2Objects)
      .where(
        and(eq(r2Objects.userId, userId), eq(r2Objects.mediaKey, mediaKey)),
      )
      .limit(1)
      .for("update");
    if (!row) {
      await tx.insert(r2Objects).values({
        userId,
        mediaKey,
        purpose: owner.purpose,
        state: "delete_pending",
        mediaBytes: owner.mediaBytes,
        deleteNotBefore: now,
        nextAttemptAt: now,
        deleteReason: reason,
        updatedAt: now,
      });
      count += 1;
      continue;
    }
    if (row.state === "deleted" || row.state === "deleting") continue;
    const notBefore = [now, row.uploadExpiresAt, row.deleteNotBefore]
      .filter((date): date is Date => !!date)
      .reduce((latest, date) => (date > latest ? date : latest), now);
    await tx
      .update(r2Objects)
      .set({
        state: "delete_pending",
        deleteNotBefore: notBefore,
        nextAttemptAt: notBefore,
        leaseToken: null,
        leaseExpiresAt: null,
        deleteReason: reason,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(r2Objects.mediaKey, mediaKey));
    count += 1;
  }
  return count;
}

function isEligible(row: R2ObjectRow, now: Date): boolean {
  if (row.state === "deleting") {
    return !!row.leaseExpiresAt && row.leaseExpiresAt <= now;
  }
  if (row.state === "pending_upload") {
    return (
      !!row.uploadExpiresAt &&
      row.uploadExpiresAt <= now &&
      (!row.deleteNotBefore || row.deleteNotBefore <= now) &&
      (!row.nextAttemptAt || row.nextAttemptAt <= now)
    );
  }
  return (
    row.state === "delete_pending" &&
    (!row.deleteNotBefore || row.deleteNotBefore <= now) &&
    (!row.nextAttemptAt || row.nextAttemptAt <= now)
  );
}

/** Claim one object transactionally; the physical delete always happens later. */
export async function claimNextR2Object(
  now: Date,
  leaseMs = DEFAULT_LEASE_MS,
  tokenFactory: () => string = randomUUID,
): Promise<R2DeletionClaim | null> {
  const candidates = await getDb()
    .select({ mediaKey: r2Objects.mediaKey, userId: r2Objects.userId })
    .from(r2Objects)
    .where(
      or(
        and(
          eq(r2Objects.state, "delete_pending"),
          or(
            isNull(r2Objects.deleteNotBefore),
            lte(r2Objects.deleteNotBefore, now),
          ),
          or(
            isNull(r2Objects.nextAttemptAt),
            lte(r2Objects.nextAttemptAt, now),
          ),
        ),
        and(
          eq(r2Objects.state, "pending_upload"),
          lte(r2Objects.uploadExpiresAt, now),
          or(
            isNull(r2Objects.deleteNotBefore),
            lte(r2Objects.deleteNotBefore, now),
          ),
          or(
            isNull(r2Objects.nextAttemptAt),
            lte(r2Objects.nextAttemptAt, now),
          ),
        ),
        and(
          eq(r2Objects.state, "deleting"),
          lte(r2Objects.leaseExpiresAt, now),
        ),
      ),
    )
    .orderBy(asc(r2Objects.userId), asc(r2Objects.mediaKey))
    .limit(100);

  for (const candidate of candidates) {
    const claim = await getDb().transaction(async (tx) => {
      const row = await lockObjectRow(tx, candidate.userId, candidate.mediaKey);
      if (!row || !isEligible(row, now)) return null;
      if (
        await hasDurableR2ReferencesWithinTx(
          tx,
          candidate.userId,
          candidate.mediaKey,
        )
      ) {
        await tx
          .update(r2Objects)
          .set({
            state: "active",
            leaseToken: null,
            leaseExpiresAt: null,
            deleteNotBefore: null,
            nextAttemptAt: null,
            deleteReason: null,
            lastError: null,
            updatedAt: now,
          })
          .where(eq(r2Objects.mediaKey, candidate.mediaKey));
        return null;
      }
      if (
        await hasActivePublishReferenceWithinTx(
          tx,
          candidate.userId,
          candidate.mediaKey,
          now,
        )
      ) {
        await tx
          .update(r2Objects)
          .set({
            state: "delete_pending",
            leaseToken: null,
            leaseExpiresAt: null,
            nextAttemptAt: new Date(now.getTime() + PUBLISH_DEFERRAL_MS),
            updatedAt: now,
          })
          .where(eq(r2Objects.mediaKey, candidate.mediaKey));
        return null;
      }
      const leaseToken = tokenFactory();
      const attempts = row.attempts + 1;
      await tx
        .update(r2Objects)
        .set({
          state: "deleting",
          leaseToken,
          leaseExpiresAt: new Date(now.getTime() + leaseMs),
          nextAttemptAt: new Date(now.getTime() + leaseMs),
          attempts,
          updatedAt: now,
        })
        .where(eq(r2Objects.mediaKey, candidate.mediaKey));
      return {
        mediaKey: candidate.mediaKey,
        userId: candidate.userId,
        leaseToken,
        attempts,
      } satisfies R2DeletionClaim;
    });
    if (claim) return claim;
  }
  return null;
}

export async function completeR2Deletion(
  claim: R2DeletionClaim,
  now: Date,
): Promise<boolean> {
  const updated = await getDb()
    .update(r2Objects)
    .set({
      state: "deleted",
      leaseToken: null,
      leaseExpiresAt: null,
      nextAttemptAt: null,
      lastError: null,
      deletedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(r2Objects.mediaKey, claim.mediaKey),
        eq(r2Objects.userId, claim.userId),
        eq(r2Objects.state, "deleting"),
        eq(r2Objects.leaseToken, claim.leaseToken),
      ),
    )
    .returning({ mediaKey: r2Objects.mediaKey });
  return updated.length === 1;
}

export function r2RetryDelayMs(attempts: number): number {
  return Math.min(
    RETRY_MAX_MS,
    RETRY_BASE_MS * 2 ** Math.max(0, Math.min(30, attempts - 1)),
  );
}

function errorText(error: unknown): string {
  const text =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.slice(0, MAX_ERROR_LENGTH);
}

export async function retryR2Deletion(
  claim: R2DeletionClaim,
  error: unknown,
  now: Date,
): Promise<boolean> {
  const updated = await getDb()
    .update(r2Objects)
    .set({
      state: "delete_pending",
      leaseToken: null,
      leaseExpiresAt: null,
      nextAttemptAt: new Date(now.getTime() + r2RetryDelayMs(claim.attempts)),
      lastError: errorText(error),
      updatedAt: now,
    })
    .where(
      and(
        eq(r2Objects.mediaKey, claim.mediaKey),
        eq(r2Objects.userId, claim.userId),
        eq(r2Objects.state, "deleting"),
        eq(r2Objects.leaseToken, claim.leaseToken),
      ),
    )
    .returning({ mediaKey: r2Objects.mediaKey });
  return updated.length === 1;
}

function isNotFound(error: unknown): boolean {
  const value = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    value?.name === "NotFound" ||
    value?.name === "NoSuchKey" ||
    value?.name === "404" ||
    value?.$metadata?.httpStatusCode === 404
  );
}

export interface R2LifecycleWorkerDependencies {
  claim(
    now: Date,
    leaseMs: number,
    tokenFactory: () => string,
  ): Promise<R2DeletionClaim | null>;
  remove(mediaKey: string, signal?: AbortSignal): Promise<void>;
  complete(claim: R2DeletionClaim, now: Date): Promise<boolean>;
  retry(claim: R2DeletionClaim, error: unknown, now: Date): Promise<boolean>;
  now(): Date;
  tokenFactory(): string;
}

const workerDependencies: R2LifecycleWorkerDependencies = {
  claim: claimNextR2Object,
  remove: deleteObject,
  complete: completeR2Deletion,
  retry: retryR2Deletion,
  now: () => new Date(),
  tokenFactory: randomUUID,
};

export interface R2LifecycleBatchResult {
  claimed: number;
  deleted: number;
  retried: number;
  staleCompletions: number;
  deadlineReached: boolean;
}

export async function processR2LifecycleBatch(
  options: { limit?: number; deadlineAt?: number; leaseMs?: number } = {},
  dependencies: R2LifecycleWorkerDependencies = workerDependencies,
): Promise<R2LifecycleBatchResult> {
  const limit = Math.max(
    1,
    Math.min(MAX_BATCH_SIZE, Math.trunc(options.limit ?? 10)),
  );
  const leaseMs = Math.max(1_000, options.leaseMs ?? DEFAULT_LEASE_MS);
  const result: R2LifecycleBatchResult = {
    claimed: 0,
    deleted: 0,
    retried: 0,
    staleCompletions: 0,
    deadlineReached: false,
  };
  for (let index = 0; index < limit; index += 1) {
    const now = dependencies.now();
    if (
      options.deadlineAt !== undefined &&
      now.getTime() >= options.deadlineAt
    ) {
      result.deadlineReached = true;
      break;
    }
    const claim = await dependencies.claim(
      now,
      leaseMs,
      dependencies.tokenFactory,
    );
    if (!claim) break;
    result.claimed += 1;
    try {
      const remainingMs =
        options.deadlineAt === undefined
          ? Math.min(leaseMs, DELETE_TIMEOUT_MS)
          : Math.min(
              leaseMs,
              DELETE_TIMEOUT_MS,
              options.deadlineAt - now.getTime(),
            );
      await dependencies.remove(
        claim.mediaKey,
        AbortSignal.timeout(Math.max(1, remainingMs)),
      );
      const completed = await dependencies.complete(claim, dependencies.now());
      if (completed) result.deleted += 1;
      else result.staleCompletions += 1;
    } catch (error) {
      if (isNotFound(error)) {
        const completed = await dependencies.complete(
          claim,
          dependencies.now(),
        );
        if (completed) result.deleted += 1;
        else result.staleCompletions += 1;
      } else {
        const retried = await dependencies.retry(
          claim,
          error,
          dependencies.now(),
        );
        if (retried) result.retried += 1;
        else result.staleCompletions += 1;
      }
    }
  }
  return result;
}
