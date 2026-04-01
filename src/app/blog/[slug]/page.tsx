import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogPostShell } from "@/components/blog/blog-post-shell";
import {
  getAllBlogPosts,
  getBlogPostBySlug,
  getBlogPostSlugs,
  getRelatedBlogPosts,
} from "@/lib/blog";

function safeJsonLdStringify(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

type PageProps = {
  params: Promise<{ slug: string }>;
};

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://ypr.app";
}

export function generateStaticParams() {
  return getBlogPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Post not found | Yapper",
    };
  }

  const canonical = `${getSiteUrl()}/blog/${post.slug}`;

  return {
    title: `${post.title} | Yapper`,
    description: post.excerpt,
    alternates: {
      canonical,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.author],
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const allPosts = getAllBlogPosts();
  const relatedPosts = getRelatedBlogPosts(post.slug, allPosts);
  const siteUrl = getSiteUrl();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: {
      "@type": "Organization",
      name: "Yapper",
    },
    publisher: {
      "@type": "Organization",
      name: "OCX Software Inc.",
      "@id": `${siteUrl}/#organization`,
    },
    mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
    articleSection: post.category,
    keywords: post.tags.join(", "),
    wordCount: post.content.split(/\s+/).length,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${siteUrl}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: `${siteUrl}/blog/${post.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbJsonLd),
        }}
      />
      <main className="bg-background min-h-screen">
        <BlogPostShell post={post} relatedPosts={relatedPosts} />
      </main>
    </>
  );
}
