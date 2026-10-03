import type { Metadata } from "next";

import { BlogExplorer } from "@/components/blog/blog-explorer";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import styles from "@/components/blog/blog.module.css";
import {
  getAllBlogPosts,
  getBlogCategories,
  getFeaturedBlogPost,
} from "@/lib/blog";

export const metadata: Metadata = {
  title: "Speaking guides and practice ideas",
  description:
    "Tips, tactics, and practical advice for improving your public speaking and making the most of every practice session.",
  alternates: {
    canonical: "https://ypr.app/blog",
  },
  openGraph: {
    title: "Yapper Blog",
    description:
      "Practical speaking tips, practice strategies, and confidence-building tactics.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Speaking guides and practice ideas | Yapper",
    description:
      "Practical speaking tips, practice strategies, and confidence-building tactics.",
  },
};

export default function BlogPage() {
  const posts = getAllBlogPosts();
  const categories = getBlogCategories(posts);
  const featuredPost = getFeaturedBlogPost(posts);

  return (
    <section className="marketing-section">
      <div className="marketing-container">
        <Breadcrumbs
          items={[
            { label: "Yapper Train", href: "/products/train" },
            { label: "Speaking guides", href: "/blog" },
          ]}
        />
        <div className={styles.intro}>
          <h1 className="type-h1">Speaking guides</h1>
          <p className="marketing-lede">
            Practical routines, prompts and fixes for getting better at
            speaking, each one something you can try in your next practice
            session.
          </p>
        </div>
        <BlogExplorer
          categories={categories}
          featuredPost={featuredPost}
          posts={posts}
        />
      </div>
    </section>
  );
}
