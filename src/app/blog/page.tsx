import type { Metadata } from "next";

import { BlogExplorer } from "@/components/blog/blog-explorer";
import {
  getAllBlogPosts,
  getBlogCategories,
  getFeaturedBlogPost,
} from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog | Yapper",
  description:
    "Tips, tactics, and practical advice for improving your public speaking and making the most of every practice session.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Yapper Blog",
    description:
      "Practical speaking tips, practice strategies, and confidence-building tactics.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | Yapper",
    description:
      "Practical speaking tips, practice strategies, and confidence-building tactics.",
  },
};

export default function BlogPage() {
  const posts = getAllBlogPosts();
  const categories = getBlogCategories(posts);
  const featuredPost = getFeaturedBlogPost(posts);

  return (
    <main className="bg-background min-h-screen">
      <section className="mx-auto max-w-6xl px-6 pt-28 pb-24">
        <BlogExplorer
          categories={categories}
          featuredPost={featuredPost}
          posts={posts}
        />
      </section>
    </main>
  );
}
