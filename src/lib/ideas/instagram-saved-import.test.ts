import { describe, expect, it } from "vitest";
import { parseInstagramSavedFiles } from "./instagram-saved-import";

describe("parseInstagramSavedFiles", () => {
  it("reads Meta string_list_data and keeps only Instagram post URLs", () => {
    const entries = parseInstagramSavedFiles({
      "your_instagram_activity/saved/saved_posts.json": JSON.stringify({
        saved_saved_media: [
          {
            title: "creator_one",
            string_list_data: [
              {
                href: "https://www.instagram.com/reel/ABC123/?igsh=x",
                timestamp: 1_750_000_000,
              },
            ],
          },
          {
            title: "Not a post",
            string_list_data: [{ href: "https://example.com/nope" }],
          },
        ],
      }),
    });

    expect(entries).toEqual([
      {
        url: "https://www.instagram.com/reel/ABC123/",
        title: "creator_one",
        collection: "All saved posts",
        savedAt: 1_750_000_000_000,
        sourceFile: "your_instagram_activity/saved/saved_posts.json",
      },
    ]);
  });

  it("deduplicates tracked URLs and tolerates HTML exports", () => {
    const entries = parseInstagramSavedFiles({
      "saved_posts.html": `
        <a href="https://instagram.com/p/POST1/?utm_source=x">one</a>
        <a href="https://www.instagram.com/p/POST1/">duplicate</a>
      `,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe("https://www.instagram.com/p/POST1/");
  });

  it("uses collection-shaped wrappers as collection labels", () => {
    const entries = parseInstagramSavedFiles({
      "saved_collections.json": JSON.stringify({
        saved_collections: [
          {
            title: "Hooks",
            items: [
              {
                title: "creator_one",
                string_list_data: [
                  { href: "https://www.instagram.com/reel/HOOK1/" },
                ],
              },
            ],
          },
        ],
      }),
    });

    expect(entries[0]?.collection).toBe("Hooks");
  });
});
