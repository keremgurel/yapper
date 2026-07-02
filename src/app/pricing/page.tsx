import type { Metadata } from "next";
import PricingPage from "@/components/billing/pricing-page";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "The editor and tools are free forever. Subscribe to unlock AI coaching, idea and script generation, and the guided create loop. 7-day free trial.",
  alternates: { canonical: "https://ypr.app/pricing" },
};

export default function Page() {
  return <PricingPage />;
}
