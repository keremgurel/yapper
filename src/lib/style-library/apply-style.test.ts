import { describe, expect, it } from "vitest";
import { applyStyle } from "./apply-style";
import {
  changedOptions,
  variantIsBehind,
  variantRequest,
  type StyleVariant,
} from "./format/style-variant";
import { getStyle } from "./registry";

describe("applyStyle", () => {
  it("applies a style by name with a few options changed", () => {
    const result = applyStyle({
      styleId: "splits.speaker-below",
      options: { backdrop: "dots", cornerRadius: 24 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.applied.options).toMatchObject({
      backdrop: "dots",
      cornerRadius: 24,
      speakerScale: 0.82,
      speakerTop: 1000,
    });
    expect(result.applied.notes).toEqual([]);
  });

  it("starts with no content of its own, so a preview sample never leaks into a real video", () => {
    const result = applyStyle({ styleId: "covers.series" });
    expect(result.ok && result.applied.content.frame).toBeNull();
  });

  it("answers an unknown name with the names that exist", () => {
    const result = applyStyle({ styleId: "splits.sideways" });
    expect(result).toMatchObject({ ok: false, reason: "unknown_style" });
    expect(!result.ok && result.known).toContain("splits.speaker-below");
  });
});

describe("a saved variant", () => {
  const base = getStyle("splits.speaker-below")!;
  const variant: StyleVariant = {
    id: "v1",
    name: "My navy split",
    baseStyleId: base.id,
    baseVersion: 1,
    options: { backdrop: "color", backdropColor: "#1E3A8A" },
    content: {},
  };

  it("applies as its base with the saved options, and one-off changes win", () => {
    const result = applyStyle(
      variantRequest(variant, { options: { backdropColor: "#000000" } }),
    );
    expect(result.ok && result.applied.options).toMatchObject({
      backdrop: "color",
      backdropColor: "#000000",
      speakerScale: 0.82,
    });
  });

  it("stores only what differs from the base", () => {
    const applied = applyStyle(variantRequest(variant));
    expect(applied.ok && changedOptions(base, applied.applied.options)).toEqual(
      variant.options,
    );
  });

  it("knows when its base has moved on", () => {
    expect(variantIsBehind(variant, base)).toBe(false);
    expect(variantIsBehind(variant, { ...base, version: 2 })).toBe(true);
  });
});
