import { describe, expect, it } from "vitest";
import { videosByCreator } from "./relations";
import type { InspirationItem } from "./types";

let seq = 0;
function video(fields: Partial<InspirationItem>): InspirationItem {
  return {
    id: `v${seq++}`,
    kind: "video",
    pillarId: null,
    url: "https://youtube.com/watch?v=x",
    platform: "youtube",
    title: "clip",
    createdAt: 0,
    ...fields,
  };
}

const creator: InspirationItem = {
  id: "creator-1",
  kind: "creator",
  pillarId: null,
  url: "https://youtube.com/@outjump",
  platform: "youtube",
  title: "OutJump",
  handle: "outjump",
  createdAt: 0,
};

describe("videosByCreator", () => {
  it("returns clips explicitly linked to the creator", () => {
    const linked = video({ creatorItemId: "creator-1", author: "whoever" });
    const other = video({ creatorItemId: "creator-2", author: "outjump" });
    expect(videosByCreator(creator, [linked, other])).toEqual([linked]);
  });

  it("matches unlinked clips by author name, loosely both ways", () => {
    const exact = video({ author: "OutJump" });
    const suffixed = video({ author: "OutJump Official" });
    expect(videosByCreator(creator, [exact, suffixed])).toEqual([
      exact,
      suffixed,
    ]);
  });

  it("does not let a 1-2 char handle substring-match an unrelated creator", () => {
    // "T.J." normalizes to "tj", which is a substring of "outjump". The length
    // floor must stop that from matching.
    const tj = video({ author: "T.J." });
    expect(videosByCreator(creator, [tj])).toEqual([]);
  });

  it("ignores creator items and unrelated authors", () => {
    const creatorItem = video({ kind: "creator", author: "OutJump" });
    const unrelated = video({ author: "Some Other Person" });
    expect(videosByCreator(creator, [creatorItem, unrelated])).toEqual([]);
  });
});
