import type { Metadata } from "next";
import ToolsHub from "@/components/tools/tools-hub";
import { tools } from "@/data/tools";

export const metadata: Metadata = {
  title: "Free Tools for Talking to Camera | Yapper",
  description:
    "Free, no-sign-up creator tools: a words-per-minute calculator, a teleprompter recorder, and a transcript-based video editor. Plan, record, and edit in your browser.",
  alternates: { canonical: "https://ypr.app/tools" },
};

const itemList = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Yapper free creator tools",
  itemListElement: tools.map((t, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: t.title,
    description: t.description,
    url: `https://ypr.app${t.href}`,
  })),
};

export default function ToolsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
      <ToolsHub />
    </>
  );
}
