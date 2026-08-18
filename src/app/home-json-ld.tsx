import { getSiteUrl, safeJsonLdStringify } from "@/lib/json-ld";
import { marketingFeatures } from "@/data/marketing-features";

const SITE = getSiteUrl();

/** Identity of the site itself. Safe on any page. */
const siteGraph = [
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
];

/** The downloadable studio app. Only the homepage may claim this: it is not
 * released yet and its surfaces sit behind a password, so emitting it on a
 * practice page would advertise something the visitor cannot get. */
const appGraph = [
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

function JsonLd({ graph }: { graph: object[] }) {
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

/** Site identity only, for pages that are not the homepage. */
export function SiteJsonLd() {
  return <JsonLd graph={siteGraph} />;
}

export default function HomeJsonLd() {
  return <JsonLd graph={[...siteGraph, ...appGraph]} />;
}
