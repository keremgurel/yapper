import StudioPricingPage from "@/components/billing/studio-pricing-page";
import { marketingMetadata } from "@/lib/marketing-metadata";

export const metadata = marketingMetadata(
  "Yapper Studio pricing: plans and AI credits",
  "Yapper Studio plans from $19 a month, billed monthly or yearly. Each includes credits for AI scripts, transcription, one-click edits, thumbnails and publishing copy.",
  "/products/studio/pricing",
);

export default function Page() {
  return <StudioPricingPage />;
}
