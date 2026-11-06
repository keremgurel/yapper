import { describe, expect, it } from "vitest";
import type { ContentBlock } from "@/lib/db/schema";
import { afterSave, baseFor, baseOf } from "./save-base";
import { parseContentBase, rebaseOnto } from "./rebase";

const script = (text: string): ContentBlock => ({
  label: "Script",
  kind: "script",
  text,
});
const beats: ContentBlock = { label: "Beats", kind: "bullets", items: ["A"] };
const added: ContentBlock = { label: "Protein", kind: "bullets", items: ["P"] };
const hook = (text: string) => ({ text, pattern: null, why: null });

describe("rebaseOnto", () => {
  it("writes the patch as sent when nothing changed since the base", () => {
    const merged = rebaseOnto(
      { blocks: [script("Typed.")], script: "Typed." },
      { blocks: [script("Old.")], script: "Old." },
      {
        title: "Gym",
        script: "Old.",
        hooks: [],
        blocks: [script("Old.")],
      },
    );
    expect(merged).toEqual({
      patch: { blocks: [script("Typed.")], script: "Typed." },
      rebased: false,
    });
  });

  it("merges typing from a stale canvas into Chirpy's saved block", () => {
    const merged = rebaseOnto(
      { blocks: [script("Typed."), beats], script: "Typed." },
      { blocks: [script("Old."), beats], script: "Old." },
      {
        title: "Gym",
        script: "Old.",
        hooks: [],
        blocks: [script("Old."), beats, added],
      },
    );
    expect(merged).toEqual({
      patch: { blocks: [script("Typed."), beats, added], script: "Typed." },
      rebased: true,
    });
  });

  it("keeps the mirrored script in step when the merge changes it", () => {
    const merged = rebaseOnto(
      { blocks: [beats], script: null },
      { blocks: [script("Old."), beats], script: "Old." },
      {
        title: "Gym",
        script: "New.",
        hooks: [],
        blocks: [script("New."), beats],
      },
    );
    expect(merged.patch).toEqual({ blocks: [beats], script: null });

    const kept = rebaseOnto(
      { blocks: [script("Old."), { ...beats, items: ["B"] }], script: "Old." },
      { blocks: [script("Old."), beats], script: "Old." },
      {
        title: "Gym",
        script: "New.",
        hooks: [],
        blocks: [script("New."), beats],
      },
    );
    expect(kept.patch).toEqual({
      blocks: [script("New."), { ...beats, items: ["B"] }],
      script: "New.",
    });
  });

  it("merges hooks as lines and takes a title only the other side changed", () => {
    const merged = rebaseOnto(
      { hooks: [hook("Mine"), hook("Two")], title: "Gym" },
      { hooks: ["One", "Two"], title: "Gym" },
      {
        title: "Gym myths",
        script: null,
        hooks: [hook("One"), hook("Two"), hook("Three")],
        blocks: [],
      },
    );
    expect(merged.patch).toEqual({
      hooks: [hook("Mine"), hook("Two"), hook("Three")],
      title: "Gym myths",
    });
    expect(merged.rebased).toBe(true);
  });

  it("reads a base the way the server stores fields", () => {
    expect(
      parseContentBase({
        title: "Gym",
        hooks: [{ text: " Stop " }, ""],
        blocks: [{ label: "", kind: "paragraph", text: "x" }, beats],
        extra: true,
      }),
    ).toEqual({ title: "Gym", hooks: ["Stop"], blocks: [beats] });
    expect(parseContentBase(undefined)).toBeUndefined();
  });
});

describe("a client's base", () => {
  it("sends the base of only the fields it saves", () => {
    const base = baseOf({
      title: "Gym",
      script: "Old.",
      hooks: [hook("One")],
      blocks: [script("Old.")],
    });
    expect(baseFor({ hooks: ["Two"] }, base)).toEqual({ hooks: ["One"] });
  });

  it("shows a merged save only where the creator has not typed since", () => {
    const base = { blocks: [script("Old.")], title: "Gym" };
    const sent = { blocks: [script("Typed.")], title: "Gym" };
    const saved = { blocks: [script("Typed."), added], title: "Gym" };
    expect(
      afterSave({ base, sent, saved, latest: sent, rebased: true }),
    ).toEqual({
      base: saved,
      show: { blocks: [script("Typed."), added] },
    });
    // Typed again while the save was out: that copy stays, and goes next
    // with the sent copy as its base so the server merges it again.
    const newer = { blocks: [script("Typed more.")], title: "Gym" };
    expect(
      afterSave({ base, sent, saved, latest: newer, rebased: true }),
    ).toEqual({ base: { blocks: sent.blocks, title: "Gym" }, show: {} });
    expect(
      afterSave({ base, sent, saved: sent, latest: newer, rebased: false }),
    ).toEqual({ base: sent, show: {} });
  });
});
