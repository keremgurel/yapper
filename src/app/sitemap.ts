import type { MetadataRoute } from "next";

import { programFamilies } from "@/data/training";
import { getAllBlogPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/json-ld";

export default function sitemap(): MetadataRoute.Sitemap {
  const blogPosts = getAllBlogPosts().map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const trainingPages = programFamilies.map((program) => ({
    url: `${SITE_URL}${program.href}`,
    lastModified: new Date(),
    changeFrequency:
      program.status === "Free now"
        ? ("weekly" as const)
        : ("monthly" as const),
    priority: program.status === "Free now" ? 0.9 : 0.65,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/random-topic-generator`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/freestyle-speech`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/training`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    ...trainingPages,
    ...blogPosts,
  ];
}
