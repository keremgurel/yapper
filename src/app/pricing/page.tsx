import StudioPricingPage from "@/components/billing/studio-pricing-page";
import { marketingMetadata } from "@/lib/marketing-metadata";

export const metadata = marketingMetadata(
  "Studio pricing: one membership, every tool",
  "Make videos with every Yapper Studio tool. $24.99 monthly or $199.99 yearly, with credits for AI. Try it free for 7 days with 30 credits.",
  "/pricing",
);
export default function PricingPage() {
  return <StudioPricingPage />;
}
