import type { Metadata } from "next";
import { SITE_URL } from "@/lib/json-ld";

export function marketingMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const url = `${SITE_URL}${path === "/" ? "" : path}`;
  return {
    title: { absolute: `${title} | Yapper` },
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
          url: "/og.png",
          width: 1200,
          height: 630,
          alt: "Yapper Train and Yapper Studio",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}
