import { compileMDX } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import Breadcrumbs from "@/components/marketing/breadcrumbs";
import { blogMdxComponents } from "@/components/blog/mdx-components";
import type { BlogPost, BlogPostMeta } from "@/lib/blog";
import { formatBlogDate } from "@/lib/blog-format";
import { categoryTone } from "./category-tone";
import PostCard from "./post-card";
import PostPractice from "./post-practice";
import PostToc from "./post-toc";
import articleStyles from "./article.module.css";
import blogStyles from "./blog.module.css";

type BlogPostShellProps = {
  post: BlogPost;
  relatedPosts: BlogPostMeta[];
};

/** One guide: its header, the article with its contents beside it, a prompt to
 * practice, and more guides. */
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
            { properties: { className: ["blog-heading-anchor"] } },
          ],
        ],
      },
    },
  });

  return (
    <section className="marketing-section">
      <div className="marketing-container">
        <Breadcrumbs
          items={[
            {
              label:
                post.category === "Content creation"
                  ? "Guides"
                  : "Speaking guides",
              href: "/blog",
            },
            { label: post.title, href: `/blog/${post.slug}` },
          ]}
        />
        <header className={articleStyles.header}>
          <span
            className={`${blogStyles.chip} ${blogStyles.tone}`}
            data-tone={categoryTone(post.category)}
          >
            {post.category}
          </span>
          <h1>{post.title}</h1>
          <p className="marketing-lede">{post.excerpt}</p>
          <p className={articleStyles.byline}>
            <strong>{post.author}</strong>
            <span>{formatBlogDate(post.publishedAt)}</span>
            <span>{post.readingTimeText}</span>
          </p>
        </header>

        <div className={articleStyles.layout}>
          <article className="min-w-0">
            <div className={articleStyles.prose}>{content}</div>
            <PostPractice creator={post.category === "Content creation"} />
          </article>
          <PostToc headings={post.headings} />
        </div>

        {relatedPosts.length > 0 && (
          <section className={articleStyles.related}>
            <h2 className="type-h3">Keep reading</h2>
            <div className={blogStyles.grid}>
              {relatedPosts.map((related) => (
                <PostCard key={related.slug} post={related} />
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
