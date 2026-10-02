import { auth } from "@clerk/nextjs/server";
import { getBillingState } from "@/lib/db/billing";
import { getBalance } from "@/lib/db/credits";
import { getStorageBytes } from "@/lib/db/users";
import { isEntitled, isTrialing } from "@/lib/billing/entitlement";
import { storageQuotaFor } from "@/lib/billing/storage";
import { getTrainSpendable } from "@/lib/db/train-wallet";

export const runtime = "nodejs";

/** The signed-in user's billing snapshot for the UI. The top-level fields are
 * Studio's and keep the shape older clients (the Mac app) already read. Train
 * reports its own subscription and what a feedback session can spend. */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [state, balance, storageBytes, train, trainBalance] = await Promise.all(
    [
      getBillingState(userId),
      getBalance(userId),
      getStorageBytes(userId),
      getBillingState(userId, "train"),
      getTrainSpendable(userId),
    ],
  );
  return Response.json({
    entitled: isEntitled(state),
    trialing: isTrialing(state),
    status: state?.subscriptionStatus ?? null,
    plan: state?.plan ?? null,
    currentPeriodEnd: state?.currentPeriodEnd ?? null,
    balance,
    storageBytes,
    storageQuotaBytes: storageQuotaFor(state),
    train: {
      entitled: isEntitled(train),
      status: train?.subscriptionStatus ?? null,
      plan: train?.plan ?? null,
      currentPeriodEnd: train?.currentPeriodEnd ?? null,
      balance: trainBalance,
      // A Train plan is unlimited feedback; the balance only matters without one.
      unlimited: isEntitled(train),
    },
  });
}
