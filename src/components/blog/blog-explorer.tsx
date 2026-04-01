"use client";

import { useDeferredValue, useMemo, useState } from "react";

import type { BlogPostMeta } from "@/lib/blog";
import { formatBlogDate } from "@/lib/blog-format";
import Link from "next/link";

type BlogExplorerProps = {
  featuredPost: BlogPostMeta | null;
  posts: BlogPostMeta[];
  categories: string[];
};

function PostCard({ post }: { post: BlogPostMeta }) {
  return (
    <article className="border-border group relative overflow-hidden rounded-[1.75rem] border bg-white p-7 shadow-[0_20px_45px_rgba(17,24,39,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(17,24,39,0.1)] dark:bg-zinc-900 dark:shadow-none dark:hover:shadow-none">
      <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.12),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative">
        <div className="text-foreground/50 mb-4 flex flex-wrap items-center gap-2.5 text-xs tracking-[0.18em] uppercase">
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-medium text-amber-600 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            {post.category}
          </span>
          <span>{formatBlogDate(post.publishedAt)}</span>
          <span className="hidden sm:inline">{post.readingTimeText}</span>
        </div>
        <h3 className="text-foreground text-xl font-semibold tracking-[-0.03em] transition-colors group-hover:text-amber-600 sm:text-2xl dark:group-hover:text-amber-400">
          <Link
            href={`/blog/${post.slug}`}
            className="after:absolute after:inset-0"
          >
            {post.title}
          </Link>
        </h3>
        <p className="text-foreground/70 mt-3 line-clamp-3 text-[0.94rem] leading-7">
          {post.excerpt}
        </p>
        {post.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-foreground/50 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs dark:bg-zinc-800"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-amber-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:text-amber-400">
          <span>Read article</span>
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </div>
      </div>
    </article>
  );
}

function FeaturedCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group relative block overflow-hidden rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-8 shadow-[0_30px_70px_rgba(245,158,11,0.12)] transition-all duration-300 hover:shadow-[0_35px_80px_rgba(245,158,11,0.18)] sm:p-10 dark:border-amber-800/50 dark:from-amber-950/20 dark:via-zinc-900 dark:to-orange-950/20"
    >
      <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.2),transparent_70%)]" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(239,68,68,0.1),transparent_68%)]" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-gray-900">
            Featured
          </span>
          <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs tracking-[0.18em] text-amber-600 uppercase dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-400">
            {post.category}
          </span>
        </div>
        <h3 className="text-foreground mt-5 max-w-2xl text-3xl font-semibold tracking-[-0.04em] transition-colors group-hover:text-amber-600 sm:text-4xl dark:group-hover:text-amber-400">
          {post.title}
        </h3>
        <p className="text-foreground/70 mt-4 max-w-2xl text-base leading-8 sm:text-lg">
          {post.excerpt}
        </p>
        <div className="text-foreground/50 mt-6 flex flex-wrap items-center gap-4 text-sm">
          <span className="text-foreground/70 font-medium">{post.author}</span>
          <span>{formatBlogDate(post.publishedAt)}</span>
          <span>{post.readingTimeText}</span>
        </div>
        <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
          <span>Read this article</span>
          <svg
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export function BlogExplorer({
  featuredPost,
  posts,
  categories,
}: BlogExplorerProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const deferredQuery = useDeferredValue(query);

  const visiblePosts = useMemo(() => {
    const loweredQuery = deferredQuery.trim().toLowerCase();

    return posts.filter((post) => {
      if (featuredPost && post.slug === featuredPost.slug) {
        return false;
      }

      const matchesCategory =
        activeCategory === "All" || post.category === activeCategory;

      const matchesQuery =
        loweredQuery.length === 0 ||
        [post.title, post.excerpt, post.author, post.category, ...post.tags]
          .join(" ")
          .toLowerCase()
          .includes(loweredQuery);

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, deferredQuery, featuredPost, posts]);

  const isFiltering = query.trim().length > 0 || activeCategory !== "All";

  return (
    <div className="space-y-10">
      <div className="text-center">
        <p className="text-xs tracking-[0.28em] text-amber-600 uppercase dark:text-amber-400">
          Yapper Blog
        </p>
        <h1 className="text-foreground mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl lg:text-6xl">
          Speaking tips & tactics
        </h1>
        <p className="text-foreground/70 mx-auto mt-5 max-w-2xl text-base leading-8 sm:text-lg">
          Practical advice for improving your public speaking, conquering stage
          fright, and making every practice session count.
        </p>
      </div>

      {featuredPost && !isFiltering ? (
        <FeaturedCard post={featuredPost} />
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <label className="border-border flex min-w-0 flex-1 items-center gap-3 rounded-2xl border bg-white px-5 py-3.5 shadow-sm transition-shadow focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.15)] dark:bg-zinc-900">
          <svg
            className="text-foreground/40 h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search articles..."
            className="text-foreground placeholder:text-foreground/40 w-full bg-transparent text-sm outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-foreground/40 hover:text-foreground shrink-0 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </label>

        <div className="flex flex-wrap gap-2">
          {["All", ...categories].map((category) => {
            const isActive = category === activeCategory;

            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900"
                    : "border-border text-foreground/60 hover:text-foreground border bg-white hover:border-amber-300 dark:bg-zinc-900"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {!isFiltering && visiblePosts.length > 0 && (
        <div className="flex items-center gap-4">
          <p className="text-foreground/40 text-xs tracking-[0.24em] uppercase">
            All articles
          </p>
          <div className="bg-border h-px flex-1" />
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        {visiblePosts.length > 0 ? (
          visiblePosts.map((post) => <PostCard key={post.slug} post={post} />)
        ) : (
          <div className="border-border rounded-[1.75rem] border border-dashed bg-white p-12 text-center lg:col-span-2 dark:bg-zinc-900">
            <p className="text-foreground/60">
              No posts match that filter yet.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveCategory("All");
              }}
              className="mt-3 text-sm font-medium text-amber-600 transition-colors hover:text-amber-800 dark:text-amber-400"
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
