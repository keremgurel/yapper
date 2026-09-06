import { describe, expect, it } from "vitest";
import {
  blockFrom,
  changeKind,
  docFromItem,
  moveBlock,
  patchFromDoc,
  scriptOf,
} from "@/lib/content/canvas-doc";
import {
  applyCanvasActions,
  parseCanvasActions,
} from "@/lib/content/canvas-actions";

describe("canvas document", () => {
  it("lifts a stored script into a script block when the body has none", () => {
    const doc = docFromItem({
      blocks: [{ label: "Key points", kind: "bullets", items: ["a", "b"] }],
      script: "Hello there.",
    });
    expect(doc.map((b) => b.kind)).toEqual(["script", "bullets"]);
    expect(doc[0].text).toBe("Hello there.");
  });

  it("does not duplicate a script the body already carries", () => {
    const doc = docFromItem({
      blocks: [{ label: "Script", kind: "script", text: "Spoken words." }],
      script: "Spoken words.",
    });
    expect(doc).toHaveLength(1);
  });

  it("mirrors the first script block into the script field", () => {
    const doc = [
      blockFrom({ label: "Notes", kind: "paragraph", text: "n" }),
      blockFrom({ label: "Script", kind: "script", text: "Read this." }),
    ];
    expect(scriptOf(doc)).toBe("Read this.");
    const patch = patchFromDoc(doc);
    expect(patch.script).toBe("Read this.");
    expect(patch.blocks[0]).toEqual({
      label: "Notes",
      kind: "paragraph",
      text: "n",
    });
    expect(patch.blocks[1]).toEqual({
      label: "Script",
      kind: "script",
      text: "Read this.",
    });
  });

  it("keeps the words when a block changes kind", () => {
    const [prose] = [
      blockFrom({ label: "L", kind: "paragraph", text: "one\ntwo" }),
    ];
    const [asList] = changeKind([prose], prose.id, "bullets");
    expect(asList.items).toEqual(["one", "two"]);
    const [back] = changeKind([asList], asList.id, "paragraph");
    expect(back.text).toBe("one\ntwo");
  });

  it("moves blocks without losing identity", () => {
    const a = blockFrom({ label: "a" });
    const b = blockFrom({ label: "b" });
    const moved = moveBlock([a, b], b.id, -1);
    expect(moved.map((x) => x.id)).toEqual([b.id, a.id]);
    expect(moveBlock(moved, b.id, -1)).toBe(moved);
  });
});

describe("canvas actions", () => {
  const doc = [
    blockFrom({ label: "Hook", kind: "paragraph", text: "old hook" }),
    blockFrom({ label: "Script", kind: "script", text: "old script" }),
  ];

  it("parses replace, insert, append, hooks and title, and drops bad indexes", () => {
    const actions = parseCanvasActions(
      {
        actions: [
          {
            type: "replace",
            index: 1,
            block: { label: "", kind: "script", text: "new script" },
          },
          {
            type: "insert",
            after: 0,
            block: { label: "Objections", kind: "bullets", items: ["x", "y"] },
          },
          {
            type: "append",
            block: { label: "CTA", kind: "paragraph", text: "Follow." },
          },
          {
            type: "replace",
            index: 9,
            block: { label: "nope", kind: "paragraph", text: "x" },
          },
          { type: "hooks", options: ["A", "B"], replace: true },
          { type: "title", title: "  Better title  " },
          { type: "explode" },
          { type: "append", block: { label: "empty", kind: "paragraph" } },
        ],
      },
      doc.length,
    );
    expect(actions.map((a) => a.type)).toEqual([
      "replace",
      "insert",
      "append",
      "hooks",
      "title",
    ]);
  });

  it("applies actions against the document it was asked about", () => {
    const actions = parseCanvasActions(
      {
        actions: [
          {
            type: "replace",
            index: 1,
            block: { label: "", kind: "script", text: "new script" },
          },
          {
            type: "insert",
            after: 0,
            block: { label: "Objections", kind: "bullets", items: ["x"] },
          },
          { type: "hooks", options: ["A"] },
          { type: "title", title: "Better" },
        ],
      },
      doc.length,
    );
    const next = applyCanvasActions(
      { title: "Old", blocks: doc, hooks: ["h0"] },
      actions,
    );
    expect(next.title).toBe("Better");
    expect(next.hooks).toEqual(["h0", "A"]);
    expect(next.blocks.map((b) => b.label)).toEqual([
      "Hook",
      "Objections",
      "Script",
    ]);
    // Replace keeps identity and the existing label when the reply left it blank.
    expect(next.blocks[2].id).toBe(doc[1].id);
    expect(next.blocks[2].text).toBe("new script");
  });

  it("returns nothing for a reply that is not an action list", () => {
    expect(parseCanvasActions("nope", 2)).toEqual([]);
    expect(parseCanvasActions({ actions: "x" }, 2)).toEqual([]);
  });
});
