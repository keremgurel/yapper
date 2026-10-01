import Link from "next/link";
import { Fragment } from "react";
import { SITE_URL, safeJsonLdStringify } from "@/lib/json-ld";

export default function Breadcrumbs({
  items,
}: {
  items: { label: string; href: string }[];
}) {
  return (
    <>
      <nav className="marketing-breadcrumbs" aria-label="Breadcrumb">
        {items.map((item, index) => (
          <Fragment key={item.href}>
            {index > 0 && <span aria-hidden="true">/</span>}
            {index === items.length - 1 ? (
              <span aria-current="page">{item.label}</span>
            ) : (
              <Link href={item.href}>{item.label}</Link>
            )}
          </Fragment>
        ))}
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: items.map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: item.label,
              item: `${SITE_URL}${item.href}`,
            })),
          }),
        }}
      />
    </>
  );
}
