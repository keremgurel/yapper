import { afterEach, describe, expect, it, vi } from "vitest";
import { loadItems } from "@/lib/inspiration/store";

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
