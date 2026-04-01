import fs from "node:fs";
import path from "node:path";

import GithubSlugger from "github-slugger";
import matter from "gray-matter";
import readingTime from "reading-time";

export type BlogHeading = {
  id: string;
  level: 2 | 3;
  text: string;
};

export type BlogPostMeta = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  author: string;
  category: string;
  tags: string[];
  featured: boolean;
  cover: string | null;
  readingTimeText: string;
  readingTimeMinutes: number;
  headings: BlogHeading[];
};

export type BlogPost = BlogPostMeta & {
  content: string;
};

type BlogFrontmatter = {
  title?: string;
  excerpt?: string;
  publishedAt?: string;
  author?: string;
  category?: string;
  tags?: string[];
  featured?: boolean;
  cover?: string;
};

const BLOG_DIRECTORY = path.join(process.cwd(), "content", "blog");
const BLOG_EXTENSIONS = [".mdx", ".md"] as const;

function assertString(
  value: unknown,
  field: keyof BlogFrontmatter,
  filePath: string,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `Expected "${field}" to be a non-empty string in ${filePath}`,
    );
  }

  return value.trim();
}

function assertStringArray(
  value: unknown,
  field: keyof BlogFrontmatter,
  filePath: string,
): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Expected "${field}" to be a string array in ${filePath}`);
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function getBlogFileNames(): string[] {
  if (!fs.existsSync(BLOG_DIRECTORY)) {
    return [];
  }

  return fs
    .readdirSync(BLOG_DIRECTORY)
    .filter((fileName) => !fileName.startsWith("_"))
    .filter((fileName) =>
      BLOG_EXTENSIONS.some((extension) => fileName.endsWith(extension)),
    );
}

function resolveBlogFilePath(slug: string): string | null {
  for (const extension of BLOG_EXTENSIONS) {
    const filePath = path.join(BLOG_DIRECTORY, `${slug}${extension}`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

function extractHeadings(content: string): BlogHeading[] {
  const headings: BlogHeading[] = [];
  const lines = content.split("\n");
  let insideCodeFence = false;
  const slugger = new GithubSlugger();

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      insideCodeFence = !insideCodeFence;
      continue;
    }

    if (insideCodeFence) {
      continue;
    }

    const match = /^(##|###)\s+(.+)$/.exec(line.trim());
    if (!match) {
      continue;
    }

    const level = match[1].length as 2 | 3;
    const rawText = match[2]
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .trim();

    if (!rawText) {
      continue;
    }

    headings.push({
      id: slugger.slug(rawText),
      level,
      text: rawText,
    });
  }

  return headings;
}

function readBlogSource(filePath: string) {
  const source = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(source);
  const frontmatter = data as BlogFrontmatter;
  const stats = readingTime(content);

  const title = assertString(frontmatter.title, "title", filePath);
  const excerpt = assertString(frontmatter.excerpt, "excerpt", filePath);
  const publishedAt = assertString(
    frontmatter.publishedAt,
    "publishedAt",
    filePath,
  );
  const author = assertString(frontmatter.author, "author", filePath);
  const category = assertString(frontmatter.category, "category", filePath);
  const tags =
    frontmatter.tags === undefined
      ? []
      : assertStringArray(frontmatter.tags, "tags", filePath);

  return {
    content,
    meta: {
      title,
      excerpt,
      publishedAt,
      author,
      category,
      tags,
      featured: frontmatter.featured === true,
      cover: typeof frontmatter.cover === "string" ? frontmatter.cover : null,
      readingTimeMinutes: Math.max(1, Math.ceil(stats.minutes)),
      readingTimeText: stats.text,
      headings: extractHeadings(content),
    },
  };
}

function buildPostMeta(fileName: string): BlogPostMeta {
  const slug = fileName.replace(/\.(md|mdx)$/, "");
  const filePath = path.join(BLOG_DIRECTORY, fileName);
  const { meta } = readBlogSource(filePath);

  return {
    slug,
    ...meta,
  };
}

export function getAllBlogPosts(): BlogPostMeta[] {
  return getBlogFileNames()
    .map(buildPostMeta)
    .sort(
      (left, right) =>
        new Date(right.publishedAt).getTime() -
        new Date(left.publishedAt).getTime(),
    );
}

export function getBlogPostSlugs(): string[] {
  return getBlogFileNames().map((fileName) =>
    fileName.replace(/\.(md|mdx)$/, ""),
  );
}

export function getBlogPostBySlug(slug: string): BlogPost | null {
  const normalizedSlug = slug.replace(/\.(md|mdx)$/, "");
  const filePath = resolveBlogFilePath(normalizedSlug);

  if (!filePath) {
    return null;
  }

  const { content, meta } = readBlogSource(filePath);

  return {
    slug: normalizedSlug,
    content,
    ...meta,
  };
}

export function getFeaturedBlogPost(
  posts: BlogPostMeta[],
): BlogPostMeta | null {
  return posts.find((post) => post.featured) ?? posts[0] ?? null;
}

export function getBlogCategories(posts: BlogPostMeta[]): string[] {
  return Array.from(new Set(posts.map((post) => post.category))).sort(
    (left, right) => left.localeCompare(right),
  );
}

export function getRelatedBlogPosts(
  slug: string,
  posts: BlogPostMeta[],
  limit = 3,
): BlogPostMeta[] {
  const currentPost = posts.find((post) => post.slug === slug);

  if (!currentPost) {
    return [];
  }

  return posts
    .filter((post) => post.slug !== slug)
    .map((post) => {
      let score = 0;

      if (post.category === currentPost.category) {
        score += 3;
      }

      for (const tag of post.tags) {
        if (currentPost.tags.includes(tag)) {
          score += 1;
        }
      }

      return { post, score };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (
        new Date(right.post.publishedAt).getTime() -
        new Date(left.post.publishedAt).getTime()
      );
    })
    .slice(0, limit)
    .map((item) => item.post);
}
