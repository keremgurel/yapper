import { describe, expect, it } from "vitest";
import {
  combinedCaption,
  platformContent,
} from "@/lib/publish/platform-content";

describe("combinedCaption", () => {
  it("puts the title first, then a blank line, then the body", () => {
    expect(
      combinedCaption({ title: "My hook", description: "The full story." }),
    ).toBe("My hook\n\nThe full story.");
  });

  it("collapses to just the present half", () => {
    expect(combinedCaption({ title: "Only a title", description: "  " })).toBe(
      "Only a title",
    );
    expect(combinedCaption({ title: "", description: "Only a body" })).toBe(
      "Only a body",
    );
  });

  it("is undefined for an empty draft, so no blank caption is sent", () => {
    expect(combinedCaption({ title: " ", description: "" })).toBeUndefined();
  });
});

describe("platformContent", () => {
  const draft = { title: "Big news", description: "Here is why." };

  it("keeps a separate title and description for YouTube", () => {
    expect(platformContent("youtube", draft)).toEqual({
      platform: "youtube",
      title: "Big news",
      description: "Here is why.",
    });
  });

  it("drops an empty YouTube description rather than sending an empty string", () => {
    expect(
      platformContent("youtube", { title: "T", description: "  " }),
    ).toEqual({ platform: "youtube", title: "T" });
  });

  it("folds title and body into one caption for Instagram", () => {
    expect(platformContent("instagram", draft)).toEqual({
      platform: "instagram",
      caption: "Big news\n\nHere is why.",
    });
  });

  it("gives TikTok no content, since it drafts in-app", () => {
    expect(platformContent("tiktok", draft)).toEqual({ platform: "tiktok" });
  });
});
