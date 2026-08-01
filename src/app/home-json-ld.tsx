import { getSiteUrl, safeJsonLdStringify } from "@/lib/json-ld";
import { marketingFeatures } from "@/data/marketing-features";

const SITE = getSiteUrl();

const graph = [
  {
    "@type": "WebSite",
    "@id": `${SITE}/#website`,
    url: SITE,
    name: "Yapper",
    description:
      "The mobile and desktop content studio for video creators, plus free creator and speaking resources.",
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
    "@type": "SoftwareApplication",
    "@id": `${SITE}/#software`,
    name: "Yapper Studio",
    url: SITE,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "iOS, Android, macOS, Windows",
    description:
      "A mobile and desktop creator studio for capturing ideas, writing scripts, recording video, editing by transcript, adding captions, and publishing content.",
    featureList: marketingFeatures.map((feature) => feature.shortTitle),
  },
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
