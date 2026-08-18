import type { Metadata } from "next";
import PricingPage from "@/components/billing/pricing-page";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "AI coaching on your speaking practice: a score on every rep, grammar and word choice corrected, and a clean version of your answer. Weekly, monthly, or yearly, with a 7-day free trial.",
  alternates: { canonical: "https://ypr.app/pricing" },
};

export default function Page() {
  return <PricingPage />;
}
