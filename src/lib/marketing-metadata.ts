import type { Metadata } from "next";
import { SITE_URL } from "@/lib/json-ld";

/**
 * Metadata for a public page: title, description, a self-referencing
 * canonical, and matching Open Graph and Twitter cards. `path` is the page's
 * one canonical path, without query or hash.
 */
export function marketingMetadata(
  title: string,
  description: string,
  path: string,
  options: {
    /** Set false when the title already names Yapper. */
    brandSuffix?: boolean;
  } = {},
): Metadata {
  const url = `${SITE_URL}${path === "/" ? "" : path}`;
  return {
    title: {
      absolute: options.brandSuffix === false ? title : `${title} | Yapper`,
    },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "Yapper",
      images: [
        {
          url: "/og-studio.png",
          width: 1200,
          height: 630,
          alt: "Yapper Studio. Everything you need to create content, with a transcript video editor preview.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-studio.png"],
    },
  };
}
