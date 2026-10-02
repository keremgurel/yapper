/**
 * Yapper sells two products from one account. Each has its own subscription,
 * its own credit wallet and its own pricing page. Nothing bought for one
 * product can be spent in the other.
 */
export const PRODUCTS = ["studio", "train"] as const;
export type Product = (typeof PRODUCTS)[number];

export const DEFAULT_PRODUCT: Product = "studio";

export function isProduct(value: unknown): value is Product {
  return typeof value === "string" && PRODUCTS.includes(value as Product);
}

export const PRODUCT_NAMES: Record<Product, string> = {
  studio: "Yapper Studio",
  train: "Yapper Train",
};

/** Where each product sells and where its checkout returns. */
export const PRODUCT_PATHS: Record<
  Product,
  { pricing: string; afterCheckout: string }
> = {
  studio: {
    pricing: "/products/studio/pricing",
    afterCheckout: "/studio/home?checkout=success",
  },
  train: {
    pricing: "/products/train/pricing",
    afterCheckout: "/progress?checkout=success",
  },
};
