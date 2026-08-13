import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbTx } from "./client";
import {
  importedPlatformMedia,
  publishJobs,
  r2Objects,
  submissions,
  users,
} from "./schema";

const harness = vi.hoisted(() => ({
  events: [] as string[],
  rows: new Map<unknown, unknown[][]>(),
  updates: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  deletes: 0,
  returning: [] as unknown[][],
}));

function resultChain(rows: unknown[]) {
  const chain = {
    where: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    for: vi.fn(async () => rows),
    onConflictDoNothing: vi.fn(() => chain),
    returning: vi.fn(async () => harness.returning.shift() ?? []),
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

const tx = {
  select: vi.fn(() => ({
    from: vi.fn((table: unknown) => {
      const queue = harness.rows.get(table) ?? [];
      return resultChain(queue.shift() ?? []);
    }),
  })),
  update: vi.fn(() => ({
    set: vi.fn((values: Record<string, unknown>) => {
      harness.updates.push(values);
      return resultChain([]);
    }),
  })),
  insert: vi.fn(() => ({
    values: vi.fn((values: Record<string, unknown>) => {
      harness.inserts.push(values);
      return resultChain([]);
    }),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(async () => {
        harness.deletes += 1;
        return harness.returning.shift() ?? [];
      }),
    })),
  })),
  execute: vi.fn(),
} as unknown as DbTx;

const transaction = vi.fn(async (callback: (value: DbTx) => unknown) =>
  callback(tx),
);
const db = {
  transaction,
  select: (...args: unknown[]) =>
    (tx.select as unknown as (...values: unknown[]) => unknown)(...args),
  update: (...args: unknown[]) =>
    (tx.update as unknown as (...values: unknown[]) => unknown)(...args),
};

vi.mock("./client", () => ({ getDb: () => db }));
vi.mock("./storage-accounting", () => ({
  lockStorageUserWithinTx: vi.fn(async (_tx: DbTx, userId: string) => {
    harness.events.push(`user:${userId}`);
  }),
  lockMediaReferenceWithinTx: vi.fn(
    async (_tx: DbTx, userId: string, mediaKey: string) => {
      harness.events.push(`object:${userId}:${mediaKey}`);
    },
  ),
}));
vi.mock("@/lib/r2", () => ({ deleteObject: vi.fn() }));

import {
  R2ObjectNotAttachableError,
  R2ObjectOwnerMissingError,
  R2PendingStorageQuotaError,
  activateObjectWithinTx,
  abandonPendingObject,
  allocatePendingObject,
  claimNextR2Object,
  completeR2Deletion,
  enqueueAllUserObjectsWithinTx,
  enqueueObjectDeletionWithinTx,
  protectPendingObject,
  retryR2Deletion,
} from "./r2-lifecycle";

const now = new Date("2026-08-13T12:00:00.000Z");
const key = "u/user_test/object.mp4";

function queue(table: unknown, ...rows: unknown[][]) {
  harness.rows.set(table, rows);
}

function object(state: string, extra: Record<string, unknown> = {}) {
  return {
    mediaKey: key,
    userId: "user_test",
    purpose: "recording",
    state,
    mediaBytes: 0,
    uploadExpiresAt: null,
    deleteNotBefore: null,
    nextAttemptAt: null,
    leaseToken: null,
    leaseExpiresAt: null,
    attempts: 0,
    deleteReason: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...extra,
  };
}

beforeEach(() => {
  harness.events.length = 0;
  harness.rows.clear();
  harness.updates.length = 0;
  harness.inserts.length = 0;
  harness.deletes = 0;
  harness.returning.length = 0;
  vi.clearAllMocks();
});

describe("R2 lifecycle transaction protocol", () => {
  it("reserves pending bytes under the user lock and handles PG numeric strings", async () => {
    queue(users, [{ storageBytes: 100 }]);
    queue(r2Objects, [], [{ count: 2, mediaBytes: "200" }]);
    harness.returning.push([{ mediaKey: key }]);

    await expect(
      allocatePendingObject("user_test", key, "recording", 300, 600, now),
    ).resolves.toBe(true);
    expect(harness.events.slice(0, 2)).toEqual([
      "user:user_test",
      `object:user_test:${key}`,
    ]);
    expect(harness.inserts.at(-1)).toMatchObject({ mediaBytes: 300 });
  });

  it("rejects allocation over aggregate pending quota", async () => {
    queue(users, [{ storageBytes: 100 }]);
    queue(r2Objects, [], [{ count: 2, mediaBytes: "201" }]);
    await expect(
      allocatePendingObject("user_test", key, "recording", 300, 600, now),
    ).rejects.toBeInstanceOf(R2PendingStorageQuotaError);
    expect(harness.inserts).toHaveLength(0);
  });

  it("rejects allocation after its owner was deleted", async () => {
    queue(users, []);
    await expect(
      allocatePendingObject("user_test", key, "recording", 1, 600, now),
    ).rejects.toBeInstanceOf(R2ObjectOwnerMissingError);
  });

  it.each(["pending_upload", "delete_pending"])(
    "takes user then object locks and activates %s",
    async (state) => {
      queue(r2Objects, [object(state)]);

      await activateObjectWithinTx(tx, "user_test", key, 128);

      expect(harness.events).toEqual([
        "user:user_test",
        `object:user_test:${key}`,
      ]);
      expect(harness.updates.at(-1)).toMatchObject({
        state: "active",
        mediaBytes: 128,
        leaseToken: null,
        leaseExpiresAt: null,
        deleteReason: null,
      });
    },
  );

  it.each(["deleting", "deleted"])(
    "rejects activation from %s",
    async (state) => {
      queue(r2Objects, [object(state)]);
      await expect(
        activateObjectWithinTx(tx, "user_test", key, 128),
      ).rejects.toBeInstanceOf(R2ObjectNotAttachableError);
      expect(harness.updates).toHaveLength(0);
    },
  );

  it("rejects activation when the producer purpose does not match", async () => {
    queue(r2Objects, [object("pending_upload", { purpose: "thumbnail" })]);
    await expect(
      activateObjectWithinTx(tx, "user_test", key, 128, "recording"),
    ).rejects.toBeInstanceOf(R2ObjectNotAttachableError);
  });

  it("extends a matching pending object's protection window", async () => {
    const until = new Date(now.getTime() + 10 * 60 * 1_000);
    queue(r2Objects, [object("pending_upload")]);
    await expect(
      protectPendingObject("user_test", key, "recording", until),
    ).resolves.toBe(true);
    expect(harness.updates.at(-1)?.uploadExpiresAt).toBeDefined();
    expect(harness.updates.at(-1)?.nextAttemptAt).toBeDefined();
  });

  it("abandons only the matching unclaimed allocation", async () => {
    queue(r2Objects, [object("pending_upload")]);
    harness.returning.push([{ mediaKey: key }]);

    await expect(
      abandonPendingObject("user_test", key, "recording"),
    ).resolves.toBe(true);
    expect(harness.events).toEqual([
      "user:user_test",
      `object:user_test:${key}`,
    ]);
    expect(harness.deletes).toBe(1);
  });

  it("repairs a missing registry row when deletion is enqueued", async () => {
    queue(r2Objects, []);
    harness.returning.push([{ mediaKey: key }]);
    harness.returning.push([{ mediaKey: key }]);
    await expect(
      enqueueObjectDeletionWithinTx(tx, "user_test", key, "orphan", now),
    ).resolves.toBe("enqueued");
    expect(harness.inserts.at(-1)).toMatchObject({
      mediaKey: key,
      userId: "user_test",
      state: "delete_pending",
      deleteReason: "orphan",
    });
  });

  it("never shortens retention and defers a temporary publish reference", async () => {
    const retention = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
    queue(r2Objects, [
      object("pending_upload", { deleteNotBefore: retention }),
    ]);
    queue(submissions, []);
    queue(importedPlatformMedia, []);
    queue(publishJobs, [{ id: "publish_1", updatedAt: now }]);

    await enqueueObjectDeletionWithinTx(tx, "user_test", key, "cancel", now);

    expect(harness.updates.at(-1)).toMatchObject({
      state: "delete_pending",
      deleteNotBefore: retention,
      nextAttemptAt: retention,
    });
  });

  it("claim cancels deletion when a durable owner exists", async () => {
    queue(
      r2Objects,
      [{ mediaKey: key, userId: "user_test" }],
      [object("delete_pending")],
    );
    queue(submissions, [{ id: "submission_1" }]);

    await expect(claimNextR2Object(now)).resolves.toBeNull();
    expect(harness.updates.at(-1)).toMatchObject({
      state: "active",
      leaseToken: null,
      deleteReason: null,
    });
  });

  it("claim retains deletion intent while an active publish is using the object", async () => {
    queue(
      r2Objects,
      [{ mediaKey: key, userId: "user_test" }],
      [object("delete_pending")],
    );
    queue(submissions, []);
    queue(importedPlatformMedia, []);
    queue(publishJobs, [{ id: "publish_1", updatedAt: now }]);

    await expect(claimNextR2Object(now)).resolves.toBeNull();
    expect(harness.updates.at(-1)).toMatchObject({
      state: "delete_pending",
      nextAttemptAt: new Date(now.getTime() + 5 * 60 * 1_000),
    });
  });

  it("takes over an expired lease with a fresh token and incremented attempt", async () => {
    const newToken = "00000000-0000-4000-8000-000000000002";
    queue(
      r2Objects,
      [{ mediaKey: key, userId: "user_test" }],
      [
        object("deleting", {
          leaseToken: "00000000-0000-4000-8000-000000000001",
          leaseExpiresAt: new Date(now.getTime() - 1),
          attempts: 2,
        }),
      ],
    );
    queue(submissions, []);
    queue(importedPlatformMedia, []);
    queue(publishJobs, []);

    await expect(
      claimNextR2Object(now, 60_000, () => newToken),
    ).resolves.toEqual({
      mediaKey: key,
      userId: "user_test",
      leaseToken: newToken,
      attempts: 3,
    });
    expect(harness.updates.at(-1)).toMatchObject({
      state: "deleting",
      leaseToken: newToken,
      attempts: 3,
    });
  });

  it("does not let a crashed stale publish pin deletion forever", async () => {
    const token = "00000000-0000-4000-8000-000000000003";
    queue(
      r2Objects,
      [{ mediaKey: key, userId: "user_test" }],
      [object("delete_pending")],
    );
    queue(submissions, []);
    queue(importedPlatformMedia, []);
    queue(publishJobs, [
      { id: "publish_1", updatedAt: new Date(now.getTime() - 16 * 60 * 1_000) },
    ]);

    await expect(claimNextR2Object(now, 60_000, () => token)).resolves.toEqual(
      expect.objectContaining({ leaseToken: token }),
    );
    expect(harness.updates.at(-1)).toMatchObject({ state: "deleting" });
  });

  it("reports stale token-fenced completion and retry updates", async () => {
    const claim = {
      mediaKey: key,
      userId: "user_test",
      leaseToken: "00000000-0000-4000-8000-000000000001",
      attempts: 2,
    };
    harness.returning.push([], []);

    await expect(completeR2Deletion(claim, now)).resolves.toBe(false);
    await expect(
      retryR2Deletion(claim, new Error("failure"), now),
    ).resolves.toBe(false);
    expect(harness.updates[0]).toMatchObject({ state: "deleted" });
    expect(harness.updates[1]).toMatchObject({
      state: "delete_pending",
      nextAttemptAt: new Date(now.getTime() + 120_000),
    });
  });

  it("account enqueue locks object keys in query order and preserves upload grace", async () => {
    const secondKey = "u/user_test/z.mp4";
    const grace = new Date("2030-08-13T12:01:00.000Z");
    queue(
      r2Objects,
      [
        { mediaKey: key, purpose: "recording", mediaBytes: 1 },
        { mediaKey: secondKey, purpose: "recording", mediaBytes: 1 },
      ],
      [object("active")],
      [
        object("pending_upload", {
          mediaKey: secondKey,
          uploadExpiresAt: grace,
        }),
      ],
    );

    await expect(
      enqueueAllUserObjectsWithinTx(tx, "user_test", "account_deleted"),
    ).resolves.toBe(2);
    expect(harness.events).toEqual([
      "user:user_test",
      `object:user_test:${key}`,
      `object:user_test:${secondKey}`,
    ]);
    expect(harness.updates[1]).toMatchObject({
      state: "delete_pending",
      deleteNotBefore: grace,
    });
  });

  it("account enqueue repairs missing durable keys and lets import metadata win", async () => {
    queue(r2Objects, [], []);
    queue(submissions, [{ mediaKey: key, mediaBytes: 100 }]);
    queue(importedPlatformMedia, [{ mediaKey: key, mediaBytes: 200 }]);

    await expect(
      enqueueAllUserObjectsWithinTx(tx, "user_test", "account_deleted"),
    ).resolves.toBe(1);
    expect(harness.inserts.at(-1)).toMatchObject({
      mediaKey: key,
      purpose: "import",
      mediaBytes: 200,
      state: "delete_pending",
    });
  });
});
