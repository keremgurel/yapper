import { describe, expect, it } from "vitest";
import { styleCatalog } from "./catalog";
import { resolveContent, resolveOptions } from "./format/resolve-values";
import { STYLE_CATEGORIES } from "./format/style-category";
import { getStyle, STYLES } from "./registry";

const CATEGORY_IDS = STYLE_CATEGORIES.map(
  (category) => category.id,
) as string[];

describe("the style registry", () => {
  it("has unique ids of the form <category>.<name>", () => {
    const ids = STYLES.map((style) => style.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const style of STYLES) {
      expect(style.id).toMatch(/^[a-z-]+\.[a-z0-9-]+$/);
      expect(style.id.split(".")[0]).toBe(style.category);
      expect(CATEGORY_IDS).toContain(style.category);
      expect(getStyle(style.id)).toBe(style);
    }
  });

  it.each(STYLES.map((style) => [style.id, style] as const))(
    "%s: defaults and preview content pass their own specs",
    (_id, style) => {
      // A default the validator would change means the default itself is wrong.
      const defaults = Object.fromEntries(
        Object.entries(style.options).map(([key, spec]) => [key, spec.default]),
      );
      expect(resolveOptions(style.options, defaults)).toEqual({
        values: defaults,
        notes: [],
      });
      expect(
        resolveContent(style.content, style.preview.content).notes,
      ).toEqual([]);
      expect(
        resolveOptions(style.options, style.preview.options).notes,
      ).toEqual([]);
    },
  );

  it.each(STYLES.map((style) => [style.id, style] as const))(
    "%s: showWhen points at an enum option and real choices",
    (_id, style) => {
      for (const spec of Object.values(style.options)) {
        if (!spec.showWhen) continue;
        const controller = style.options[spec.showWhen.option];
        expect(controller?.kind).toBe("enum");
        if (controller?.kind !== "enum") continue;
        const choices = controller.choices.map((choice) => choice.value);
        for (const value of spec.showWhen.in) expect(choices).toContain(value);
      }
    },
  );

  it("fills preview slots only with blocks those slots accept", () => {
    for (const style of STYLES) {
      for (const [name, block] of Object.entries(style.preview.slots ?? {})) {
        const slot = style.slots?.[name];
        expect(slot, `${style.id} has no slot '${name}'`).toBeDefined();
        expect(slot?.accepts).toContain(getStyle(block.styleId)?.category);
      }
    }
  });

  it("every entry has rules, a summary and a poster inside its preview", () => {
    for (const style of STYLES) {
      expect(style.rules.length).toBeGreaterThan(0);
      expect(style.summary.length).toBeGreaterThan(20);
      expect(style.preview.posterS).toBeLessThanOrEqual(
        style.preview.durationS,
      );
      expect(style.output === "still").toBe(style.preview.durationS === 0);
    }
  });

  it("writes no em or en dashes in anything a person reads", () => {
    const copy = JSON.stringify(styleCatalog());
    expect(copy).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("styleCatalog", () => {
  it("lists shelves in gallery order and is plain JSON", () => {
    const shelves = styleCatalog();
    expect(shelves.map((shelf) => shelf.id)).toEqual([
      "captions",
      "layouts",
      "splits",
      "cards",
      "overlays",
      "covers",
    ]);
    expect(JSON.parse(JSON.stringify(shelves))).toEqual(shelves);
    expect(shelves[2].styles[0].poster).toBe(
      "/style-previews/splits.speaker-below.jpg",
    );
  });
});
