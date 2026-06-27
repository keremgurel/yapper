import type { DrillContent } from "@/data/drills";
import { getSiteUrl, safeJsonLdStringify } from "@/lib/json-ld";

export default function DrillJsonLd({ drill }: { drill: DrillContent }) {
  const site = getSiteUrl();
  const url = `${site}/training/${drill.slug}`;

  const graph = [
    {
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: drill.faq.map((entry) => ({
        "@type": "Question",
        name: entry.q,
        acceptedAnswer: { "@type": "Answer", text: entry.a },
      })),
    },
    {
      "@type": "HowTo",
      "@id": `${url}#howto`,
      name: `${drill.heroTitleTop} ${drill.heroTitleBottom}`,
      description: drill.heroDescription,
      step: drill.howItWorks.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.title,
        text: step.body,
      })),
    },
  ];

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
