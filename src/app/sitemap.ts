import type { MetadataRoute } from "next";

import { getAllBlogPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/json-ld";
import { PUBLIC_PATHS, routeLastmod } from "@/lib/seo/public-routes";

/**
 * Canonical, indexable URLs only: no redirects, no query-string states, no
 * signed-in pages. Pages come from the public route registry; blog posts add
 * themselves. lastmod is the date the page's own files last changed (see
 * scripts/update-sitemap-lastmod.mjs), never the build date. priority and
 * changefreq are omitted because Google ignores both.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    lastModified: routeLastmod(path),
  }));
  const posts = getAllBlogPosts().map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
  }));
  return [...pages, ...posts];
}
