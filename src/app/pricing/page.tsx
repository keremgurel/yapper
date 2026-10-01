import type { Metadata } from "next";
import PricingPage from "@/components/billing/pricing-page";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Plans for Yapper Studio and Yapper Train. Monthly credits for AI ideas, scripts, one-click edits, thumbnails, captions, and coaching. Monthly or yearly billing, with optional credit packs.",
  alternates: { canonical: "https://ypr.app/pricing" },
};

export default function Page() {
  return <PricingPage />;
}
