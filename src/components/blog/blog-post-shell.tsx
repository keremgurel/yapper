import { compileMDX } from "next-mdx-remote/rsc";
import Link from "next/link";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { blogMdxComponents } from "@/components/blog/mdx-components";
import type { BlogPost, BlogPostMeta } from "@/lib/blog";
import { formatBlogDate } from "@/lib/blog-format";

type BlogPostShellProps = {
  post: BlogPost;
  relatedPosts: BlogPostMeta[];
};

export async function BlogPostShell({
  post,
  relatedPosts,
}: BlogPostShellProps) {
  const { content } = await compileMDX({
    source: post.content,
    components: blogMdxComponents,
    options: {
      parseFrontmatter: false,
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            {
              properties: {
                className: ["blog-heading-anchor"],
              },
            },
          ],
        ],
      },
    },
  });

  return (
    <div className="pt-28 pb-24">
      <div className="mx-auto max-w-6xl px-6">
        {/* Back nav */}
        <Link
          href="/blog"
          className="text-foreground/40 hover:text-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors"
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
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to blog
        </Link>

        {/* Article header */}
        <header className="mt-8 rounded-4xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white px-7 py-10 shadow-[0_25px_70px_rgba(245,158,11,0.08)] sm:px-12 sm:py-14 dark:border-amber-800/50 dark:from-amber-950/20 dark:via-zinc-900 dark:to-zinc-900">
          <div className="mx-auto max-w-3xl">
            <div className="text-foreground/50 flex flex-wrap items-center gap-3 text-xs tracking-[0.18em] uppercase">
              <span className="rounded-full border border-amber-200 bg-white px-3 py-1 font-medium text-amber-600 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-400">
                {post.category}
              </span>
              <span>{formatBlogDate(post.publishedAt)}</span>
              <span>{post.readingTimeText}</span>
            </div>
            <h1 className="text-foreground mt-6 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
              {post.title}
            </h1>
            <p className="text-foreground/70 mt-6 text-lg leading-8">
              {post.excerpt}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-red-500 text-xs font-bold text-white">
                {post.author.charAt(0)}
              </div>
              <span className="text-foreground text-sm font-medium">
                {post.author}
              </span>
              {post.tags.length > 0 && (
                <>
                  <span className="text-foreground/30">|</span>
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-600 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content + sidebar grid */}
        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_280px]">
          <article className="min-w-0">
            <div className="blog-prose mx-auto max-w-3xl space-y-6">
              {content}
            </div>

            {/* End-of-article CTA */}
            <div className="mx-auto mt-16 max-w-3xl rounded-[1.5rem] border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-6 sm:p-8 dark:border-amber-800/50 dark:from-amber-950/20 dark:to-zinc-900">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-foreground text-sm font-semibold">
                    Practice what you just learned
                  </p>
                  <p className="text-foreground/60 mt-1 text-sm">
                    Try a random topic and put these tips into action.
                  </p>
                </div>
                <Link
                  href="/#practice"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-zinc-100"
                >
                  Start practicing
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
                </Link>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-6">
              {post.headings.length > 0 && (
                <nav className="border-border rounded-[1.75rem] border bg-white p-6 shadow-sm dark:bg-zinc-900">
                  <p className="text-foreground/40 text-[11px] font-semibold tracking-[0.2em] uppercase">
                    On this page
                  </p>
                  <ul className="mt-4 space-y-1">
                    {post.headings.map((heading) => (
                      <li key={heading.id}>
                        <a
                          href={`#${heading.id}`}
                          className={`text-foreground/60 hover:text-foreground block rounded-lg px-3 py-1.5 text-[13px] leading-6 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/20 ${
                            heading.level === 3 ? "pl-6" : ""
                          }`}
                        >
                          {heading.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}

              <div className="rounded-[1.75rem] border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 dark:border-amber-800/50 dark:from-amber-950/20 dark:to-zinc-900">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-400/20">
                    <svg
                      className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <p className="text-foreground text-sm font-semibold">
                    Quick tip
                  </p>
                </div>
                <p className="text-foreground/60 mt-3 text-[13px] leading-6">
                  Pick one idea from this article and practice it in your next
                  session. Small, focused repetition builds lasting habits.
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* Related posts */}
        {relatedPosts.length > 0 ? (
          <section className="mt-20">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-foreground/40 text-xs tracking-[0.24em] uppercase">
                  Keep reading
                </p>
                <h2 className="text-foreground mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                  Related articles
                </h2>
              </div>
              <Link
                href="/blog"
                className="border-border text-foreground/60 hover:text-foreground shrink-0 rounded-full border bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-amber-300 dark:bg-zinc-900"
              >
                View all
              </Link>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.slug}
                  href={`/blog/${relatedPost.slug}`}
                  className="border-border group rounded-[1.75rem] border bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-[0_20px_50px_rgba(245,158,11,0.1)] dark:bg-zinc-900"
                >
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] tracking-[0.18em] text-amber-600 uppercase dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                    {relatedPost.category}
                  </span>
                  <h3 className="text-foreground mt-4 text-lg font-semibold tracking-[-0.02em] transition-colors group-hover:text-amber-600 dark:group-hover:text-amber-400">
                    {relatedPost.title}
                  </h3>
                  <p className="text-foreground/60 mt-3 line-clamp-3 text-sm leading-7">
                    {relatedPost.excerpt}
                  </p>
                  <div className="text-foreground/40 mt-4 flex items-center gap-3 text-xs">
                    <span>{formatBlogDate(relatedPost.publishedAt)}</span>
                    <span>{relatedPost.readingTimeText}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
