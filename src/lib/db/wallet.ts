import type { Product } from "@/lib/billing/products";
import { users } from "./schema";

/** The running balance column for a product's wallet. */
export function balanceColumn(product: Product) {
  return product === "train" ? users.trainCreditsBalance : users.creditsBalance;
}

/** The `set` key that writes that same column. */
export function balanceField(product: Product) {
  return product === "train" ? "trainCreditsBalance" : "creditsBalance";
}

/** The subscription mirror columns for a product. */
export function subscriptionColumns(product: Product) {
  return product === "train"
    ? {
        subscriptionStatus: users.trainSubscriptionStatus,
        plan: users.trainPlan,
        currentPeriodEnd: users.trainCurrentPeriodEnd,
      }
    : {
        subscriptionStatus: users.subscriptionStatus,
        plan: users.plan,
        currentPeriodEnd: users.currentPeriodEnd,
      };
}
