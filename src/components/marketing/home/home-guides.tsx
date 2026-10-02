import { getAllBlogPosts } from "@/lib/blog";
import GuidesRail from "./guides-rail";

// The guides people arrive at most from search first, then the rest of the
// practice set.
const SLUGS = [
  "1-minute-speech-topics",
  "impromptu-speaking-practice",
  "how-to-practice-public-speaking-alone",
  "overcome-filler-words",
  "public-speaking-practice-exercises",
  "what-to-do-when-your-mind-goes-blank",
  "how-to-start-a-speech",
];

/** Picks the guides for the homepage shelf from the blog. */
export default function HomeGuides() {
  const posts = getAllBlogPosts();
  const guides = SLUGS.flatMap((slug) => {
    const post = posts.find((item) => item.slug === slug);
    return post
      ? [
          {
            slug: post.slug,
            title: post.title,
            excerpt: post.excerpt,
            category: post.category,
            readingTimeText: post.readingTimeText,
          },
        ]
      : [];
  });
  return guides.length > 0 ? <GuidesRail guides={guides} /> : null;
}
