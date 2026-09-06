import { describe, expect, it } from "vitest";
import { applyBrandCommand, parseBrandCommand } from "./command";
import {
  nextBrandColor,
  normalizeBrandColor,
  parseBrandColors,
} from "./colors";

describe("conversational brand colors", () => {
  it.each([
    "My colors are #f70, black, and white",
    "My brand colours are #f70, black and white",
    "Please set my brand colors to #f70, black, white",
    "Can you create my brand kit with #f70, black, white?",
    "Use #f70, black and white for my brand kit",
    "Remember my brand colors are #f70, black and white",
    "My palette: orange (#f70), black and white",
    "Chirpy, my colors are #f70, black, white",
    "I want to use #f70, black and white for my brand",
    "I would like to use #f70, black and white for my brand",
    "Let's use #f70, black and white for our brand kit",
    "Our brand uses #f70, black and white",
  ])("saves explicit user colors: %s", (text) => {
    expect(parseBrandCommand(text)).toEqual({
      kind: "update",
      operation: "set",
      colors: ["#FF7700", "#000000", "#FFFFFF"],
    });
  });

  it.each([
    "Show my brand kit",
    "Put up my brand kit",
    "What are my brand colors?",
    "Open my palette",
  ])("opens the real saved kit: %s", (text) => {
    expect(parseBrandCommand(text)).toEqual({ kind: "show" });
  });

  it("accepts exact named colors and consecutive hex codes", () => {
    expect(normalizeBrandColor("rebecca purple")).toBe("#663399");
    expect(parseBrandCommand("My colors are #123 #456 #789")).toMatchObject({
      colors: ["#112233", "#445566", "#778899"],
    });
    expect(
      parseBrandCommand("My colors are primary: #123, secondary: #456"),
    ).toMatchObject({ colors: ["#112233", "#445566"] });
  });

  it.each([
    "My brand colors are #ff7a21 and #12345",
    "My colors are warm sunset orange and white",
    "Set up my brand kit",
    "Set my palette to #1234",
    "Make black and white primary",
  ])("asks for clarification without partially changing a kit: %s", (text) => {
    expect(parseBrandCommand(text)?.kind).toBe("clarify");
  });

  it.each([
    "What colors should I use for my brand?",
    "Should I set my brand colors to red?",
    "Don't change my brand colors to black",
    "Create an idea about brand colors",
    "Remember that my audience likes blue",
    "My colors are black, not blue",
    "Would red work for my brand?",
  ])("leaves advice, negation and unrelated commands alone: %s", (text) => {
    expect(parseBrandCommand(text)).toBeNull();
  });

  it("accepts a palette-only follow-up in a brand conversation", () => {
    expect(parseBrandCommand("navy and gold", true)).toMatchObject({
      colors: ["#000080", "#FFD700"],
    });
    expect(parseBrandCommand("navy and gold")).toBeNull();
  });

  it.each([
    ["Add red to my brand colors", ["#FFFFFF", "#000000", "#FF0000"]],
    ["Remove white from my brand kit", ["#000000"]],
    ["Make black my primary color", ["#000000", "#FFFFFF"]],
    ["My primary brand color is black", ["#000000", "#FFFFFF"]],
  ])(
    "edits the existing palette instead of replacing it: %s",
    (text, expected) => {
      const command = parseBrandCommand(text as string);
      expect(command?.kind).toBe("update");
      if (command?.kind === "update")
        expect(applyBrandCommand(command, ["#FFFFFF", "#000000"])).toEqual(
          expected,
        );
    },
  );

  it("rejects over-limit changes and deduplicates exact colors", () => {
    expect(parseBrandColors(["#fff", "white", "#FFFFFF"])).toEqual(["#FFFFFF"]);
    expect(parseBrandColors(["white", "invalid"])).toBeNull();
    expect(parseBrandColors(["constructor"])).toBeNull();
    expect(parseBrandColors(["__proto__"])).toBeNull();
    expect(parseBrandColors([])).toEqual([]);
    expect(() =>
      applyBrandCommand(
        { kind: "update", operation: "add", colors: ["#FF0000"] },
        Array.from({ length: 8 }, (_, i) => `#00000${i}`),
      ),
    ).toThrow("brand_color_limit");
  });

  it("the manual editor can add eight distinct colors", () => {
    const colors: string[] = [];
    for (let i = 0; i < 8; i++) {
      const next = nextBrandColor(colors);
      expect(next).toBeTruthy();
      expect(colors).not.toContain(next);
      colors.push(next!);
    }
    expect(nextBrandColor(colors)).toBeNull();
  });
});
