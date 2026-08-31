import { and, asc, eq, sql } from "drizzle-orm";
import {
  activateObjectWithinTx,
  enqueueObjectDeletionWithinTx,
} from "./r2-lifecycle";
import { getDb } from "./client";
import { brandAssets, projects, users } from "./schema";
import {
  lockMediaReferenceWithinTx,
  lockStorageUserWithinTx,
  StorageQuotaError,
} from "./storage-accounting";
import { getActiveProject } from "./projects";

const MAX_LOGOS = 8;

export type BrandAssetRow = typeof brandAssets.$inferSelect;

export class BrandLogoLimitError extends Error {
  constructor() {
    super("brand_logo_limit");
    this.name = "BrandLogoLimitError";
  }
}

export async function listBrandAssets(
  userId: string,
): Promise<BrandAssetRow[]> {
  const project = await getActiveProject(userId);
  return getDb()
    .select()
    .from(brandAssets)
    .where(eq(brandAssets.projectId, project.id))
    .orderBy(asc(brandAssets.sortOrder), asc(brandAssets.createdAt));
}

/** Attach a verified upload and charge it to storage in the same transaction. */
export async function attachBrandAsset(input: {
  userId: string;
  mediaKey: string;
  name: string;
  mimeType: string;
  mediaBytes: number;
  quotaBytes: number;
}): Promise<BrandAssetRow> {
  const project = await getActiveProject(input.userId);
  return getDb().transaction(async (tx) => {
    await lockStorageUserWithinTx(tx, input.userId);
    await lockMediaReferenceWithinTx(tx, input.userId, input.mediaKey);
    await tx
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, project.id))
      .for("update");

    const existing = await tx
      .select({ id: brandAssets.id })
      .from(brandAssets)
      .where(eq(brandAssets.projectId, project.id));
    if (existing.length >= MAX_LOGOS) throw new BrandLogoLimitError();

    const [asset] = await tx
      .insert(brandAssets)
      .values({
        projectId: project.id,
        mediaKey: input.mediaKey,
        name: input.name,
        mimeType: input.mimeType,
        mediaBytes: input.mediaBytes,
        isPrimary: existing.length === 0,
        sortOrder: existing.length,
      })
      .returning();
    if (!asset) throw new Error("brand_asset_unavailable");

    await activateObjectWithinTx(
      tx,
      input.userId,
      input.mediaKey,
      input.mediaBytes,
      "brand_logo",
    );
    const charged = await tx
      .update(users)
      .set({
        storageBytes: sql`greatest(0, ${users.storageBytes} + ${input.mediaBytes})`,
      })
      .where(
        and(
          eq(users.id, input.userId),
          sql`${users.storageBytes} + ${input.mediaBytes} <= ${input.quotaBytes}`,
        ),
      )
      .returning({ id: users.id });
    if (charged.length === 0) throw new StorageQuotaError();
    return asset;
  });
}

export async function makePrimaryBrandAsset(
  userId: string,
  id: string,
): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [asset] = await tx
      .select({ id: brandAssets.id, projectId: brandAssets.projectId })
      .from(brandAssets)
      .innerJoin(projects, eq(brandAssets.projectId, projects.id))
      .where(and(eq(brandAssets.id, id), eq(projects.userId, userId)))
      .limit(1);
    if (!asset) return false;
    await tx
      .update(brandAssets)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(brandAssets.projectId, asset.projectId));
    await tx
      .update(brandAssets)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(eq(brandAssets.id, id));
    return true;
  });
}

export async function removeBrandAsset(
  userId: string,
  id: string,
): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    await lockStorageUserWithinTx(tx, userId);
    const [candidate] = await tx
      .select({
        id: brandAssets.id,
        projectId: brandAssets.projectId,
        mediaKey: brandAssets.mediaKey,
        mediaBytes: brandAssets.mediaBytes,
        isPrimary: brandAssets.isPrimary,
      })
      .from(brandAssets)
      .innerJoin(projects, eq(brandAssets.projectId, projects.id))
      .where(and(eq(brandAssets.id, id), eq(projects.userId, userId)))
      .limit(1);
    if (!candidate) return false;
    await lockMediaReferenceWithinTx(tx, userId, candidate.mediaKey);

    const removed = await tx
      .delete(brandAssets)
      .where(eq(brandAssets.id, candidate.id))
      .returning({ id: brandAssets.id });
    if (removed.length === 0) return false;

    if (candidate.isPrimary) {
      const [next] = await tx
        .select({ id: brandAssets.id })
        .from(brandAssets)
        .where(eq(brandAssets.projectId, candidate.projectId))
        .orderBy(asc(brandAssets.sortOrder), asc(brandAssets.createdAt))
        .limit(1);
      if (next) {
        await tx
          .update(brandAssets)
          .set({ isPrimary: true, updatedAt: new Date() })
          .where(eq(brandAssets.id, next.id));
      }
    }

    if (candidate.mediaBytes > 0) {
      await tx
        .update(users)
        .set({
          storageBytes: sql`greatest(0, ${users.storageBytes} - ${candidate.mediaBytes})`,
        })
        .where(eq(users.id, userId));
    }
    await enqueueObjectDeletionWithinTx(
      tx,
      userId,
      candidate.mediaKey,
      "brand_logo_removed",
      new Date(),
      "brand_logo",
    );
    return true;
  });
}
