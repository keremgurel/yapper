"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { BlogPostMeta } from "@/lib/blog";
import FeaturedPost from "./featured-post";
import PostCard from "./post-card";
import styles from "./blog.module.css";

type BlogExplorerProps = {
  featuredPost: BlogPostMeta | null;
  posts: BlogPostMeta[];
  categories: string[];
};

function matches(post: BlogPostMeta, query: string) {
  if (!query) return true;
  return [post.title, post.excerpt, post.category, ...post.tags]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

/** The guide list: the featured guide, then every other one, narrowed by
 * category or a search. */
export function BlogExplorer({
  featuredPost,
  posts,
  categories,
}: BlogExplorerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const filtering = deferred.length > 0 || category !== "All";

  const visible = useMemo(
    () =>
      posts.filter(
        (post) =>
          (filtering || post.slug !== featuredPost?.slug) &&
          (category === "All" || post.category === category) &&
          matches(post, deferred),
      ),
    [posts, featuredPost, filtering, category, deferred],
  );

  return (
    <>
      {featuredPost && !filtering && <FeaturedPost post={featuredPost} />}
      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Category">
          {["All", ...categories].map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={name === category}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search guides"
          aria-label="Search guides"
          className={styles.search}
        />
      </div>
      {visible.length > 0 ? (
        <div className={styles.grid}>
          {visible.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <p>No guides match that yet.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("All");
            }}
          >
            Show every guide
          </button>
        </div>
      )}
    </>
  );
}
