import { auth } from "@clerk/nextjs/server";
import { getBillingState } from "@/lib/db/billing";
import { getStorageUsageDetails } from "@/lib/db/storage-usage";
import { getStorageBytes } from "@/lib/db/users";
import { storageQuotaFor } from "@/lib/billing/storage";
import { lapsedMediaDeleteAt } from "@/lib/billing/entitlement";
import { planByKey, SUBSCRIPTION_PLANS } from "@/lib/billing/plans";
import { storageUsagePercent } from "@/lib/storage/format";

export const runtime = "nodejs";

/**
 * The numbers the Storage page shows, as JSON, for the native Studio page.
 * Same reads and the same arithmetic as `studio/(dashboard)/storage/page.tsx`.
 */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [state, usedBytes, details] = await Promise.all([
    getBillingState(userId),
    getStorageBytes(userId),
    getStorageUsageDetails(userId),
  ]);
  const quotaBytes = storageQuotaFor(state);
  const committedBytes = usedBytes + details.reservedBytes;
  const percent = storageUsagePercent(committedBytes, quotaBytes);
  const plan = planByKey(state?.plan);
  const pressure =
    percent >= 90 ? "critical" : percent >= 70 ? "near" : "roomy";
  const { media, workspace } = details;

  // A lapsed account keeps its videos for 30 days; say when they go, and
  // only when there is something stored to lose.
  const deleteAt = usedBytes > 0 ? lapsedMediaDeleteAt(state) : null;
  return Response.json({
    videosDeleteOn: deleteAt ? deleteAt.toISOString() : null,
    plan: plan ? { key: plan.key, name: plan.name } : null,
    usedBytes,
    reservedBytes: details.reservedBytes,
    reservedCount: details.reservedCount,
    committedBytes,
    quotaBytes,
    percent,
    pressure,
    media: {
      recording: media.recording,
      import: media.import,
      thumbnail: media.thumbnail,
      brandLogo: media.brand_logo,
    },
    workspace: {
      estimatedBytes: workspace.estimatedBytes,
      brainBlocks: workspace.brainBlocks,
      brainSkills: workspace.brainSkills,
      contentIdeas: workspace.contentIdeas,
      contentLibrary: workspace.contentLibrary,
      savedViews: workspace.savedViews,
    },
    plans: SUBSCRIPTION_PLANS.map((candidate) => ({
      key: candidate.key,
      name: candidate.name,
      storageBytes: candidate.storageBytes,
      storageLabel: candidate.storageLabel,
    })),
  });
}
