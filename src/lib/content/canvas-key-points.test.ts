import { describe, expect, it } from "vitest";
import { applyCanvasActions, keyPointsOnly } from "./canvas-actions";
import { blockFrom } from "./canvas-doc";

describe("dedicated key points command", () => {
  it("preserves the script, title and hooks even when the model asks to replace them", () => {
    const script = blockFrom({
      label: "Script",
      kind: "script",
      text: "The complete original script.",
    });
    const before = { title: "My idea", hooks: ["My hook"], blocks: [script] };
    const actions = keyPointsOnly([
      {
        type: "replace",
        index: 0,
        block: {
          label: "Key points",
          kind: "bullets",
          items: ["First", "Second"],
        },
      },
      { type: "title", title: "A different title" },
      { type: "hooks", replace: true, options: ["Different hook"] },
    ]);
    const after = applyCanvasActions(before, actions);
    expect(after.title).toBe(before.title);
    expect(after.hooks).toEqual(before.hooks);
    expect(after.blocks[0]).toEqual(script);
    expect(after.blocks[1].items).toEqual(["First", "Second"]);
  });
  it("does not apply an unrelated rewrite when no key points were returned", () => {
    expect(keyPointsOnly([{ type: "title", title: "Wrong field" }])).toEqual(
      [],
    );
  });
});
