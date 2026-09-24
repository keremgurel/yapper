import { describe, expect, it } from "vitest";
import { paletteFor } from "./scene-colors";

describe("paletteFor", () => {
  it("reads the kit by role: primary, secondary, background, accent", () => {
    expect(
      paletteFor(["#FF7A21", "#151515", "#FFFFFF", "#FFD93D"]),
    ).toMatchObject({
      primary: "#FF7A21",
      secondary: "#151515",
      surface: "#FFFFFF",
      accent: "#FFD93D",
      ink: "#1B181C",
    });
  });

  it("switches ink to white on a dark background", () => {
    expect(paletteFor(["#FF7A21", "#FFFFFF", "#101010"]).ink).toBe("#FFFFFF");
  });

  it("falls back to a white background and primary accent", () => {
    expect(paletteFor(["#0056D6"])).toMatchObject({
      surface: "#FFFFFF",
      accent: "#0056D6",
    });
  });
});
