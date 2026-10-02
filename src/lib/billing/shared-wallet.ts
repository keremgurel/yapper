import { isLegacyPlanKey } from "./plans";

/**
 * Whether Train may still draw on the Studio wallet for this account.
 *
 * Two groups were given one balance for everything before the products were
 * split, and keep it: holders of a legacy plan, which was sold as covering
 * both, and accounts that never subscribed, whose only credits are the
 * welcome grant that was always meant for a first feedback session. Anyone on
 * a current Studio plan bought Studio credits and spends them in Studio only.
 */
export function trainSharesStudioWallet(studio: {
  subscriptionStatus: string | null;
  plan: string | null;
}): boolean {
  if (isLegacyPlanKey(studio.plan)) return true;
  return studio.subscriptionStatus === null;
}
