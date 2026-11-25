import { describe, expect, it } from "vitest";
import { getStyle } from "../registry";
import { captionHeight } from "./caption-height";
import { describeTemplate } from "./describe-template";
import { editTemplate, type TemplateEdit } from "./edit-template";
import { getTemplate, TEMPLATES } from "./registry";
import type { Template } from "./template";
import { listPlaces } from "./template-places";
import { callTemplateTool, TEMPLATE_TOOLS } from "./template-tools";

const half = getTemplate("half-and-half")!;

/** Applies edits in order and fails the test on the first one that is refused. */
function edited(template: Template, ...edits: TemplateEdit[]): Template {
  return edits.reduce((current, edit) => {
    const result = editTemplate(current, edit);
    if (!result.ok) throw new Error(result.message);
    return result.template;
  }, template);
}

const blockAt = (template: Template, path: string) =>
  listPlaces(template).find((place) => place.path === path)?.block;

describe("first-party templates", () => {
  it.each(TEMPLATES.map((template) => [template.id, template] as const))(
    "%s: every block exists and sits somewhere that accepts it",
    (_id, template) => {
      for (const place of listPlaces(template)) {
        if (!place.block) continue;
        const style = getStyle(place.block.styleId);
        expect(style, `${place.path}: ${place.block.styleId}`).toBeDefined();
        expect(place.accepts).toContain(style?.category);
      }
    },
  );

  it("lists a split's slot as its own place", () => {
    expect(listPlaces(half).map((place) => place.path)).toEqual([
      "layout",
      "layout.top",
      "overlay",
      "captions",
    ]);
  });
});

describe("editTemplate", () => {
  it("changes the background of the split without touching anything else", () => {
    const next = edited(half, {
      op: "setOptions",
      at: "layout",
      options: { backdrop: "color", backdropColor: "#1e3a8a" },
    });
    expect(blockAt(next, "layout")?.options).toEqual({
      backdrop: "color",
      backdropColor: "#1E3A8A",
    });
    expect(blockAt(next, "layout.top")).toEqual(blockAt(half, "layout.top"));
    expect(half.layers[0].block?.options).toBeUndefined();
  });

  it("changes the visual in the top half", () => {
    const next = edited(half, {
      op: "setContent",
      at: "layout.top",
      content: { src: "https://example.com/screenshot.png" },
    });
    expect(blockAt(next, "layout.top")?.content).toEqual({
      src: "https://example.com/screenshot.png",
    });
  });

  it("restyles the captions on top of the template", () => {
    const next = edited(half, {
      op: "setOptions",
      at: "captions",
      options: { color: "#FFD93D", fontSize: 64 },
    });
    expect(blockAt(next, "captions")?.options).toEqual({
      color: "#FFD93D",
      fontSize: 64,
    });
  });

  it("swaps the layout and carries the top visual into the new one", () => {
    const next = edited(half, {
      op: "setBlock",
      at: "layout",
      styleId: "splits.speaker-below",
    });
    expect(blockAt(next, "layout")?.styleId).toBe("splits.speaker-below");
    expect(blockAt(next, "layout.visual")).toEqual(blockAt(half, "layout.top"));
  });

  it("empties a place", () => {
    expect(
      blockAt(edited(half, { op: "clear", at: "layout.top" }), "layout.top"),
    ).toBeNull();
  });

  it("clamps and drops bad values, and says what it did", () => {
    const result = editTemplate(half, {
      op: "setOptions",
      at: "captions",
      options: { fontSize: 400, glow: true },
    });
    expect(result.ok && result.notes).toEqual([
      "Moved 'fontSize' from 400 to 84, the nearest allowed value.",
      "Ignored an unknown option 'glow'.",
    ]);
    expect(result.ok && blockAt(result.template, "captions")?.options).toEqual({
      fontSize: 84,
    });
  });

  it("answers a wrong place with the places that exist", () => {
    expect(editTemplate(half, { op: "clear", at: "layout.sky" })).toMatchObject(
      {
        ok: false,
        reason: "unknown_place",
        valid: ["layout", "layout.top", "overlay", "captions"],
      },
    );
  });

  it("refuses a block from the wrong shelf and lists the ones that fit", () => {
    expect(
      editTemplate(half, {
        op: "setBlock",
        at: "captions",
        styleId: "cards.smoked-glass",
      }),
    ).toMatchObject({
      ok: false,
      reason: "not_accepted",
      valid: ["captions.plain-white"],
    });
  });

  it("refuses to set options on an empty place", () => {
    expect(
      editTemplate(half, {
        op: "setOptions",
        at: "overlay",
        options: { scale: 2 },
      }),
    ).toMatchObject({ ok: false, reason: "empty_place" });
  });

  it("refuses an edit it does not know", () => {
    expect(
      editTemplate(half, {
        op: "explode",
        at: "layout",
      } as unknown as TemplateEdit),
    ).toMatchObject({ ok: false, reason: "unknown_edit" });
  });
});

describe("captionHeight", () => {
  it("puts captions on the seam of whichever split is in the layout", () => {
    expect(captionHeight(half)).toBe(1008);
    expect(captionHeight(getTemplate("speaker-below")!)).toBe(1005);
    expect(
      captionHeight(
        edited(half, {
          op: "setOptions",
          at: "layout",
          options: { splitAt: 1100 },
        }),
      ),
    ).toBe(1148);
  });

  it("has no opinion on a full frame, so captions keep their own height", () => {
    expect(captionHeight(getTemplate("talking-head")!)).toBeNull();
  });
});

describe("describeTemplate", () => {
  it("shows each place, what fits there, and only the controls that apply", () => {
    const layout = describeTemplate(half).places[0];
    expect(layout.canHold).toEqual([
      "layouts.full-frame",
      "splits.speaker-below",
      "splits.half-and-half",
    ]);
    const keys = layout.block?.options.map((option) => option.key);
    expect(keys).toContain("dotOpacity");
    // Blur belongs to the blurred take and to media, not to the dotted grid.
    expect(keys).not.toContain("backdropBlur");
    expect(
      layout.block?.options.find((o) => o.key === "splitAt"),
    ).toMatchObject({
      value: 960,
      allowed: [600, 1400],
    });
  });

  it("is plain JSON", () => {
    for (const template of TEMPLATES) {
      const described = describeTemplate(template);
      expect(JSON.parse(JSON.stringify(described)).places).toHaveLength(
        described.places.length,
      );
      expect(JSON.stringify(described)).not.toMatch(/[\u2013\u2014]/);
    }
  });
});

describe("the tool surface", () => {
  it("lets a caller describe, edit and see the result in three calls", () => {
    const first = callTemplateTool(half, "describe_template");
    expect(first.template).toBe(half);

    const second = callTemplateTool(half, "edit_template", {
      op: "setOptions",
      at: "layout",
      options: { backdrop: "frosted" },
    });
    expect(second.result).toMatchObject({ ok: true, notes: [] });
    expect(blockAt(second.template, "layout")?.options).toEqual({
      backdrop: "frosted",
    });
  });

  it("leaves the template alone when an edit is refused", () => {
    const reply = callTemplateTool(half, "edit_template", {
      op: "clear",
      at: "nowhere",
    });
    expect(reply.template).toBe(half);
    expect(reply.result).toMatchObject({ ok: false, reason: "unknown_place" });
  });

  it("names the tools that exist when asked for one that does not", () => {
    expect(callTemplateTool(half, "delete_everything").result).toMatchObject({
      ok: false,
      valid: TEMPLATE_TOOLS.map((tool) => tool.name),
    });
  });
});
