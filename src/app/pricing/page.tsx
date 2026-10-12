import StudioPricingPage from "@/components/billing/studio-pricing-page";
import { marketingMetadata } from "@/lib/marketing-metadata";
import { TRIAL_CREDITS, TRIAL_DAYS } from "@/lib/billing/plans";

export const metadata = marketingMetadata(
  "Studio pricing: one membership, every tool",
  `Make videos with every Yapper Studio tool. $24.99 monthly or $199.99 yearly, with credits for AI. Try it free for ${TRIAL_DAYS} days with ${TRIAL_CREDITS} credits.`,
  "/pricing",
);
export default function PricingPage() {
  return <StudioPricingPage />;
}
