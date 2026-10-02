import StudioPricingPage from "@/components/billing/studio-pricing-page";
import { marketingMetadata } from "@/lib/marketing-metadata";

export const metadata = marketingMetadata(
  "Yapper Studio pricing: plans and AI credits",
  "Yapper Studio is one membership with every tool, billed weekly, monthly or yearly from $7.99 a week. Each payment includes credits for transcription and AI.",
  "/products/studio/pricing",
);

export default function Page() {
  return <StudioPricingPage />;
}
