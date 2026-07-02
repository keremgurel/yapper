import Stripe from "stripe";

// Lazily constructed so importing this module never requires the key at build
// time (billing is keyless in local/preview until STRIPE_SECRET_KEY is set).
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("stripe_not_configured");
    client = new Stripe(key);
  }
  return client;
}

export const stripeConfigured = (): boolean => !!process.env.STRIPE_SECRET_KEY;
