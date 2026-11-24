import { describe, expect, it } from "vitest";
import { paletteFor } from "../../studio/scene/scene-colors";
import { windowsContent, wordsContent } from "./content-spec";
import {
  booleanOption,
  colorOption,
  enumOption,
  mediaOption,
  numberOption,
  textOption,
} from "./option-builders";
import { resolveContent, resolveOptions } from "./resolve-values";

const specs = {
  size: numberOption({ label: "Size", default: 50, min: 36, max: 84 }),
  backdrop: enumOption({
    label: "Backdrop",
    default: "frosted",
    choices: [
      { value: "frosted", label: "Blurred take" },
      { value: "dots", label: "Dotted grid" },
    ],
  }),
  accent: colorOption({ label: "Accent", default: "#E2B33C" }),
  shadow: booleanOption({ label: "Shadow", default: true }),
  title: textOption({ label: "Title", default: "Hello", maxLength: 8 }),
  media: mediaOption({ label: "Media", accepts: ["image"] }),
};

describe("resolveOptions", () => {
  it("fills every default when nothing is sent", () => {
    expect(resolveOptions(specs)).toEqual({
      values: {
        size: 50,
        backdrop: "frosted",
        accent: "#E2B33C",
        shadow: true,
        title: "Hello",
        media: null,
      },
      notes: [],
    });
  });

  it("keeps valid values and normalises colours", () => {
    const { values, notes } = resolveOptions(specs, {
      size: 60,
      backdrop: "dots",
      accent: "#abc",
      shadow: false,
      media: "https://example.com/a.png",
    });
    expect(values).toMatchObject({
      size: 60,
      backdrop: "dots",
      accent: "#AABBCC",
      shadow: false,
      media: "https://example.com/a.png",
    });
    expect(notes).toEqual([]);
  });

  it("clamps a number and says so", () => {
    const { values, notes } = resolveOptions(specs, { size: 400 });
    expect(values.size).toBe(84);
    expect(notes).toEqual([
      "Moved 'size' from 400 to 84, the nearest allowed value.",
    ]);
  });

  it("falls back on a wrong value and names the allowed ones", () => {
    const { values, notes } = resolveOptions(specs, {
      backdrop: "lava",
      shadow: "yes",
    });
    expect(values.backdrop).toBe("frosted");
    expect(values.shadow).toBe(true);
    expect(notes).toEqual([
      "Kept the default for 'backdrop': it takes one of frosted, dots.",
      "Kept the default for 'shadow': it needs true or false.",
    ]);
  });

  it("notes an unknown option instead of failing", () => {
    expect(resolveOptions(specs, { glow: 3 }).notes).toEqual([
      "Ignored an unknown option 'glow'.",
    ]);
  });

  it("resolves a brand token against the palette it is given", () => {
    const palette = paletteFor(["#0056D6"]);
    expect(
      resolveOptions(specs, { accent: "brand.primary" }, palette).values.accent,
    ).toBe("#0056D6");
  });

  it("cuts text to its limit", () => {
    expect(
      resolveOptions(specs, { title: "A much longer title" }).values.title,
    ).toBe("A much l");
  });
});

describe("resolveContent", () => {
  const content = {
    words: wordsContent("Words"),
    windows: windowsContent("Windows"),
  };

  it("defaults lists to empty", () => {
    expect(resolveContent(content).values).toEqual({ words: [], windows: [] });
  });

  it("drops malformed words and windows", () => {
    const { values } = resolveContent(content, {
      words: [
        { text: "ok", start: 0, end: 0.2, confidence: 0.9 },
        { text: "backwards", start: 2, end: 1 },
        { text: 7, start: 0, end: 1 },
      ],
      windows: [
        { from: 1, to: 3 },
        { from: 3, to: 3 },
      ],
    });
    expect(values.words).toEqual([{ text: "ok", start: 0, end: 0.2 }]);
    expect(values.windows).toEqual([{ from: 1, to: 3 }]);
  });
});
