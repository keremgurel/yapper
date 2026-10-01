import { SITE_URL as SITE, safeJsonLdStringify } from "@/lib/json-ld";

const siteGraph = [
  {
    "@type": "WebSite",
    "@id": `${SITE}/#website`,
    url: SITE,
    name: "Yapper",
    description:
      "Yapper Train for speaking practice. Yapper Studio for content creation.",
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
const products = {
  studio: {
    "@type": "SoftwareApplication",
    "@id": `${SITE}/products/studio#software`,
    name: "Yapper Studio",
    url: `${SITE}/products/studio`,
    applicationCategory: "MultimediaApplication",
    description:
      "A content creation workflow for ideas, scripts, recording, transcript editing, captions, and publishing preparation. Currently in private testing.",
  },
  train: {
    "@type": "SoftwareApplication",
    "@id": `${SITE}/products/train#software`,
    name: "Yapper Train",
    url: `${SITE}/products/train`,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web browser",
    description:
      "Speaking practice with prompts, a timer, recording, and optional AI coaching.",
  },
};
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
export function SiteJsonLd() {
  return <JsonLd graph={siteGraph} />;
}
export function ProductJsonLd({ product }: { product: keyof typeof products }) {
  return <JsonLd graph={[products[product]]} />;
}
export default function HomeJsonLd() {
  return <JsonLd graph={siteGraph} />;
}
