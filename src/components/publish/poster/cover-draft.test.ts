import { describe, expect, it } from "vitest";
import {
  defaultCover,
  DEFAULT_THUMBNAIL_PROMPT,
} from "@/components/publish/poster/cover-draft";

describe("Poster thumbnail defaults", () => {
  it("starts from the video without placing a synthetic card over it", () => {
    expect(defaultCover("A title")).toMatchObject({
      image: null,
      frameImage: null,
      source: "frame",
      headline: "",
      showHeadline: false,
    });
  });

  it("gives image generation a useful editable starting point", () => {
    expect(DEFAULT_THUMBNAIL_PROMPT).toContain("identity-faithful");
    expect(DEFAULT_THUMBNAIL_PROMPT).toContain("Do not add text");
  });
});
