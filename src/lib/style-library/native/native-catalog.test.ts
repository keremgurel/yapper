import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { editTemplate } from "../templates/edit-template";
import { getTemplate } from "../templates/registry";
import { compileTemplate, nativeStyleCatalog } from "./compile-template";

/**
 * The catalog the Mac app bundles. Regenerate it after changing a template or
 * a block the editor draws:
 *
 *   UPDATE_NATIVE_STYLES=1 npx vitest run src/lib/style-library/native
 */
const BUNDLED = join(
  process.cwd(),
  "native-macos/Sources/YapperNative/Resources/StyleTemplates/templates.json",
);

const half = () => {
  const template = getTemplate("half-and-half");
  if (!template) throw new Error("half-and-half is missing");
  return template;
};

describe("native style catalog", () => {
  it("matches the file bundled with the Mac app", () => {
    const fresh = nativeStyleCatalog();
    if (process.env.UPDATE_NATIVE_STYLES) {
      writeFileSync(BUNDLED, `${JSON.stringify(fresh, null, 2)}\n`);
    }
    // Compared as data: the commit hook reformats the file.
    expect(JSON.parse(readFileSync(BUNDLED, "utf8"))).toEqual(fresh);
  });

  it("puts the camera below the seam and the visual above it", () => {
    const plan = compileTemplate(half());
    if ("skipped" in plan) throw new Error(plan.skipped);
    expect(plan.layout).toMatchObject({
      kind: "split",
      camera: { x: 0, y: 0.5, width: 1, height: 0.5 },
      top: { x: 0, y: 0, width: 1, height: 0.5 },
    });
    expect(plan.backdrop).toEqual({
      preset: "shapeGrid",
      presetColors: ["#0A0A0A"],
    });
  });

  it("moves captions to the seam unless their height was set", () => {
    const plan = compileTemplate(half());
    if ("skipped" in plan) throw new Error(plan.skipped);
    expect(plan.captions?.style.y).toBe(0.525);
    expect(plan.captions?.style.fontScale).toBe(0.026);
    expect(plan.captions?.wordsPerCard).toBe(3);

    const edited = editTemplate(half(), {
      op: "setOptions",
      at: "captions",
      options: { y: 1500 },
    });
    if (!edited.ok) throw new Error(edited.message);
    const moved = compileTemplate(edited.template);
    if ("skipped" in moved) throw new Error(moved.skipped);
    expect(moved.captions?.style.y).toBe(0.7813);
  });

  it("follows an edited seam and backdrop", () => {
    const edited = editTemplate(half(), {
      op: "setOptions",
      at: "layout",
      options: { splitAt: 768, backdrop: "color", backdropColor: "#1e3a8a" },
    });
    if (!edited.ok) throw new Error(edited.message);
    const plan = compileTemplate(edited.template);
    if ("skipped" in plan) throw new Error(plan.skipped);
    expect(plan.layout).toMatchObject({
      camera: { y: 0.4, height: 0.6 },
      top: { height: 0.4 },
    });
    expect(plan.backdrop).toEqual({ color: "#1E3A8A" });
    expect(plan.captions?.style.y).toBe(0.425);
  });

  it("compiles every first-party template, the speaker card included", () => {
    const catalog = nativeStyleCatalog();
    expect(catalog.templates.map((item) => item.id)).toEqual([
      "talking-head",
      "half-and-half",
      "speaker-card",
      "speaker-below",
    ]);
    expect(catalog.skipped).toEqual([]);
    const below = catalog.templates.find((item) => item.id === "speaker-below");
    expect(below?.unsupported.join(" ")).toContain("cards.smoked-glass");
  });

  it("puts the speaker in a rounded card that breaks out of its edge", () => {
    const card = getTemplate("speaker-card");
    if (!card) throw new Error("speaker-card is missing");
    const plan = compileTemplate(card);
    if ("skipped" in plan) throw new Error(plan.skipped);
    expect(plan.layout).toMatchObject({
      kind: "card",
      camera: { x: 0.09, y: 0.5208, width: 0.82, height: 0.4792 },
      cameraTop: -0.1196,
      cornerRadius: 0.0444,
      popOut: true,
      visual: { x: 0.037, y: 0.1094, width: 0.9259, height: 0.401 },
    });
    expect(plan.backdrop).toEqual({
      preset: "shapeGrid",
      presetColors: ["#0A0A0A"],
    });
    expect(plan.captions?.style.y).toBe(0.5234);
  });
});
