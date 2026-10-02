import TrainPricingPage from "@/components/billing/train-pricing-page";
import { marketingMetadata } from "@/lib/marketing-metadata";

export const metadata = marketingMetadata(
  "Yapper Train pricing: free practice and Train Plus",
  "Speaking practice in Yapper Train is free and needs no account. Train Plus adds unlimited AI feedback for $9 a month, or less billed yearly.",
  "/products/train/pricing",
);

export default function Page() {
  return <TrainPricingPage />;
}
