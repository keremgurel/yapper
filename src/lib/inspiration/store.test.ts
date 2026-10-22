import { afterEach, describe, expect, it, vi } from "vitest";
import { loadItems, saveItems } from "@/lib/inspiration/store";

function stubStorage(value: string | null) {
  vi.stubGlobal("window", {
    localStorage: { getItem: () => value, setItem: () => {} },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadItems", () => {
  it("returns [] when nothing is stored", () => {
    stubStorage(null);
    expect(loadItems()).toEqual([]);
  });

  it("loads stored items and backfills a missing kind as video", () => {
    stubStorage(JSON.stringify([{ id: "a" }, { id: "b", kind: "creator" }]));
    expect(loadItems()).toEqual([
      { id: "a", kind: "video" },
      { id: "b", kind: "creator" },
    ]);
  });

  it("falls back to [] when the stored value is not an array", () => {
    // A tampered or schema-shifted value used to crash loadItems on `.map`,
    // permanently breaking the Inspiration library until storage was cleared.
    stubStorage(JSON.stringify({ oops: true }));
    expect(loadItems()).toEqual([]);
  });

  it("falls back to [] on invalid JSON", () => {
    stubStorage("{not json");
    expect(loadItems()).toEqual([]);
  });
});

it("migrates old YouTube feed data but keeps the creator's link, note and organization", () => {
  const setItem = vi.fn();
  const item = {
    id: "a",
    kind: "creator",
    platform: "youtube",
    url: "https://youtube.com/@creator",
    title: "API title",
    thumbnail: "API avatar",
    videos: [{ views: 100 }],
    note: "My idea",
    pillarId: "p",
    createdAt: 1,
  };
  vi.stubGlobal("window", {
    localStorage: { getItem: () => JSON.stringify([item]), setItem },
  });
  const items = loadItems();
  expect(items[0]).toMatchObject({
    note: "My idea",
    pillarId: "p",
    url: item.url,
  });
  expect(items[0]).not.toHaveProperty("videos");
  expect(items[0]).not.toHaveProperty("thumbnail");
  saveItems([{ ...items[0], title: "API title", videos: [] }]);
  expect(setItem.mock.lastCall?.[1]).not.toContain("API title");
  expect(setItem.mock.lastCall?.[1]).not.toContain('"videos"');
});
