import MarketingLayout from "@/components/marketing/marketing-layout";

/** Guides share the site's header, footer and container with every other
 * public page. */
export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingLayout>{children}</MarketingLayout>;
}
