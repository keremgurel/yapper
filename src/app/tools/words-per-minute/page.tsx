import type { Metadata } from "next";
import WpmToolPage from "@/components/tools/wpm-tool-page";

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
  mainEntity: [
    {
      "@type": "Question",
      name: "How many words per minute is a good speaking pace?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Conversational on-camera and presentation delivery usually sits around 130-150 words per minute. Slower (around 110) reads clearer; faster (160+) feels energetic but can rush.",
      },
    },
    {
      "@type": "Question",
      name: "How long will my script take to say?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Paste your script into the calculator and pick a pace. Spoken length is roughly the word count divided by your words-per-minute rate — e.g. 200 words at 130 wpm is about 1 minute 32 seconds.",
      },
    },
    {
      "@type": "Question",
      name: "How many words fit in a 1-minute video?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "At a conversational 130 words per minute, about 130 words. Enter your target time in the calculator to get the word count for any length and pace.",
      },
    },
  ],
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
