/**
 * Studio and Train became separate products with separate wallets on this
 * date. Accounts created before it were given one balance for everything.
 */
export const PRODUCT_SPLIT_AT = new Date("2026-10-03T00:00:00Z");

/**
 * Whether Train may still draw on the Studio wallet for this account.
 *
 * An account that predates the split was sold or granted one balance for both
 * products and keeps it: Train spends its own wallet first, then that balance.
 * An account created since buys Studio credits for Studio only.
 */
export function trainSharesStudioWallet(account: { createdAt: Date }): boolean {
  return account.createdAt < PRODUCT_SPLIT_AT;
}
