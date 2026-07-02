import type { Metadata } from "next";
import WpmToolPage from "@/components/tools/wpm-tool-page";
import { WPM_FAQ } from "@/data/wpm-faq";

export const metadata: Metadata = {
  title: "Words Per Minute Calculator (Speaking Time) | Yapper",
  description:
    "Free words-per-minute calculator: paste a script to get its spoken length, or find how many words fit a target time at slow, conversational, or fast pace.",
  alternates: { canonical: "https://ypr.app/tools/words-per-minute" },
};

const appSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Words per minute calculator",
  url: "https://ypr.app/tools/words-per-minute",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  description:
    "Calculate speaking time from a script, or the word count for a target duration, at a chosen speaking pace.",
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: WPM_FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function WordsPerMinutePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <WpmToolPage />
    </>
  );
}
