import { describe, expect, it } from "vitest";
import {
  defaultCover,
  withCoverFrame,
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

describe("custom thumbnail selection", () => {
  it.each(["uploaded", "generated"] as const)(
    "preserves %s artwork when the selected video frame changes",
    (source) => {
      const draft = { ...defaultCover("Video"), source, image: "custom-image" };
      expect(
        withCoverFrame(draft, { image: "new-frame", time: 2.5 }),
      ).toMatchObject({
        source,
        image: "custom-image",
        frameImage: "new-frame",
        frameTime: 2.5,
      });
    },
  );
  it("updates the cover after switching back to the video frame", () => {
    expect(
      withCoverFrame(defaultCover("Video"), { image: "new-frame", time: 2.5 }),
    ).toMatchObject({
      source: "frame",
      image: "new-frame",
      frameImage: "new-frame",
      frameTime: 2.5,
    });
  });
});
