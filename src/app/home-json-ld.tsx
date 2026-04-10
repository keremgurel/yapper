import { getJsonLdFaqEntries } from "@/data/faq";
import { getSiteUrl, safeJsonLdStringify } from "@/lib/json-ld";

const SITE = getSiteUrl();

const faqEntries = getJsonLdFaqEntries();

const faqJsonLd = {
  "@type": "FAQPage",
  "@id": `${SITE}/#faq`,
  mainEntity: faqEntries.map((e) => ({
    "@type": "Question",
    name: e.name,
    acceptedAnswer: { "@type": "Answer", text: e.text },
  })),
};

const graph = [
  {
    "@type": "WebSite",
    "@id": `${SITE}/#website`,
    url: SITE,
    name: "Yapper",
    description:
      "Free random topic generator for impromptu speaking practice, table topics, and speech prompts in your browser.",
    publisher: { "@id": `${SITE}/#organization` },
    inLanguage: "en",
  },
  {
    "@type": "Organization",
    "@id": `${SITE}/#organization`,
    name: "Yapper",
    url: SITE,
  },
  {
    "@type": "WebApplication",
    "@id": `${SITE}/#webapp`,
    name: "Yapper",
    url: SITE,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript. Microphone and camera optional.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "Free impromptu speaking practice with random speech topics, optional timer, and optional camera or mic recording.",
  },
  faqJsonLd,
];

export default function HomeJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: safeJsonLdStringify({
          "@context": "https://schema.org",
          "@graph": graph,
        }),
      }}
    />
  );
}
