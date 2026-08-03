import type { Metadata } from "next";
import PricingPage from "@/components/billing/pricing-page";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Choose weekly, monthly, or yearly Creator membership. Unlock AI editing, transcription, coaching, idea generation, storage, and credit top-ups with a 7-day free trial.",
  alternates: { canonical: "https://ypr.app/pricing" },
};

export default function Page() {
  return <PricingPage />;
}
